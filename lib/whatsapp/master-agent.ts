import "server-only";

import type { LLMCreateParams, LLMResponse } from "@/lib/llm/provider";
import { callLLM, createGroqCallBudget } from "@/lib/llm/provider";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveGroqStage, type CrmLifecycle } from "@/lib/crm/domain";
import { normalizePhoneNumber } from "./groq-allowlist";
import { buildLookupCandidates } from "./qa-reset-candidates";

export type MasterSensitiveAction = "convert_client" | "mark_lost" | "accept_proposal";

export type MasterContact = {
  id: string;
  numero: string;
  nombre_contacto: string | null;
  nombre_empresa: string | null;
  lifecycle: string;
  stage: string;
};

type PendingAction = {
  kind: "sensitive_action";
  action: MasterSensitiveAction;
  contactId: string;
  contactLabel: string;
  proposalId?: string;
};

export interface MasterAgentRepository {
  getState(conversationId: string): Promise<PendingAction | null>;
  setState(conversationId: string, state: PendingAction | null): Promise<void>;
  findContacts(input: { phone?: string; query?: string }): Promise<MasterContact[]>;
  upsertManualContact(input: {
    phone: string;
    nombreContacto?: string;
    nombreEmpresa?: string;
    necesidad?: string;
    resumen?: string;
    stage: "exploring" | "opportunity" | "qualified";
    nextAction?: string;
    adminNumber: string;
  }): Promise<MasterContact>;
  summarizeContact(contactId: string): Promise<string>;
  resolveProposalForAcceptance(contactId: string): Promise<string | null>;
  executeSensitive(action: PendingAction, adminNumber: string): Promise<string>;
}

export interface MasterAgentDependencies {
  repository: MasterAgentRepository;
  callAgent: (params: LLMCreateParams) => Promise<LLMResponse>;
}

const MASTER_TOOLS: LLMCreateParams["tools"] = [
  {
    name: "registrar_contacto_manual",
    description: "Crea o actualiza un contacto mencionado por el administrador y registra el evento manual.",
    input_schema: {
      type: "object",
      properties: {
        target_query: { type: "string", description: "Nombre o empresa mencionada para ayudar a localizar el contacto." },
        nombre_contacto: { type: "string" },
        nombre_empresa: { type: "string" },
        necesidad: { type: "string" },
        resumen: { type: "string" },
        stage: { type: "string", enum: ["exploring", "opportunity", "qualified"] },
        next_action: { type: "string" },
      },
      required: ["stage"],
      additionalProperties: false,
    },
  },
  {
    name: "consultar_contacto_crm",
    description: "Consulta el estado real de un contacto. El backend resuelve la identidad y rechaza ambigüedades.",
    input_schema: {
      type: "object",
      properties: { target_query: { type: "string", description: "Nombre, empresa o referencia escrita por el administrador." } },
      required: ["target_query"],
      additionalProperties: false,
    },
  },
  {
    name: "proponer_accion_sensible",
    description: "Prepara una acción sensible; nunca la ejecuta sin una confirmación posterior explícita.",
    input_schema: {
      type: "object",
      properties: {
        target_query: { type: "string" },
        action: { type: "string", enum: ["convert_client", "mark_lost", "accept_proposal"] },
      },
      required: ["target_query", "action"],
      additionalProperties: false,
    },
  },
];

const MASTER_PROMPT = `Eres el Master Agent administrativo de Nasus. El remitente ya fue autenticado server-side.
Convierte cada mensaje en exactamente una tool. No inventes contactos, IDs, estados ni resultados.
- Para registrar información ocurrida fuera del sistema usa registrar_contacto_manual.
- Para preguntar qué pasó con alguien usa consultar_contacto_crm.
- Para convertir a cliente, marcar lost o aceptar una propuesta usa proponer_accion_sensible.
La identidad final siempre la resuelve el backend. Extrae solo información explícita y pregunta lo mínimo faltante.`;

export function extractPhoneCandidates(text: string): string[] {
  const matches = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) ?? [];
  return [...new Set(matches.map(normalizePhoneNumber).filter(phone => phone.length >= 10 && phone.length <= 15))];
}

export function parseExplicitConfirmation(text: string): "confirm" | "cancel" | "unknown" {
  const value = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (/^(si|confirmo|confirmar|adelante|hazlo)[.!\s]*$/.test(value)) return "confirm";
  if (/^(no|cancelar|cancela|dejalo)[.!\s]*$/.test(value)) return "cancel";
  return "unknown";
}

function label(contact: MasterContact): string {
  return contact.nombre_contacto || contact.nombre_empresa || `+${contact.numero}`;
}

async function resolveContact(
  repository: MasterAgentRepository,
  message: string,
  query?: unknown,
): Promise<{ contact?: MasterContact; response?: string }> {
  const phones = extractPhoneCandidates(message);
  if (phones.length > 1) return { response: "Veo más de un teléfono. Indícame cuál corresponde al contacto objetivo." };
  const matches = await repository.findContacts({
    phone: phones[0],
    query: typeof query === "string" ? query.trim() : undefined,
  });
  if (matches.length === 0) return { response: "No encontré ese contacto. Compárteme su teléfono completo para identificarlo sin riesgo." };
  if (matches.length > 1) {
    const options = matches.slice(0, 5).map(item => `${label(item)} (+${item.numero.slice(-4)})`).join(", ");
    return { response: `Encontré varias coincidencias: ${options}. Indícame el teléfono completo.` };
  }
  return { contact: matches[0] };
}

export async function runMasterAgent(input: {
  text: string;
  conversationId: string;
  adminNumber: string;
}, dependencies: MasterAgentDependencies): Promise<string> {
  const pending = await dependencies.repository.getState(input.conversationId);
  if (pending) {
    const confirmation = parseExplicitConfirmation(input.text);
    if (confirmation === "cancel") {
      await dependencies.repository.setState(input.conversationId, null);
      return "Acción cancelada. No hice cambios en el CRM.";
    }
    if (confirmation === "unknown") {
      return `Hay una acción pendiente para ${pending.contactLabel}. Responde únicamente “confirmo” o “cancelar”.`;
    }
    const result = await dependencies.repository.executeSensitive(pending, input.adminNumber);
    await dependencies.repository.setState(input.conversationId, null);
    return result;
  }

  const response = await dependencies.callAgent({
    model: "llama-3.3-70b-versatile",
    max_tokens: 500,
    system: [{ type: "text", text: MASTER_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: input.text.slice(0, 2000) }],
    tools: MASTER_TOOLS,
    tool_choice: { type: "required" },
  });
  const tool = response.content.find(block => block.type === "tool_use");
  if (!tool || tool.type !== "tool_use") return "No pude interpretar la operación administrativa. Reformúlala incluyendo el contacto.";
  const args = tool.input ?? {};

  if (tool.name === "registrar_contacto_manual") {
    const phones = extractPhoneCandidates(input.text);
    if (phones.length !== 1) return phones.length > 1
      ? "Veo más de un teléfono. Indícame cuál corresponde al contacto que quieres registrar."
      : "Necesito el teléfono completo del contacto para registrarlo sin crear duplicados.";
    const stage = ["exploring", "opportunity", "qualified"].includes(String(args.stage))
      ? args.stage as "exploring" | "opportunity" | "qualified"
      : "exploring";
    const existing = await dependencies.repository.findContacts({ phone: phones[0] });
    if (existing.length > 1) return "Ese teléfono coincide con registros históricos duplicados. Deben reconciliarse antes de actualizar el CRM.";
    const contact = await dependencies.repository.upsertManualContact({
      phone: existing[0]?.numero ?? phones[0],
      nombreContacto: typeof args.nombre_contacto === "string" ? args.nombre_contacto : undefined,
      nombreEmpresa: typeof args.nombre_empresa === "string" ? args.nombre_empresa : undefined,
      necesidad: typeof args.necesidad === "string" ? args.necesidad : undefined,
      resumen: typeof args.resumen === "string" ? args.resumen : undefined,
      stage,
      nextAction: typeof args.next_action === "string" ? args.next_action : undefined,
      adminNumber: input.adminNumber,
    });
    return `Listo. Registré a ${label(contact)} en ${contact.stage}${args.next_action ? `, con próxima acción: ${args.next_action}` : ""}.`;
  }

  const resolved = await resolveContact(dependencies.repository, input.text, args.target_query);
  if (!resolved.contact) return resolved.response!;

  if (tool.name === "consultar_contacto_crm") {
    return dependencies.repository.summarizeContact(resolved.contact.id);
  }

  if (tool.name === "proponer_accion_sensible") {
    const action = args.action as MasterSensitiveAction;
    if (!["convert_client", "mark_lost", "accept_proposal"].includes(action)) return "Esa acción administrativa no está habilitada.";
    const proposalId = action === "accept_proposal"
      ? await dependencies.repository.resolveProposalForAcceptance(resolved.contact.id)
      : undefined;
    if (action === "accept_proposal" && !proposalId) return "No hay una única propuesta activa que pueda aceptar de forma segura.";
    const state: PendingAction = { kind: "sensitive_action", action, contactId: resolved.contact.id, contactLabel: label(resolved.contact), ...(proposalId ? { proposalId } : {}) };
    await dependencies.repository.setState(input.conversationId, state);
    return `Esta acción modificará el CRM de ${state.contactLabel}. Responde “confirmo” para ejecutarla o “cancelar”.`;
  }

  return "La operación solicitada no está habilitada.";
}

export function createMasterAgentRepository(): MasterAgentRepository | null {
  const database = createServiceClient();
  if (!database) return null;
  return {
    async getState(conversationId) {
      const { data } = await database.from("whatsapp_conversations").select("master_state").eq("conversation_id", conversationId).maybeSingle();
      return (data?.master_state as PendingAction | null) ?? null;
    },
    async setState(conversationId, state) {
      const { error } = await database.from("whatsapp_conversations").update({ master_state: state, updated_at: new Date().toISOString() }).eq("conversation_id", conversationId);
      if (error) throw error;
    },
    async findContacts({ phone, query }) {
      let request = database.from("whatsapp_leads").select("id,numero,nombre_contacto,nombre_empresa,lifecycle,stage").limit(6);
      if (phone) request = request.in("numero", buildLookupCandidates(phone));
      else {
        const safe = (query ?? "").replace(/[%_,()]/g, " ").trim();
        if (!safe) return [];
        request = request.or(`nombre_contacto.ilike.%${safe}%,nombre_empresa.ilike.%${safe}%`);
      }
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as MasterContact[];
    },
    async upsertManualContact(values) {
      const now = new Date().toISOString();
      const { data: current } = await database.from("whatsapp_leads").select("id,numero,nombre_contacto,nombre_empresa,lifecycle,stage,problema_descrito,resumen,datos_estructurados").eq("numero", values.phone).maybeSingle();
      const structured = { ...((current?.datos_estructurados as Record<string, unknown> | null) ?? {}), ...(values.nextAction ? { next_action: values.nextAction } : {}) };
      const record = {
        numero: values.phone,
        nombre_contacto: values.nombreContacto ?? current?.nombre_contacto ?? null,
        nombre_empresa: values.nombreEmpresa ?? current?.nombre_empresa ?? null,
        problema_descrito: values.necesidad ?? current?.problema_descrito ?? null,
        resumen: values.resumen ?? values.necesidad ?? current?.resumen ?? null,
        stage: current ? resolveGroqStage(current.stage, values.stage, current.lifecycle as CrmLifecycle) : values.stage,
        origin_source: current ? undefined : "manual_whatsapp",
        datos_estructurados: structured,
        ultima_interaccion: now,
        updated_at: now,
      };
      const { data, error } = await database.from("whatsapp_leads").upsert(record, { onConflict: "numero" }).select("id,numero,nombre_contacto,nombre_empresa,lifecycle,stage").single();
      if (error || !data) throw error ?? new Error("manual_contact_not_saved");
      const { error: activityError } = await database.from("crm_activities").insert({
        contact_id: data.id, event_type: current ? "manual_contact_updated" : "manual_contact_created", actor: "human",
        actor_user_id: values.adminNumber, source: "manual_whatsapp", metadata: { next_action: values.nextAction ?? null },
      });
      if (activityError) throw activityError;
      return data as MasterContact;
    },
    async summarizeContact(contactId) {
      const [contact, proposals, requirements, activities] = await Promise.all([
        database.from("whatsapp_leads").select("numero,nombre_contacto,nombre_empresa,lifecycle,stage,resumen,ultima_interaccion").eq("id", contactId).single(),
        database.from("crm_proposals").select("title,status,value,currency,updated_at").eq("contact_id", contactId).order("updated_at", { ascending: false }).limit(1),
        database.from("whatsapp_requerimientos").select("resumen,estado,prioridad,created_at").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(3),
        database.from("crm_activities").select("event_type,created_at").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(3),
      ]);
      if (contact.error || !contact.data) throw contact.error ?? new Error("contact_not_found");
      const c = contact.data;
      const proposal = proposals.data?.[0];
      const reqs = requirements.data ?? [];
      const acts = activities.data ?? [];
      return [
        `${c.nombre_contacto || c.nombre_empresa || `+${c.numero}`}: lifecycle ${c.lifecycle}, stage ${c.stage}.`,
        `Última interacción: ${c.ultima_interaccion}.`,
        c.resumen ? `Contexto: ${c.resumen}.` : "Sin resumen comercial.",
        proposal ? `Propuesta: ${proposal.title} (${proposal.status})${proposal.value == null ? "" : `, ${proposal.currency || "MXN"} ${Number(proposal.value).toLocaleString("es-MX")}`}.` : "Sin propuesta.",
        reqs.length ? `Requerimientos: ${reqs.map(item => `${item.resumen || "sin resumen"} [${item.estado}]`).join("; ")}.` : "Sin requerimientos.",
        acts.length ? `Actividad reciente: ${acts.map(item => item.event_type).join(", ")}.` : "Sin actividad registrada.",
      ].join(" ");
    },
    async resolveProposalForAcceptance(contactId) {
      const { data, error } = await database.from("crm_proposals").select("id").eq("contact_id", contactId).in("status", ["draft", "sent"]).limit(2);
      if (error) throw error;
      return data?.length === 1 ? data[0].id : null;
    },
    async executeSensitive(action, adminNumber) {
      const requestId = crypto.randomUUID();
      if (action.action === "convert_client") {
        const { error } = await database.rpc("crm_convert_contact", { p_contact_id: action.contactId, p_actor_user_id: adminNumber, p_proposal_id: null });
        if (error) throw error;
        return `${action.contactLabel} quedó convertido a cliente.`;
      }
      if (action.action === "mark_lost") {
        const { error } = await database.rpc("crm_apply_human_decision", { p_contact_id: action.contactId, p_decision: "lost", p_actor_user_id: adminNumber, p_idempotency_key: requestId });
        if (error) throw error;
        return `${action.contactLabel} quedó marcado como lost.`;
      }
      const { data: proposal, error: findError } = await database.from("crm_proposals").select("id,status").eq("id", action.proposalId!).eq("contact_id", action.contactId).single();
      if (findError || !proposal || !["draft", "sent"].includes(proposal.status)) throw findError ?? new Error("proposal_not_acceptable");
      const now = new Date().toISOString();
      const { error } = await database.from("crm_proposals").update({ status: "accepted", accepted_at: now, updated_at: now }).eq("id", proposal.id).eq("status", proposal.status);
      if (error) throw error;
      await database.from("crm_activities").insert({ contact_id: action.contactId, event_type: "proposal_accepted", actor: "human", actor_user_id: adminNumber, source: "manual_whatsapp", metadata: { proposal_id: proposal.id }, idempotency_key: `master-proposal-accepted:${proposal.id}` });
      return `La propuesta de ${action.contactLabel} quedó aceptada.`;
    },
  };
}

export async function runConfiguredMasterAgent(input: { text: string; conversationId: string; adminNumber: string }): Promise<string> {
  const repository = createMasterAgentRepository();
  if (!repository) return "El CRM no está disponible; no ejecuté ninguna operación.";
  return runMasterAgent(input, { repository, callAgent: params => callLLM(params, createGroqCallBudget()) });
}
