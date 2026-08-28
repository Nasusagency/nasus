import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { performAdminReply } from "@/lib/whatsapp/admin-reply";
import type { ConversationMode, ConversationStatus } from "@/lib/whatsapp/conversation-policy";

export type WhatsAppInboxFilters = {
  view?: string;
  source?: string;
  campaign?: string;
};

export type WhatsAppConversationListItem = {
  conversationId: string;
  numero: string;
  lastActivity: string;
  lastMessage: string | null;
  stage: string | null;
  requiereHumano: boolean;
  mode: ConversationMode;
  status: ConversationStatus;
  unread: number;
  source: string | null;
  campaign: string | null;
  nombre: string | null;
};

export async function getWhatsAppInbox(filters: WhatsAppInboxFilters): Promise<WhatsAppConversationListItem[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];
  const [messagesResult, statesResult, leadsResult] = await Promise.all([
    supabase.from("whatsapp_mensajes").select("conversation_id,numero,direccion,contenido,created_at").order("created_at", { ascending: false }).limit(3000),
    supabase.from("whatsapp_conversations").select("conversation_id,numero,mode,status,last_read_at,updated_at").order("updated_at", { ascending: false }).limit(1000),
    supabase.from("whatsapp_leads").select("numero,nombre_contacto,nombre_empresa,stage,requiere_humano,acquisition_events(source,campaign)").limit(2000),
  ]);
  const messages = messagesResult.data ?? [];
  const states = new Map((statesResult.data ?? []).map((state: any) => [state.conversation_id, state]));
  const leads = new Map((leadsResult.data ?? []).map((lead: any) => [lead.numero, lead]));
  const grouped = new Map<string, any[]>();
  for (const message of messages) {
    const rows = grouped.get(message.conversation_id) ?? [];
    rows.push(message);
    grouped.set(message.conversation_id, rows);
  }
  const items = [...grouped.entries()].map(([conversationId, rows]) => {
    const latest = rows[0];
    const state: any = states.get(conversationId);
    const lead: any = leads.get(latest.numero);
    const attribution: any = Array.isArray(lead?.acquisition_events) ? lead.acquisition_events[0] : lead?.acquisition_events;
    const lastRead = state?.last_read_at ? new Date(state.last_read_at).getTime() : 0;
    return {
      conversationId,
      numero: latest.numero,
      lastActivity: latest.created_at,
      lastMessage: latest.contenido,
      stage: lead?.stage ?? null,
      requiereHumano: Boolean(lead?.requiere_humano),
      mode: (state?.mode ?? "ai") as ConversationMode,
      status: (state?.status ?? "open") as ConversationStatus,
      unread: rows.filter(row => row.direccion === "entrante" && new Date(row.created_at).getTime() > lastRead).length,
      source: attribution?.source ?? null,
      campaign: attribution?.campaign ?? null,
      nombre: lead?.nombre_contacto ?? lead?.nombre_empresa ?? null,
    };
  });
  return items.filter(item => {
    if (filters.source && item.source !== filters.source) return false;
    if (filters.campaign && item.campaign !== filters.campaign) return false;
    if (filters.view === "new" && item.unread === 0) return false;
    if (filters.view === "high_intent" && item.stage !== "high_intent") return false;
    if (filters.view === "requires_human" && !item.requiereHumano) return false;
    if (["ai", "human", "paused"].includes(filters.view ?? "") && item.mode !== filters.view) return false;
    if (filters.view === "resolved" && item.status !== "resolved") return false;
    return true;
  });
}

export async function getWhatsAppConversation(conversationId: string) {
  const supabase = createServiceClient();
  if (!supabase) return null;
  const { data: state } = await supabase.from("whatsapp_conversations")
    .select("conversation_id,numero,mode,status,last_read_at,created_at,updated_at")
    .eq("conversation_id", conversationId).maybeSingle();
  const { data: firstMessage } = await supabase.from("whatsapp_mensajes")
    .select("numero").eq("conversation_id", conversationId).limit(1).maybeSingle();
  const numero = state?.numero ?? firstMessage?.numero;
  if (!numero) return null;
  const [messages, leadResult, requirements] = await Promise.all([
    supabase.from("whatsapp_mensajes").select("id,direccion,contenido,media_id,created_at,sender_type,admin_actor,delivery_status,message_id").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(2000),
    supabase.from("whatsapp_leads").select("id,numero,nombre_contacto,nombre_empresa,stage,requiere_humano,razon_handoff,resumen,created_at,ultima_interaccion,acquisition_event_id,acquisition_events(id,attribution_id,source,medium,campaign,content,landing_path,metadata,created_at)").eq("numero", numero).maybeSingle(),
    supabase.from("whatsapp_requerimientos").select("id,tipo,resumen,prioridad,estado,created_at").eq("numero_contacto", numero).order("created_at", { ascending: false }).limit(100),
  ]);
  await supabase.from("whatsapp_conversations").upsert({
    conversation_id: conversationId,
    numero,
    last_read_at: new Date().toISOString(),
    updated_at: state?.updated_at ?? new Date().toISOString(),
  }, { onConflict: "conversation_id" });
  const lead: any = leadResult.data;
  const attribution: any = Array.isArray(lead?.acquisition_events) ? lead.acquisition_events[0] : lead?.acquisition_events;
  return {
    conversation: { conversationId, numero, mode: state?.mode ?? "ai", status: state?.status ?? "open" },
    messages: messages.data ?? [],
    lead: lead ?? null,
    requirements: requirements.data ?? [],
    attribution: attribution ?? null,
  };
}

export async function setConversationState(conversationId: string, mode: ConversationMode, status?: ConversationStatus) {
  const supabase = createServiceClient();
  if (!supabase) return { ok: false, error: "database_unavailable" };
  const payload: Record<string, unknown> = { mode, updated_at: new Date().toISOString() };
  if (status) payload.status = status;
  const { data, error } = await supabase.from("whatsapp_conversations").update(payload)
    .eq("conversation_id", conversationId).select("conversation_id,mode,status").maybeSingle();
  return error || !data ? { ok: false, error: "conversation_not_found" } : { ok: true, data };
}

export async function sendAdminWhatsAppMessage(input: {
  conversationId: string;
  body: string;
  requestId: string;
  adminActor: string;
}) {
  const supabase = createServiceClient();
  if (!supabase) return { ok: false, status: 503, error: "database_unavailable" };
  const { data: conversation } = await supabase.from("whatsapp_conversations")
    .select("numero").eq("conversation_id", input.conversationId).maybeSingle();
  if (!conversation) return { ok: false, status: 404, error: "conversation_not_found" };
  const messageId = `admin:${input.requestId}`;
  let reservedId = "";
  const result = await performAdminReply({
    reserve: async () => {
      const { data, error } = await supabase.from("whatsapp_mensajes").insert({
        conversation_id: input.conversationId, numero: conversation.numero, direccion: "saliente",
        contenido: input.body, message_id: messageId, sender_type: "human",
        admin_actor: input.adminActor, delivery_status: "pending",
      }).select("id").single();
      if (error?.code === "23505") return "duplicate";
      if (error || !data) return "failed";
      reservedId = data.id;
      return "reserved";
    },
    takeConversation: async () => {
      const { error } = await supabase.from("whatsapp_conversations").update({ mode: "human", status: "open", updated_at: new Date().toISOString() }).eq("conversation_id", input.conversationId);
      return !error;
    },
    send: () => sendWhatsAppText(conversation.numero, input.body),
    markDelivery: async deliveryStatus => { await supabase.from("whatsapp_mensajes").update({ delivery_status: deliveryStatus }).eq("id", reservedId); },
  });
  return result.ok
    ? { ...result, messageId: reservedId || undefined }
    : { ...result, status: result.error === "whatsapp_send_failed" ? 502 : 500 };
}
