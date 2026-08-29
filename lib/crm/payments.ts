import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { createMercadoPagoProvider } from "@/lib/payments/mercadopago";
import type { PaymentProvider } from "@/lib/payments/provider";
import { recordCrmActivity } from "./service";

export async function createPayment(input: {
  contactId: string; proposalId?: string | null; quoteId?: string | null; quoteVersionId?: string | null;
  amount: number; currency: string; description: string; dueAt?: string | null; payerEmail?: string | null; actorUserId: string;
}, provider: PaymentProvider = createMercadoPagoProvider(), client: SupabaseClient | null = createServiceClient()) {
  if (!client) return { ok: false as const, error: "database_unavailable" };
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false as const, error: "invalid_amount" };
  if (!input.description.trim()) return { ok: false as const, error: "invalid_description" };
  const externalReference = `payment:${input.contactId}:${crypto.randomUUID()}`;
  const { data: payment, error } = await client.rpc("crm_create_payment", {
    p_contact_id: input.contactId, p_proposal_id: input.proposalId ?? null, p_quote_id: input.quoteId ?? null,
    p_quote_version_id: input.quoteVersionId ?? null, p_provider: provider.name, p_external_reference: externalReference,
    p_amount: input.amount, p_currency: input.currency, p_description: input.description.slice(0, 500),
    p_due_at: input.dueAt ?? null, p_actor_user_id: input.actorUserId,
  });
  if (error || !payment) return { ok: false as const, error: error?.message || "payment_not_created" };
  if (payment.payment_url) return { ok: true as const, payment };
  const checkout = await provider.createCheckout({ externalReference: payment.external_reference, amount: Number(payment.amount), currency: payment.currency, description: payment.description, payerEmail: input.payerEmail });
  const { error: attachError } = await client.rpc("crm_attach_payment_checkout", { p_payment_id: payment.id, p_provider_payment_id: checkout.providerPaymentId, p_payment_url: checkout.paymentUrl });
  if (attachError) return { ok: false as const, error: attachError.message };
  return { ok: true as const, payment: { ...payment, provider_payment_id: checkout.providerPaymentId, payment_url: checkout.paymentUrl } };
}

// El redirect del navegador (back_urls) NUNCA marca paid. Solo esta función, alimentada por un
// webhook firmado que a su vez se verifica contra la API de pagos del proveedor, puede hacerlo.
export async function confirmPaymentFromProvider(input: { providerPaymentId: string }, provider: PaymentProvider = createMercadoPagoProvider(), client: SupabaseClient | null = createServiceClient()) {
  if (!client) return { ok: false as const, error: "database_unavailable" };
  const info = await provider.fetchPaymentStatus(input.providerPaymentId);
  if (!info.externalReference) return { ok: false as const, error: "payment_reference_missing" };
  if (info.status !== "paid") return { ok: true as const, ignored: true as const, status: info.status };
  const { data: existing } = await client.from("crm_payments").select("id,amount,currency,contact_id").eq("external_reference", info.externalReference).maybeSingle();
  if (!existing) return { ok: false as const, error: "payment_not_found" };
  if (Number(existing.amount) !== info.amount || existing.currency !== info.currency) return { ok: false as const, error: "payment_amount_mismatch" };
  const { data: payment, error } = await client.rpc("crm_confirm_payment", { p_external_reference: info.externalReference, p_provider: provider.name, p_provider_payment_id: input.providerPaymentId, p_paid_at: info.paidAt || new Date().toISOString() });
  if (error || !payment) return { ok: false as const, error: error?.message || "payment_not_confirmed" };
  await recordCrmActivity({ contactId: existing.contact_id, eventType: "payment_confirmed", actor: "system", actorUserId: "webhook", metadata: { payment_id: existing.id, provider: provider.name, provider_payment_id: input.providerPaymentId }, idempotencyKey: `payment-confirmed:${existing.id}` }, client);
  return { ok: true as const, ignored: false as const, payment };
}

export async function listPaymentsForContact(contactId: string, client: SupabaseClient | null = createServiceClient()) {
  if (!client) return [];
  const { data } = await client.from("crm_payments").select("id,proposal_id,amount,currency,status,payment_url,description,due_at,paid_at,created_at").eq("contact_id", contactId).order("created_at", { ascending: false });
  return data ?? [];
}
