import "server-only";

import type { LLMCreateParams, LLMResponse } from "@/lib/llm/provider";
import { callLLM, createGroqCallBudget } from "@/lib/llm/provider";
import { PRICING_CATEGORIES, type PricingCategory } from "./pricing";

export type ScopeAnalysis = {
  title: string;
  items: Array<{
    category: PricingCategory;
    description: string;
    estimatedHours?: number;
    quantity?: number;
    notes?: string;
  }>;
  missingRequirements: string[];
  risks: string[];
  notes?: string;
};

export interface QuoteScopeAnalyzerDependencies {
  callAgent: (params: LLMCreateParams) => Promise<LLMResponse>;
}

const SCOPE_TOOL: NonNullable<LLMCreateParams["tools"]>[number] = {
  name: "estructurar_alcance_cotizacion",
  description: "Estructura módulos, esfuerzo, faltantes y riesgos. No calcula ni propone dinero.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string", enum: [...PRICING_CATEGORIES] },
            description: { type: "string" },
            estimated_hours: { type: "number", description: "Horas estimadas solo para categorías por hora." },
            quantity: { type: "number", description: "Unidades estimadas para categorías no horarias." },
            notes: { type: "string" },
          },
          required: ["category", "description"],
          additionalProperties: false,
        },
      },
      missing_requirements: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
      notes: { type: "string" },
    },
    required: ["title", "items", "missing_requirements", "risks"],
    additionalProperties: false,
  },
};

const SYSTEM = `Eres analista de alcance técnico para Nasus. Convierte el contexto real en módulos cotizables.
No incluyas precios, tarifas, márgenes, impuestos, subtotales ni totales: no tienes autoridad para definir dinero.
Estima horas razonables solo para categorías por hora y quantity para infraestructura, consumo IA o terceros.
Identifica requisitos faltantes y riesgos sin inventar alcance. Devuelve exactamente la tool indicada.`;

const text = (value: unknown, max: number): string => typeof value === "string" ? value.trim().slice(0, max) : "";
const list = (value: unknown): string[] => Array.isArray(value) ? value.map(item => text(item, 500)).filter(Boolean).slice(0, 30) : [];
const estimate = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10000 ? parsed : undefined;
};

export async function analyzeQuoteScope(
  context: string,
  dependencies: QuoteScopeAnalyzerDependencies = { callAgent: params => callLLM(params, createGroqCallBudget()) },
): Promise<ScopeAnalysis> {
  const response = await dependencies.callAgent({
    model: "llama-3.3-70b-versatile", max_tokens: 1200,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: context.slice(0, 8000) }],
    tools: [SCOPE_TOOL], tool_choice: { type: "tool", name: SCOPE_TOOL.name },
  });
  const tool = response.content.find(block => block.type === "tool_use" && block.name === SCOPE_TOOL.name);
  if (!tool || tool.type !== "tool_use") throw new Error("invalid_scope_analysis");
  const raw = tool.input as Record<string, unknown>;
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items = rawItems.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const category = String(value.category) as PricingCategory;
    const description = text(value.description, 500);
    if (!PRICING_CATEGORIES.includes(category) || !description) return [];
    return [{ category, description, estimatedHours: estimate(value.estimated_hours), quantity: estimate(value.quantity), notes: text(value.notes, 500) || undefined }];
  }).slice(0, 50);
  if (!items.length) throw new Error("scope_without_quote_items");
  return {
    title: text(raw.title, 200) || "Cotización",
    items,
    missingRequirements: list(raw.missing_requirements),
    risks: list(raw.risks),
    notes: text(raw.notes, 2000) || undefined,
  };
}
