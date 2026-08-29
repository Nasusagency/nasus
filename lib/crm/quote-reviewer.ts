import "server-only";

import type { LLMCreateParams, LLMResponse } from "@/lib/llm/provider";
import { callClaudeReviewer } from "@/lib/llm/provider";
import type { ScopeAnalysis } from "./quote-agent";

export type QuoteReview = {
  findings: string[];
  risks: string[];
  missingRequirements: string[];
  recommendations: string[];
  reviewerProvider: "claude";
  reviewedAt: string;
};

export type ReviewDecision = { required: boolean; reasons: string[] };

export interface QuoteReviewerDependencies {
  callReviewer: (params: LLMCreateParams) => Promise<LLMResponse>;
  now?: () => Date;
}

const REVIEW_TOOL: NonNullable<LLMCreateParams["tools"]>[number] = {
  name: "revisar_cotizacion_tecnica",
  description: "Revisa el alcance y esfuerzo sin modificar precios ni aprobar la cotización.",
  input_schema: {
    type: "object",
    properties: {
      findings: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
      missing_requirements: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
    },
    required: ["findings", "risks", "missing_requirements", "recommendations"],
    additionalProperties: false,
  },
};

const SYSTEM = `Eres reviewer técnico de cotizaciones de Nasus. Revisa, no reemplaces, el análisis inicial.
Detecta omisiones, contradicciones, dependencias, riesgos y horas agresivas o incoherentes.
No propongas ni modifiques tarifas, costos, márgenes, impuestos, subtotales o totales. No apruebes.
Devuelve únicamente la herramienta indicada.`;

const cleanList = (value: unknown): string[] => Array.isArray(value)
  ? value.map(item => typeof item === "string" ? item.trim().slice(0, 500) : "").filter(Boolean).slice(0, 30)
  : [];

export function decideClaudeReview(scope: string, analysis: ScopeAnalysis): ReviewDecision {
  const integrationCount = analysis.items.filter(item => item.category === "api_integration").length;
  const hours = analysis.items.reduce((sum, item) => sum + (item.estimatedHours ?? 0), 0);
  const reasons = [
    ...(analysis.items.length >= 6 ? ["cotizacion_compleja"] : []),
    ...(integrationCount >= 2 ? ["varias_integraciones"] : []),
    ...(hours >= 80 ? ["horas_elevadas"] : []),
    ...(analysis.risks.length > 0 ? ["riesgos"] : []),
    ...(analysis.missingRequirements.length > 0 ? ["requisitos_faltantes"] : []),
    ...(/\b(por definir|no se sabe|aproximad|quiz[aá]s|posiblemente)\b|\?{2,}/i.test(scope) ? ["scope_ambiguo"] : []),
  ];
  return { required: reasons.length > 0, reasons: [...new Set(reasons)] };
}

export async function reviewQuoteAnalysis(
  scope: string,
  analysis: ScopeAnalysis,
  dependencies: QuoteReviewerDependencies = { callReviewer: callClaudeReviewer },
): Promise<QuoteReview> {
  const response = await dependencies.callReviewer({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify({ scope: scope.slice(0, 8000), analysis }) }],
    tools: [REVIEW_TOOL],
    tool_choice: { type: "tool", name: REVIEW_TOOL.name },
  });
  const tool = response.content.find(block => block.type === "tool_use" && block.name === REVIEW_TOOL.name);
  if (!tool || tool.type !== "tool_use") throw new Error("invalid_quote_review");
  const raw = tool.input as Record<string, unknown>;
  return {
    findings: cleanList(raw.findings),
    risks: cleanList(raw.risks),
    missingRequirements: cleanList(raw.missing_requirements),
    recommendations: cleanList(raw.recommendations),
    reviewerProvider: "claude",
    reviewedAt: (dependencies.now?.() ?? new Date()).toISOString(),
  };
}
