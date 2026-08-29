import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { proposalExternalKey, stageForProposalCreated, type CrmActor } from "./domain";

export async function recordCrmActivity(input: {
  contactId: string;
  eventType: string;
  actor: CrmActor;
  actorUserId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  source?: string;
}, client: SupabaseClient | null = createServiceClient()): Promise<boolean> {
  if (!client) return false;
  const { error } = await client.from("crm_activities").upsert({
    contact_id: input.contactId,
    event_type: input.eventType,
    actor: input.actor,
    actor_user_id: input.actorUserId ?? null,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    metadata: input.metadata ?? {},
    idempotency_key: input.idempotencyKey ?? null,
    source: input.source ?? null,
  }, { onConflict: "idempotency_key", ignoreDuplicates: true });
  if (error) console.error(`[CRM] activity_failed event=${input.eventType} code=${error.code}`);
  return !error;
}

export async function createCrmProposal(input: {
  contactId: string;
  slug: string;
  title: string;
  content: string;
  value?: number | null;
  currency?: string | null;
  actorUserId?: string | null;
}, client: SupabaseClient | null = createServiceClient()) {
  if (!client) return { ok: false as const, error: "database_unavailable" };
  const externalKey = proposalExternalKey(input.contactId, input.slug);
  const { data: proposal, error } = await client.from("crm_proposals").upsert({
    contact_id: input.contactId,
    external_key: externalKey,
    slug: input.slug,
    title: input.title,
    content: input.content,
    value: input.value ?? null,
    currency: input.currency ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "external_key" }).select("id,status,created_at").single();
  if (error || !proposal) return { ok: false as const, error: error?.message ?? "proposal_not_saved" };

  const { data: contact } = await client.from("whatsapp_leads").select("stage,lifecycle").eq("id", input.contactId).maybeSingle();
  const nextStage = stageForProposalCreated(contact?.stage, contact?.lifecycle);
  if (contact && nextStage !== contact.stage) {
    await client.from("whatsapp_leads").update({ stage: nextStage, updated_at: new Date().toISOString() }).eq("id", input.contactId);
    await recordCrmActivity({ contactId: input.contactId, eventType: "stage_changed", actor: "system", actorUserId: input.actorUserId, oldValue: { stage: contact.stage }, newValue: { stage: nextStage }, idempotencyKey: `proposal-stage:${proposal.id}` }, client);
  }
  await recordCrmActivity({ contactId: input.contactId, eventType: "proposal_created", actor: "system", actorUserId: input.actorUserId, metadata: { proposal_id: proposal.id }, idempotencyKey: `proposal-created:${proposal.id}` }, client);
  return { ok: true as const, proposal };
}

export async function markCrmProposalSent(input: {
  proposalId: string;
  deliveryId: string;
  actor?: CrmActor;
  actorUserId?: string | null;
}, client: SupabaseClient | null = createServiceClient()) {
  if (!client) return { ok: false as const, error: "database_unavailable" };
  const { data: proposal, error: findError } = await client.from("crm_proposals").select("id,contact_id,status").eq("id", input.proposalId).maybeSingle();
  if (findError || !proposal) return { ok: false as const, error: "proposal_not_found" };
  if (proposal.status === "sent") return { ok: true as const, duplicate: true };
  const sentAt = new Date().toISOString();
  const { error } = await client.from("crm_proposals").update({ status: "sent", sent_at: sentAt, updated_at: sentAt }).eq("id", proposal.id);
  if (error) return { ok: false as const, error: error.message };
  await recordCrmActivity({ contactId: proposal.contact_id, eventType: "proposal_sent", actor: input.actor ?? "system", actorUserId: input.actorUserId, oldValue: { status: proposal.status }, newValue: { status: "sent" }, metadata: { proposal_id: proposal.id, delivery_id: input.deliveryId }, idempotencyKey: `proposal-sent:${proposal.id}` }, client);
  return { ok: true as const, duplicate: false };
}

export async function suggestClientConversion(input: {
  contactId: string;
  reason: string;
  proposalId?: string | null;
}, client: SupabaseClient | null = createServiceClient()) {
  if (!client) return { ok: false as const, error: "database_unavailable" };
  const { data, error } = await client.from("crm_suggestions").insert({
    contact_id: input.contactId,
    suggestion_type: "convert_to_client",
    reason: input.reason,
    proposal_id: input.proposalId ?? null,
    created_by: "groq",
  }).select("id").maybeSingle();
  if (error && error.code !== "23505") return { ok: false as const, error: error.message };
  if (data) await recordCrmActivity({ contactId: input.contactId, eventType: "groq_action", actor: "groq", metadata: { action: "conversion_suggested", suggestion_id: data.id }, idempotencyKey: `conversion-suggested:${data.id}` }, client);
  return { ok: true as const, suggestionId: data?.id ?? null };
}
