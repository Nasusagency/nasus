import "server-only";

import { createHash } from "node:crypto";
import type { LLMCreateParams, LLMResponse } from "@/lib/llm/provider";
import { callLLM, createGroqCallBudget } from "@/lib/llm/provider";
import { createServiceClient } from "@/lib/supabase/service";
import { buildLookupCandidates } from "./qa-reset-candidates";

export type ObservationDirection = "inbound" | "outbound";

export type GateResult =
  | { observe: false; reason: "empty" | "trivial" | "no_commercial_signal" }
  | { observe: true; reasons: string[] };

const TRIVIAL = new Set([
  "ok", "okay", "oki", "gracias", "muchas gracias", "perfecto", "excelente",
  "sale", "va", "listo", "entendido", "de acuerdo", "si", "sí", "no",
  "👍", "👌", "🙏", "🙂", "😊", "✅", "vale",
]);

const SIGNALS: Array<[string, RegExp]> = [
  ["identity", /\b(?:me llamo|mi nombre es|soy\s+[a-záéíóúñ]|empresa|compañ[ií]a|negocio|cl[ií]nica|despacho|agencia)\b/i],
  ["need", /\b(?:necesit|buscamos|queremos|quiero|problema|automatiz|integr|desarroll|sistema|crm|agente|bot|api|whatsapp)\w*/i],
  ["scope", /\b(?:alcance|m[oó]dulo|entregable|cambio|ajuste|agregar|quitar|inclu|exclu|requerimiento|funcionalidad)\w*/i],
  ["commercial_intent", /\b(?:cotiz|precio|costo|presupuesto|propuesta|contrato|pago|anticipo|factur|comprar|contratar)\w*/i],
  ["acceptance", /\b(?:acepto|aceptamos|aprobado|autorizo|adelante|cerramos|trato hecho|de acuerdo con la propuesta)\b/i],
  ["follow_up", /\b(?:reuni[oó]n|llamada|agenda|agend|martes|mi[eé]rcoles|jueves|viernes|lunes|pr[oó]xima semana|fecha|seguimiento)\b/i],
  ["opportunity", /\b(?:nuevo proyecto|otra oportunidad|nuevo servicio|tambi[eé]n necesitamos)\b/i],
];

function normalized(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function onlyEmojiOrPunctuation(text: string): boolean {
  return !/[\p{L}\p{N}]/u.test(text);
}

export function gateHumanObservation(text: string): GateResult {
  const value = normalized(text);
  if (!value) return { observe: false, reason: "empty" };
  const compact = value.replace(/[.!¡¿?,;:]+$/g, "").trim();
  if (TRIVIAL.has(compact) || onlyEmojiOrPunctuation(value)) return { observe: false, reason: "trivial" };
  const reasons = SIGNALS.filter(([, pattern]) => pattern.test(value)).map(([reason]) => reason);
  return reasons.length ? { observe: true, reasons } : { observe: false, reason: "no_commercial_signal" };
}

type Observation = {
  nombre_contacto?: string;
  nombre_empresa?: string;
  necesidad?: string;
  resumen?: string;
  stage_suggestion?: "opportunity" | "qualified" | "proposal";
  sensitive_suggestion?: "convert_to_client" | "accept_proposal" | "mark_won" | "mark_lost";
  suggestion_reason?: string;
  requirement?: {
    tipo: "ajuste" | "nuevo_feature" | "problema" | "consulta";
    resumen: string;
    prioridad: "baja" | "media" | "alta";
  };
};

export interface PassiveObserverRepository {
  canObserve(conversationId: string): Promise<boolean>;
  alreadyProcessed(messageId: string): Promise<boolean>;
  apply(input: {
    conversationId: string;
    messageId: string;
    direction: ObservationDirection;
    observation: Observation;
    gateReasons: string[];
  }): Promise<"applied" | "duplicate" | "contact_not_found">;
}

export interface PassiveObserverDependencies {
  repository: PassiveObserverRepository;
  callObserver: (params: LLMCreateParams) => Promise<LLMResponse>;
}

const OBSERVATION_TOOL: NonNullable<LLMCreateParams["tools"]>[number] = {
  name: "registrar_senal_comercial",
  description: "Extrae únicamente información comercial explícita del mensaje humano observado.",
  input_schema: {
    type: "object",
    properties: {
      nombre_contacto: { type: "string" },
      nombre_empresa: { type: "string" },
      necesidad: { type: "string" },
      resumen: { type: "string", description: "Resumen factual breve; no inventar datos." },
      stage_suggestion: { type: "string", enum: ["opportunity", "qualified", "proposal"] },
      sensitive_suggestion: { type: "string", enum: ["convert_to_client", "accept_proposal", "mark_won", "mark_lost"] },
      suggestion_reason: { type: "string" },
      requirement: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["ajuste", "nuevo_feature", "problema", "consulta"] },
          resumen: { type: "string" },
          prioridad: { type: "string", enum: ["baja", "media", "alta"] },
        },
        required: ["tipo", "resumen", "prioridad"],
        additionalProperties: false,
      },
    },
    required: [],
    additionalProperties: false,
  },
};

const OBSERVER_PROMPT = `Eres una capa observadora del CRM de Nasus durante una conversación atendida por una persona.
No respondas al contacto y no ejecutes acciones. Extrae solo hechos comerciales explícitos del mensaje.
No inventes identidad, IDs, importes, aceptación ni stages. Si hay aceptación, cierre, won/lost o conversión, crea únicamente sensitive_suggestion.
stage_suggestion también es solo una recomendación. Usa requirement únicamente si existe una petición, cambio, problema o consulta concreta.
Devuelve exactamente la tool registrar_senal_comercial; deja fuera campos no sustentados.`;

export async function observeHumanMessage(input: {
  text: string;
  conversationId: string;
  messageId: string;
  direction: ObservationDirection;
}, dependencies: PassiveObserverDependencies): Promise<{ observed: boolean; reason: string }> {
  const gate = gateHumanObservation(input.text);
  if (!gate.observe) return { observed: false, reason: gate.reason };
  if (!(await dependencies.repository.canObserve(input.conversationId))) return { observed: false, reason: "contact_unavailable" };
  if (await dependencies.repository.alreadyProcessed(input.messageId)) return { observed: false, reason: "duplicate" };

  const response = await dependencies.callObserver({
    model: "llama-3.3-70b-versatile",
    max_tokens: 450,
    system: [{ type: "text", text: OBSERVER_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `[${input.direction}] ${input.text.slice(0, 2000)}` }],
    tools: [OBSERVATION_TOOL],
    tool_choice: { type: "tool", name: "registrar_senal_comercial" },
  });
  const tool = response.content.find(block => block.type === "tool_use" && block.name === "registrar_senal_comercial");
  if (!tool || tool.type !== "tool_use") return { observed: false, reason: "invalid_observer_output" };
  const raw = tool.input as Record<string, unknown>;
  const text = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
  const stage = ["opportunity", "qualified", "proposal"].includes(String(raw.stage_suggestion))
    ? raw.stage_suggestion as Observation["stage_suggestion"] : undefined;
  const sensitive = ["convert_to_client", "accept_proposal", "mark_won", "mark_lost"].includes(String(raw.sensitive_suggestion))
    ? raw.sensitive_suggestion as Observation["sensitive_suggestion"] : undefined;
  const rawRequirement = raw.requirement && typeof raw.requirement === "object" ? raw.requirement as Record<string, unknown> : undefined;
  const requirementType = rawRequirement && ["ajuste", "nuevo_feature", "problema", "consulta"].includes(String(rawRequirement.tipo))
    ? rawRequirement.tipo as NonNullable<Observation["requirement"]>["tipo"] : undefined;
  const requirementPriority = rawRequirement && ["baja", "media", "alta"].includes(String(rawRequirement.prioridad))
    ? rawRequirement.prioridad as NonNullable<Observation["requirement"]>["prioridad"] : undefined;
  const requirementSummary = text(rawRequirement?.resumen, 2000);
  const observation: Observation = {
    nombre_contacto: text(raw.nombre_contacto, 160), nombre_empresa: text(raw.nombre_empresa, 200),
    necesidad: text(raw.necesidad, 2000), resumen: text(raw.resumen, 2000),
    stage_suggestion: stage, sensitive_suggestion: sensitive,
    suggestion_reason: text(raw.suggestion_reason, 1000),
    ...(requirementType && requirementPriority && requirementSummary
      ? { requirement: { tipo: requirementType, prioridad: requirementPriority, resumen: requirementSummary } }
      : {}),
  };
  if (!Object.values(observation).some(Boolean)) return { observed: false, reason: "empty_observation" };
  const result = await dependencies.repository.apply({
    conversationId: input.conversationId,
    messageId: input.messageId,
    direction: input.direction,
    observation,
    gateReasons: gate.reasons,
  });
  return { observed: result === "applied", reason: result };
}

function observationKey(messageId: string): string {
  return `passive-observation:${createHash("sha256").update(messageId).digest("hex")}`;
}

export function createPassiveObserverRepository(): PassiveObserverRepository | null {
  const database = createServiceClient();
  if (!database) return null;
  return {
    async canObserve(conversationId) {
      const { data: conversation, error } = await database.from("whatsapp_conversations").select("numero,mode").eq("conversation_id", conversationId).maybeSingle();
      if (error || !conversation || conversation.mode !== "human") return false;
      const { data: contact, error: contactError } = await database.from("whatsapp_leads").select("id").in("numero", buildLookupCandidates(conversation.numero)).maybeSingle();
      return !contactError && Boolean(contact);
    },
    async alreadyProcessed(messageId) {
      const { data, error } = await database.from("crm_activities").select("id").eq("idempotency_key", observationKey(messageId)).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async apply(input) {
      const { data: conversation, error: conversationError } = await database.from("whatsapp_conversations")
        .select("numero,mode").eq("conversation_id", input.conversationId).maybeSingle();
      if (conversationError) throw conversationError;
      if (!conversation || conversation.mode !== "human") return "contact_not_found";
      const { data: contact, error: contactError } = await database.from("whatsapp_leads")
        .select("id,numero,nombre_contacto,nombre_empresa,problema_descrito,resumen,lifecycle,stage,datos_estructurados")
        .in("numero", buildLookupCandidates(conversation.numero)).maybeSingle();
      if (contactError) throw contactError;
      if (!contact) return "contact_not_found";
      const key = observationKey(input.messageId);
      const { data: existing } = await database.from("crm_activities").select("id").eq("idempotency_key", key).maybeSingle();
      if (existing) return "duplicate";

      const observation = input.observation;
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (!contact.nombre_contacto && observation.nombre_contacto) update.nombre_contacto = observation.nombre_contacto.slice(0, 160);
      if (!contact.nombre_empresa && observation.nombre_empresa) update.nombre_empresa = observation.nombre_empresa.slice(0, 200);
      if (observation.necesidad) {
        const need = observation.necesidad.trim();
        update.problema_descrito = contact.problema_descrito?.includes(need)
          ? contact.problema_descrito
          : [contact.problema_descrito, need].filter(Boolean).join("\n").slice(-2000);
      }
      if (observation.resumen) {
        const summary = observation.resumen.trim();
        update.resumen = contact.resumen?.includes(summary)
          ? contact.resumen
          : [contact.resumen, summary].filter(Boolean).join("\n").slice(-2000);
      }
      const structured = (contact.datos_estructurados && typeof contact.datos_estructurados === "object") ? contact.datos_estructurados as Record<string, unknown> : {};
      update.datos_estructurados = { ...structured, last_passive_observation_at: new Date().toISOString() };
      const { error: updateError } = await database.from("whatsapp_leads").update(update).eq("id", contact.id);
      if (updateError) throw updateError;

      const suggestions: Array<{ type: string; reason: string }> = [];
      if (observation.stage_suggestion && observation.stage_suggestion !== contact.stage) {
        suggestions.push({ type: `stage_change:${observation.stage_suggestion}`, reason: observation.suggestion_reason || `Señal observada para avanzar a ${observation.stage_suggestion}.` });
      }
      if (observation.sensitive_suggestion) {
        suggestions.push({ type: observation.sensitive_suggestion, reason: observation.suggestion_reason || "Se detectó una posible acción sensible durante atención humana." });
      }
      for (const suggestion of suggestions) {
        const { error } = await database.from("crm_suggestions").insert({
          contact_id: contact.id, suggestion_type: suggestion.type, reason: suggestion.reason.slice(0, 1000), created_by: "groq",
        });
        if (error && error.code !== "23505") throw error;
      }

      if (observation.requirement) {
        const requirement = observation.requirement;
        const { error } = await database.from("whatsapp_requerimientos").insert({
          numero_contacto: contact.numero, contact_id: contact.id, conversation_id: input.conversationId,
          tipo: requirement.tipo, descripcion_original: requirement.resumen.slice(0, 2000), resumen: requirement.resumen.slice(0, 300),
          prioridad: requirement.prioridad, estado: "abierto", source: "whatsapp_agent", source_message_id: input.messageId,
          razon_deteccion: "passive_human_observer",
        });
        if (error && error.code !== "23505") throw error;
      }

      const { error: activityError } = await database.from("crm_activities").insert({
        contact_id: contact.id, event_type: "passive_observation", actor: "groq", source: "whatsapp_agent",
        metadata: { direction: input.direction, gate_reasons: input.gateReasons, stage_suggestion: observation.stage_suggestion ?? null, sensitive_suggestion: observation.sensitive_suggestion ?? null, requirement: Boolean(observation.requirement) },
        idempotency_key: key,
      });
      if (activityError?.code === "23505") return "duplicate";
      if (activityError) throw activityError;
      return "applied";
    },
  };
}

export async function observeConfiguredHumanMessage(input: {
  text: string;
  conversationId: string;
  messageId: string;
  direction: ObservationDirection;
}): Promise<{ observed: boolean; reason: string }> {
  const repository = createPassiveObserverRepository();
  if (!repository) return { observed: false, reason: "database_unavailable" };
  return observeHumanMessage(input, { repository, callObserver: params => callLLM(params, createGroqCallBudget()) });
}
