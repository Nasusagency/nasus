import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { CONSENT_TEXT, type ConsentChannel } from "./consent-text";

export type { ConsentChannel };
export type ConsentSource = "web_form" | "email_campaign" | "admin" | "whatsapp";

export interface ConsentGrant {
  channel: ConsentChannel;
  address: string;
}

/**
 * Registra aceptaciones de permiso (una fila por canal). Nunca lanza: devuelve
 * false si no pudo guardar, para que quien llama decida qué hacer.
 */
export async function recordConsents(
  input: { contactId: string | null; grants: ConsentGrant[]; source: ConsentSource; campaign?: string | null },
  client: SupabaseClient | null = createServiceClient(),
): Promise<boolean> {
  if (!client || input.grants.length === 0) return input.grants.length === 0;
  const rows = input.grants.map((grant) => ({
    contact_id: input.contactId,
    channel: grant.channel,
    status: "granted",
    address: grant.address,
    source: input.source,
    consent_text: CONSENT_TEXT[grant.channel],
    campaign: input.campaign ?? null,
  }));
  const { error } = await client.from("crm_consents").insert(rows);
  if (error) console.error(`[CRM] consent_insert_failed code=${error.code}`);
  return !error;
}

/** Palabras que retiran el permiso de WhatsApp cuando son TODO el mensaje (sin acentos, minúsculas). */
const OPT_OUT_WORDS = new Set(["baja", "stop", "cancelar", "darme de baja", "no quiero recibir mensajes"]);

/** Puro (probado en tests). Solo el mensaje completo cuenta: "baja de precio" no es una baja. */
export function isOptOutMessage(text: string): boolean {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.!¡¿?]/g, "").trim();
  return OPT_OUT_WORDS.has(normalized);
}

/** Retira el permiso de un canal (nueva fila "revoked"; el historial no se toca). */
export async function revokeConsent(
  input: { contactId: string | null; channel: ConsentChannel; address: string; source: ConsentSource },
  client: SupabaseClient | null = createServiceClient(),
): Promise<boolean> {
  if (!client) return false;
  const { error } = await client.from("crm_consents").insert({
    contact_id: input.contactId,
    channel: input.channel,
    status: "revoked",
    address: input.address,
    source: input.source,
  });
  if (error) console.error(`[CRM] consent_revoke_failed code=${error.code}`);
  return !error;
}

export interface ConsentState {
  channel: ConsentChannel;
  status: "granted" | "revoked";
  source: string;
  decidedAt: string;
}

/** Estado vigente de cada canal para un contacto (la decisión más reciente gana). */
export async function getContactConsents(
  contactId: string,
  client: SupabaseClient | null = createServiceClient(),
): Promise<ConsentState[]> {
  if (!client) return [];
  const { data, error } = await client
    .from("crm_consents")
    .select("channel,status,source,created_at")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return latestPerChannel(data as Array<{ channel: ConsentChannel; status: "granted" | "revoked"; source: string; created_at: string }>);
}

/** Puro (probado en tests): la fila más reciente de cada canal, con filas en orden descendente. */
export function latestPerChannel(
  rows: Array<{ channel: ConsentChannel; status: "granted" | "revoked"; source: string; created_at: string }>,
): ConsentState[] {
  const seen = new Map<ConsentChannel, ConsentState>();
  for (const row of rows) {
    if (!seen.has(row.channel)) seen.set(row.channel, { channel: row.channel, status: row.status, source: row.source, decidedAt: row.created_at });
  }
  return [...seen.values()];
}
