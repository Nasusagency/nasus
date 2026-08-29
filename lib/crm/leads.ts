import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizePhoneNumber } from "@/lib/whatsapp/groq-allowlist";
import { buildLookupCandidates } from "@/lib/whatsapp/qa-reset-candidates";
import { recordCrmActivity } from "./service";

const PHONE_RE = /^\d{10,15}$/;
export const MANUAL_LEAD_STAGES = ["exploring", "opportunity", "qualified"] as const;
export type ManualLeadStage = (typeof MANUAL_LEAD_STAGES)[number];

export interface CreateManualLeadInput {
  numero: string;
  nombreContacto?: string;
  nombreEmpresa?: string;
  necesidad?: string;
  stage?: ManualLeadStage;
  actorUserId: string;
}

/**
 * Alta manual de un lead desde el admin (fuera de WhatsApp). Usa la misma
 * "canonical identity" que el resto del sistema (buildLookupCandidates,
 * variantes 52/521 de México) para no permitir un duplicado por número.
 */
export async function createManualLead(
  input: CreateManualLeadInput,
  client: SupabaseClient | null = createServiceClient()
) {
  if (!client) return { ok: false as const, error: "database_unavailable" };

  const numero = normalizePhoneNumber(input.numero);
  if (!PHONE_RE.test(numero)) return { ok: false as const, error: "invalid_phone" };

  const candidates = buildLookupCandidates(numero);
  const { data: existing, error: lookupError } = await client
    .from("whatsapp_leads")
    .select("id,numero,archived_at")
    .in("numero", candidates);
  if (lookupError) return { ok: false as const, error: lookupError.message };
  if (existing && existing.length > 0) {
    const archived = existing.find((row) => row.archived_at);
    return {
      ok: false as const,
      error: archived ? "duplicate_archived" : "duplicate",
      existingId: existing[0].id,
    };
  }

  const stage: ManualLeadStage = MANUAL_LEAD_STAGES.includes(input.stage as ManualLeadStage)
    ? (input.stage as ManualLeadStage)
    : "exploring";
  const now = new Date().toISOString();

  const { data: lead, error } = await client
    .from("whatsapp_leads")
    .insert({
      numero,
      nombre_contacto: input.nombreContacto?.trim() || null,
      nombre_empresa: input.nombreEmpresa?.trim() || null,
      problema_descrito: input.necesidad?.trim() || null,
      stage,
      lifecycle: "lead",
      origin_source: "admin",
      ultima_interaccion: now,
      updated_at: now,
    })
    .select("id,numero,nombre_contacto,nombre_empresa,stage,lifecycle")
    .single();
  if (error || !lead) return { ok: false as const, error: error?.message ?? "lead_not_created" };

  await recordCrmActivity(
    {
      contactId: lead.id,
      eventType: "manual_contact_created",
      actor: "human",
      actorUserId: input.actorUserId,
      source: "admin",
      metadata: { via: "admin_ui" },
      idempotencyKey: `lead-created-admin:${lead.id}`,
    },
    client
  );

  return { ok: true as const, lead };
}

export interface LeadRelationsSummary {
  quotes: number;
  proposals: number;
  payments: number;
}

/** Para advertir en el admin antes de archivar un contacto con relaciones activas. */
export async function getLeadRelationsSummary(
  contactId: string,
  client: SupabaseClient | null = createServiceClient()
): Promise<LeadRelationsSummary> {
  if (!client) return { quotes: 0, proposals: 0, payments: 0 };
  const [quotes, proposals, payments] = await Promise.all([
    client.from("crm_quotes").select("id", { count: "exact", head: true }).eq("contact_id", contactId),
    client.from("crm_proposals").select("id", { count: "exact", head: true }).eq("contact_id", contactId),
    client.from("crm_payments").select("id", { count: "exact", head: true }).eq("contact_id", contactId),
  ]);
  return {
    quotes: quotes.count ?? 0,
    proposals: proposals.count ?? 0,
    payments: payments.count ?? 0,
  };
}

/**
 * Soft-delete: oculta el contacto del listado normal sin borrar nada. Nunca
 * cascadea a crm_quotes/crm_proposals/crm_payments — esas tablas conservan
 * su historial intacto, ligadas a un contacto simplemente archivado.
 */
export async function archiveLead(
  input: { contactId: string; actorUserId: string },
  client: SupabaseClient | null = createServiceClient()
) {
  if (!client) return { ok: false as const, error: "database_unavailable" };
  const { data: contact, error: findError } = await client
    .from("whatsapp_leads")
    .select("id,archived_at")
    .eq("id", input.contactId)
    .maybeSingle();
  if (findError) return { ok: false as const, error: findError.message };
  if (!contact) return { ok: false as const, error: "contact_not_found" };
  if (contact.archived_at) return { ok: true as const, alreadyArchived: true as const };

  const now = new Date().toISOString();
  const { error } = await client
    .from("whatsapp_leads")
    .update({ archived_at: now, archived_by: input.actorUserId, updated_at: now })
    .eq("id", input.contactId)
    .is("archived_at", null);
  if (error) return { ok: false as const, error: error.message };

  await recordCrmActivity(
    {
      contactId: input.contactId,
      eventType: "contact_archived",
      actor: "human",
      actorUserId: input.actorUserId,
      source: "admin",
      idempotencyKey: `lead-archived:${input.contactId}:${now}`,
    },
    client
  );

  return { ok: true as const, alreadyArchived: false as const };
}

export async function unarchiveLead(
  input: { contactId: string; actorUserId: string },
  client: SupabaseClient | null = createServiceClient()
) {
  if (!client) return { ok: false as const, error: "database_unavailable" };
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("whatsapp_leads")
    .update({ archived_at: null, archived_by: null, updated_at: now })
    .eq("id", input.contactId)
    .not("archived_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "contact_not_found_or_not_archived" };

  await recordCrmActivity(
    {
      contactId: input.contactId,
      eventType: "contact_unarchived",
      actor: "human",
      actorUserId: input.actorUserId,
      source: "admin",
      idempotencyKey: `lead-unarchived:${input.contactId}:${now}`,
    },
    client
  );

  return { ok: true as const };
}
