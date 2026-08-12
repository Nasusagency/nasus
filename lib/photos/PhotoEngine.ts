import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "@/lib/anthropic/client";
import type { PhotoConfig, PhotoAnalysisResult, PhotoVerdict, RuleResult } from "./types";

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp";

export async function analyzePhoto(
  config: PhotoConfig,
  base64: string,
  mimeType: string
): Promise<PhotoAnalysisResult> {
  const isPdf = mimeType === "application/pdf";
  const mediaBlock = isPdf
    ? ({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      } as unknown as Anthropic.ContentBlockParam)
    : ({
        type: "image",
        source: { type: "base64", media_type: mimeType as ImageMediaType, data: base64 },
      } as Anthropic.ContentBlockParam);

  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: config.systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          mediaBlock,
          {
            type: "text",
            text: `Evalúa esta fotografía para uso en ${config.name}. Analiza cada regla y devuelve el JSON requerido.`,
          },
        ],
      },
    ],
  });

  const rawText =
    response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  const cleaned = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  const parsed = JSON.parse(cleaned) as {
    apt: boolean;
    rules: Record<string, RuleResult>;
    issues: string[];
    suggestions: string[];
  };

  const ruleResults: Record<string, RuleResult> = parsed.rules ?? {};
  const issues: string[] = Array.isArray(parsed.issues) ? parsed.issues : [];
  const suggestions: string[] = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

  const verdict = computeVerdict(config, ruleResults);

  return {
    photoType: config.id,
    verdict,
    issues,
    suggestions,
    ruleResults,
  };
}

function computeVerdict(
  config: PhotoConfig,
  ruleResults: Record<string, RuleResult>
): PhotoVerdict {
  const requiredRules = config.rules.filter((r) => r.required);
  const optionalRules = config.rules.filter((r) => !r.required);

  const anyRequiredFail = requiredRules.some(
    (r) => ruleResults[r.id] && ruleResults[r.id].pass === false
  );
  if (anyRequiredFail) return "NO_APTA";

  const anyOptionalFail = optionalRules.some(
    (r) => ruleResults[r.id] && ruleResults[r.id].pass === false
  );
  if (anyOptionalFail) return "REVISAR";

  return "APTA";
}
