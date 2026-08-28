import type { ConversationMode, ConversationStatus } from "./conversation-policy";

export type InboxMessageRow = {
  conversation_id: string;
  numero: string;
  direccion: "entrante" | "saliente";
  contenido: string | null;
  created_at: string;
};

export type InboxStateRow = {
  conversation_id: string;
  numero: string;
  mode: ConversationMode;
  status: ConversationStatus;
  last_read_at: string | null;
  updated_at: string;
};

export type InboxLeadRow = {
  numero: string;
  nombre_contacto?: string | null;
  nombre_empresa?: string | null;
  stage?: string | null;
  requiere_humano?: boolean;
  acquisition_events?: { source?: string | null; campaign?: string | null } | Array<{ source?: string | null; campaign?: string | null }> | null;
};

export type ContactInboxItem = {
  conversationId: string;
  conversationCount: number;
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

export function buildContactInbox(
  messages: InboxMessageRow[],
  states: InboxStateRow[],
  leads: InboxLeadRow[],
): ContactInboxItem[] {
  const stateByConversation = new Map(states.map(state => [state.conversation_id, state]));
  const leadByNumber = new Map(leads.map(lead => [lead.numero, lead]));
  const grouped = new Map<string, InboxMessageRow[]>();
  for (const message of messages) {
    const rows = grouped.get(message.numero) ?? [];
    rows.push(message);
    grouped.set(message.numero, rows);
  }
  return [...grouped.entries()].map(([numero, unsorted]) => {
    const rows = [...unsorted].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const latest = rows[0];
    const conversationIds = new Set(rows.map(row => row.conversation_id));
    const latestState = stateByConversation.get(latest.conversation_id)
      ?? states.filter(state => state.numero === numero).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
    const lead = leadByNumber.get(numero);
    const attribution = Array.isArray(lead?.acquisition_events) ? lead.acquisition_events[0] : lead?.acquisition_events;
    const unread = rows.filter(row => {
      if (row.direccion !== "entrante") return false;
      const lastReadAt = stateByConversation.get(row.conversation_id)?.last_read_at;
      return !lastReadAt || Date.parse(row.created_at) > Date.parse(lastReadAt);
    }).length;
    return {
      conversationId: latest.conversation_id,
      conversationCount: conversationIds.size,
      numero,
      lastActivity: latest.created_at,
      lastMessage: latest.contenido,
      stage: lead?.stage ?? null,
      requiereHumano: Boolean(lead?.requiere_humano),
      mode: latestState?.mode ?? "ai",
      status: latestState?.status ?? "open",
      unread,
      source: attribution?.source ?? null,
      campaign: attribution?.campaign ?? null,
      nombre: lead?.nombre_contacto ?? lead?.nombre_empresa ?? null,
    };
  }).sort((a, b) => Date.parse(b.lastActivity) - Date.parse(a.lastActivity));
}

