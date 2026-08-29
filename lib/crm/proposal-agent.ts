import "server-only";
import type { LLMCreateParams, LLMResponse } from "@/lib/llm/provider";
import { callClaudeReviewer } from "@/lib/llm/provider";

export type ProposalCopy = { executiveSummary: string; deliverables: string[]; exclusions: string[]; dependencies: string[]; timeline: string; nextStep: string };
export interface ProposalWriterDependencies { callWriter: (params: LLMCreateParams) => Promise<LLMResponse> }

const TOOL: NonNullable<LLMCreateParams["tools"]>[number] = { name: "redactar_propuesta_comercial", description: "Redacta copy comercial no monetario ni legal.", input_schema: { type: "object", properties: {
  executive_summary: { type: "string" }, deliverables: { type: "array", items: { type: "string" } }, exclusions: { type: "array", items: { type: "string" } }, dependencies: { type: "array", items: { type: "string" } }, timeline: { type: "string" }, next_step: { type: "string" },
}, required: ["executive_summary","deliverables","exclusions","dependencies","timeline","next_step"], additionalProperties: false } };
const SYSTEM = `Redacta una propuesta B2B clara basándote solo en el snapshot aprobado. No inventes precios, totales, impuestos, cláusulas legales ni obligaciones. No incluyas IDs. Devuelve la herramienta indicada.`;
const text = (v: unknown, max=2000) => typeof v === "string" ? v.trim().slice(0,max) : "";
const list = (v: unknown) => Array.isArray(v) ? v.map(x=>text(x,500)).filter(Boolean).slice(0,30) : [];

export async function writeProposalCopy(snapshot: Record<string, unknown>, dependencies: ProposalWriterDependencies = { callWriter: callClaudeReviewer }): Promise<ProposalCopy> {
  const safe = { title: snapshot.title, scope: snapshot.scope, items: snapshot.items, review: snapshot.review };
  const response = await dependencies.callWriter({ model: "claude-haiku-4-5-20251001", max_tokens: 1400, system: [{ type:"text", text:SYSTEM, cache_control:{type:"ephemeral"} }], messages:[{role:"user",content:JSON.stringify(safe).slice(0,12000)}], tools:[TOOL], tool_choice:{type:"tool",name:TOOL.name} });
  const tool = response.content.find(b=>b.type==="tool_use"&&b.name===TOOL.name);
  if (!tool || tool.type!=="tool_use") throw new Error("invalid_proposal_copy");
  const raw=tool.input as Record<string,unknown>;
  return { executiveSummary:text(raw.executive_summary), deliverables:list(raw.deliverables), exclusions:list(raw.exclusions), dependencies:list(raw.dependencies), timeline:text(raw.timeline,500), nextStep:text(raw.next_step,500) };
}
