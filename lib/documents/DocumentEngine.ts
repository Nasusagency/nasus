import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic/client";
import type { DocumentConfig, ValidationResult } from "./types";

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp";

const LOW_QUALITY_KEYWORDS = [
  "ilegible", "borroso", "desenfocad", "baja calidad", "poor quality", "blurry",
];

export interface DocumentAnalysisResult extends ValidationResult {
  humanOverriddenFields: string[];
}

function buildMessages(
  config: DocumentConfig,
  base64: string,
  mimeType: string
): Anthropic.MessageParam[] {
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

  return [
    {
      role: "user",
      content: [
        mediaBlock,
        {
          type: "text",
          text: `Analiza este documento de tipo ${config.id.toUpperCase()} y devuelve el JSON requerido.${
            isPdf
              ? " Si el PDF tiene varias páginas, analiza la primera página con información relevante."
              : ""
          } Si la imagen está desenfocada, con brillo excesivo o los campos son ilegibles, incluye en 'issues': 'Calidad de imagen insuficiente — sube una foto con mejor iluminación y enfoque.' y establece valid en false.`,
        },
      ],
    },
  ];
}

export async function analyzeDocument(
  config: DocumentConfig,
  base64: string,
  mimeType: string,
  overrides?: Record<string, unknown>
): Promise<DocumentAnalysisResult> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: config.systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: buildMessages(config, base64, mimeType),
  });

  const rawText =
    response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  const cleaned = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  const parsed = JSON.parse(cleaned) as {
    fields: Record<string, unknown>;
    issues?: string[];
  };

  const claudeIssues: string[] = Array.isArray(parsed.issues) ? parsed.issues : [];
  const humanOverriddenFields: string[] = overrides ? Object.keys(overrides) : [];
  const mergedFields = overrides ? { ...parsed.fields, ...overrides } : (parsed.fields ?? {});

  // Low-quality detection
  const fieldValues = Object.values(mergedFields);
  const nullCount = fieldValues.filter((v) => v === null).length;
  const hasLowQuality = claudeIssues.some((i) =>
    LOW_QUALITY_KEYWORDS.some((kw) => i.toLowerCase().includes(kw))
  );
  if (
    (hasLowQuality || (fieldValues.length > 0 && nullCount / fieldValues.length > 0.7)) &&
    !claudeIssues.some((i) => i.toLowerCase().includes("calidad"))
  ) {
    claudeIssues.unshift(
      "Calidad de imagen insuficiente — sube una foto con mejor iluminación y enfoque."
    );
  }

  const validation = config.validate(mergedFields);
  const mergedIssues = [...claudeIssues, ...validation.issues];

  return {
    valid: mergedIssues.length === 0,
    issues: mergedIssues,
    fields: validation.fields,
    humanOverriddenFields,
  };
}
