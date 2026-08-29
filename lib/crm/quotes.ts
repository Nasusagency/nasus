import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { analyzeQuoteScope, type QuoteScopeAnalyzerDependencies } from "./quote-agent";
import { decideClaudeReview, reviewQuoteAnalysis, type QuoteReviewerDependencies } from "./quote-reviewer";
import {
  calculateQuote, lineFromRate, PRICING_CATEGORIES, type PricingCategory,
  type PricingProfile, type PricingRate, type PricingUnit, type QuoteLineInput,
} from "./pricing";

const units = new Set<PricingUnit>(["hour", "fixed", "month", "usage"]);
const number = (value: unknown): number => Number(value);

function mapProfile(profile: Record<string, unknown>, rates: Array<Record<string, unknown>>): PricingProfile {
  return {
    id: String(profile.id), name: String(profile.name), currency: String(profile.currency),
    contingencyPct: number(profile.contingency_pct), taxPct: number(profile.tax_pct), taxLabel: String(profile.tax_label),
    fiscalConfig: (profile.fiscal_config && typeof profile.fiscal_config === "object") ? profile.fiscal_config as Record<string, unknown> : {},
    rates: rates.map(rate => ({
      category: String(rate.category) as PricingCategory, label: String(rate.label), unit: String(rate.unit) as PricingUnit,
      unitLabel: String(rate.unit_label), rate: rate.rate === null ? null : number(rate.rate), marginPct: number(rate.margin_pct), active: Boolean(rate.active),
    })),
  };
}

export async function getActivePricingProfile(client: SupabaseClient | null = createServiceClient()): Promise<PricingProfile | null> {
  if (!client) return null;
  const { data: profile, error } = await client.from("crm_pricing_profiles").select("id,name,currency,contingency_pct,tax_pct,tax_label,fiscal_config").eq("is_active", true).maybeSingle();
  if (error || !profile) return null;
  const { data: rates, error: ratesError } = await client.from("crm_pricing_rates").select("category,label,unit,unit_label,rate,margin_pct,active,sort_order").eq("profile_id", profile.id).order("sort_order");
  if (ratesError) throw ratesError;
  return mapProfile(profile, (rates ?? []) as Array<Record<string, unknown>>);
}

export async function updateActivePricingProfile(input: {
  name: string; currency: string; contingencyPct: number; taxPct: number; taxLabel: string;
  fiscalConfig: Record<string, unknown>; rates: PricingRate[]; actorUserId: string;
}, client: SupabaseClient | null = createServiceClient()) {
  if (!client) return { ok: false as const, error: "database_unavailable" };
  const current = await getActivePricingProfile(client);
  if (!current) return { ok: false as const, error: "pricing_profile_not_found" };
  if (!input.name.trim() || !/^[A-Z]{3}$/.test(input.currency) || !Number.isFinite(input.contingencyPct) || input.contingencyPct < 0 || input.contingencyPct > 100 || !Number.isFinite(input.taxPct) || input.taxPct < 0 || input.taxPct > 100) {
    return { ok: false as const, error: "invalid_pricing_profile" };
  }
  const categories = new Set<string>();
  for (const rate of input.rates) {
    if (!PRICING_CATEGORIES.includes(rate.category) || categories.has(rate.category) || !units.has(rate.unit) || (rate.rate !== null && (!Number.isFinite(rate.rate) || rate.rate < 0)) || !Number.isFinite(rate.marginPct) || rate.marginPct < 0 || rate.marginPct > 100) {
      return { ok: false as const, error: "invalid_pricing_rate" };
    }
    categories.add(rate.category);
  }
  const now = new Date().toISOString();
  const { error } = await client.from("crm_pricing_profiles").update({
    name: input.name.trim(), currency: input.currency, contingency_pct: input.contingencyPct, tax_pct: input.taxPct,
    tax_label: input.taxLabel.trim() || "Impuestos", fiscal_config: input.fiscalConfig, updated_by: input.actorUserId, updated_at: now,
  }).eq("id", current.id);
  if (error) return { ok: false as const, error: error.message };
  const rows = input.rates.map((rate, index) => ({
    profile_id: current.id, category: rate.category, label: rate.label.trim(), unit: rate.unit, unit_label: rate.unitLabel.trim(),
    rate: rate.rate, margin_pct: rate.marginPct, active: rate.active !== false, sort_order: index * 10, updated_at: now,
  }));
  const { error: rateError } = await client.from("crm_pricing_rates").upsert(rows, { onConflict: "profile_id,category" });
  return rateError ? { ok: false as const, error: rateError.message } : { ok: true as const };
}

function totalsPayload(calculation: ReturnType<typeof calculateQuote>) {
  return {
    direct_cost: calculation.directCost, external_cost: calculation.externalCost, margin_amount: calculation.marginAmount,
    contingency_amount: calculation.contingencyAmount, subtotal: calculation.subtotal, tax_amount: calculation.taxAmount, total: calculation.total,
  };
}

function itemsPayload(calculation: ReturnType<typeof calculateQuote>) {
  return calculation.lines.map((line, index) => ({
    sort_order: index * 10, category: line.category, description: line.description, unit: line.unit,
    quantity: line.quantity, hours: line.hours, unit_rate: line.unitRate, direct_cost: line.directCost,
    external_cost: line.externalCost, margin_pct: line.marginPct, margin_amount: line.marginAmount,
    line_subtotal: line.lineSubtotal, notes: line.notes ?? null, source: line.source ?? "human",
  }));
}

export async function createQuoteDraftFromScope(input: {
  contactId: string; scope: string; requestKey: string; actorUserId: string;
}, dependencies?: QuoteScopeAnalyzerDependencies & Partial<QuoteReviewerDependencies>, client: SupabaseClient | null = createServiceClient()) {
  if (!client) return { ok: false as const, error: "database_unavailable" };
  const [profile, contactResult] = await Promise.all([
    getActivePricingProfile(client),
    client.from("whatsapp_leads").select("id,nombre_contacto,nombre_empresa,sector,resumen,problema_descrito,lifecycle,stage").eq("id", input.contactId).maybeSingle(),
  ]);
  if (!contactResult.data) return { ok: false as const, error: "contact_not_found" };
  if (!profile) return { ok: false as const, error: "pricing_profile_not_found" };
  const contact = contactResult.data;
  const context = [
    `Contacto: ${contact.nombre_contacto || "Sin nombre"}`, `Empresa: ${contact.nombre_empresa || "Sin empresa"}`,
    contact.sector ? `Sector: ${contact.sector}` : "", contact.problema_descrito ? `Necesidad CRM: ${contact.problema_descrito}` : "",
    contact.resumen ? `Resumen CRM: ${contact.resumen}` : "", `Lifecycle: ${contact.lifecycle}; stage: ${contact.stage}`,
    `Alcance solicitado por admin: ${input.scope}`,
  ].filter(Boolean).join("\n");
  const analysis = await analyzeQuoteScope(context, dependencies);
  const reviewDecision = decideClaudeReview(input.scope, analysis);
  const review = reviewDecision.required
    ? await reviewQuoteAnalysis(input.scope, analysis, dependencies?.callReviewer
      ? { callReviewer: dependencies.callReviewer, now: dependencies.now }
      : undefined)
    : null;
  const rateMap = new Map(profile.rates.filter(rate => rate.active !== false).map(rate => [rate.category, rate]));
  const lines = analysis.items.map(item => {
    const rate = rateMap.get(item.category);
    if (!rate) throw new Error(`pricing_category_unavailable:${item.category}`);
    return lineFromRate(item, rate);
  });
  const calculation = calculateQuote(lines, profile);
  const snapshot = { ...profile, capturedAt: new Date().toISOString() };
  const { data, error } = await client.rpc("crm_create_quote_draft", {
    p_contact_id: input.contactId, p_profile_id: profile.id, p_request_key: input.requestKey,
    p_title: analysis.title, p_scope: input.scope, p_currency: profile.currency, p_notes: analysis.notes ?? null,
    p_risks: analysis.risks, p_missing_requirements: analysis.missingRequirements, p_pricing_snapshot: snapshot,
    p_totals: totalsPayload(calculation), p_items: itemsPayload(calculation), p_actor_user_id: input.actorUserId,
    p_review: review, p_review_reasons: reviewDecision.reasons,
  });
  return error ? { ok: false as const, error: error.message } : { ok: true as const, quoteId: data as string };
}

function parseEditableLines(value: unknown): QuoteLineInput[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 100) return null;
  const lines: QuoteLineInput[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>; const category = String(item.category) as PricingCategory; const unit = String(item.unit) as PricingUnit;
    if (!PRICING_CATEGORIES.includes(category) || !units.has(unit) || typeof item.description !== "string" || !item.description.trim()) return null;
    lines.push({
      id: typeof item.id === "string" ? item.id : undefined, category, description: item.description.trim().slice(0, 500), unit,
      quantity: number(item.quantity), hours: number(item.hours), unitRate: number(item.unitRate), directCost: number(item.directCost),
      externalCost: number(item.externalCost), marginPct: number(item.marginPct), notes: typeof item.notes === "string" ? item.notes.slice(0, 1000) : undefined, source: "human",
    });
  }
  return lines;
}

export async function updateQuoteDraft(input: {
  quoteId: string; expectedRevision: number; title: string; scope: string; notes?: string; lines: unknown; actorUserId: string;
}, client: SupabaseClient | null = createServiceClient()) {
  if (!client) return { ok: false as const, error: "database_unavailable" };
  const { data: quote, error: quoteError } = await client.from("crm_quotes").select("id,status,revision,pricing_snapshot").eq("id", input.quoteId).maybeSingle();
  if (quoteError || !quote) return { ok: false as const, error: "quote_not_found" };
  const lines = parseEditableLines(input.lines);
  const snapshot = quote.pricing_snapshot as PricingProfile;
  if (!lines || !Number.isInteger(input.expectedRevision) || input.expectedRevision < 1 || !input.title.trim() || !input.scope.trim() || !snapshot || !Number.isFinite(snapshot.contingencyPct) || !Number.isFinite(snapshot.taxPct)) return { ok: false as const, error: "invalid_quote" };
  const calculation = calculateQuote(lines, snapshot);
  const { data, error } = await client.rpc("crm_update_quote_draft", {
    p_quote_id: input.quoteId, p_expected_revision: input.expectedRevision, p_title: input.title.trim().slice(0, 200),
    p_scope: input.scope.trim().slice(0, 10000), p_notes: input.notes?.trim().slice(0, 3000) ?? null,
    p_totals: totalsPayload(calculation), p_items: itemsPayload(calculation), p_actor_user_id: input.actorUserId,
  });
  return error ? { ok: false as const, error: error.message } : { ok: true as const, revision: data as number, calculation };
}

export async function getQuoteDrafts(client: SupabaseClient | null = createServiceClient()) {
  if (!client) return [];
  const { data } = await client.from("crm_quotes").select("id,contact_id,title,status,currency,total,revision,version,parent_quote_id,approved_at,created_at,updated_at,whatsapp_leads(nombre_contacto,nombre_empresa,numero,lifecycle,stage)").order("updated_at", { ascending: false }).limit(500);
  return data ?? [];
}

export async function getQuoteDraft(id: string, client: SupabaseClient | null = createServiceClient()) {
  if (!client) return null;
  const { data: quote } = await client.from("crm_quotes").select("id,contact_id,status,title,scope,currency,notes,risks,missing_requirements,pricing_snapshot,direct_cost,external_cost,margin_amount,contingency_amount,subtotal,tax_amount,total,revision,version,parent_quote_id,approved_at,approved_by,created_at,updated_at,whatsapp_leads(nombre_contacto,nombre_empresa,numero,lifecycle,stage)").eq("id", id).maybeSingle();
  if (!quote) return null;
  const [itemsResult, reviewResult, versionsResult] = await Promise.all([
    client.from("crm_quote_items").select("id,sort_order,category,description,unit,quantity,hours,unit_rate,direct_cost,external_cost,margin_pct,margin_amount,line_subtotal,notes,source").eq("quote_id", id).order("sort_order"),
    client.from("crm_quote_reviews").select("findings,risks,missing_requirements,recommendations,reviewer_provider,reviewed_at,trigger_reasons,quote_revision").eq("quote_id", id).order("reviewed_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("crm_quote_versions").select("id,version,approved_at,approved_by,total,snapshot").eq("root_quote_id", quote.parent_quote_id ?? quote.id).order("version", { ascending: false }),
  ]);
  return { ...quote, items: itemsResult.data ?? [], review: reviewResult.data ?? null, approved_versions: versionsResult.data ?? [] };
}

function storedLines(items: Array<Record<string, unknown>>): QuoteLineInput[] {
  const parsed = parseEditableLines(items.map(item => ({
    ...item, unitRate: item.unit_rate, directCost: item.direct_cost, externalCost: item.external_cost, marginPct: item.margin_pct,
  })));
  if (!parsed) throw new Error("invalid_stored_quote_items");
  return parsed;
}

export function buildApprovedSnapshot(input: {
  quote: Record<string, unknown>; items: Array<Record<string, unknown>>; review: Record<string, unknown> | null;
  calculation: ReturnType<typeof calculateQuote>; approvedBy: string; approvedAt: string;
}) {
  return {
    quoteId: input.quote.id, contactId: input.quote.contact_id, version: input.quote.version,
    title: input.quote.title, scope: input.quote.scope, notes: input.quote.notes, currency: input.quote.currency,
    items: itemsPayload(input.calculation), pricing: input.quote.pricing_snapshot,
    totals: totalsPayload(input.calculation), review: input.review,
    approvedAt: input.approvedAt, approvedBy: input.approvedBy,
  };
}

export async function approveQuote(input: { quoteId: string; expectedRevision: number; actorUserId: string }, client: SupabaseClient | null = createServiceClient()) {
  if (!client) return { ok: false as const, error: "database_unavailable" };
  const { data: quote } = await client.from("crm_quotes").select("*").eq("id", input.quoteId).maybeSingle();
  if (!quote) return { ok: false as const, error: "quote_not_found" };
  if (quote.status !== "draft") return { ok: false as const, error: "quote_not_approvable" };
  if (Number(quote.revision) !== input.expectedRevision) return { ok: false as const, error: "quote_revision_conflict" };
  const [itemsResult, reviewResult] = await Promise.all([
    client.from("crm_quote_items").select("*").eq("quote_id", input.quoteId).order("sort_order"),
    client.from("crm_quote_reviews").select("*").eq("quote_id", input.quoteId).order("reviewed_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (itemsResult.error || !itemsResult.data?.length) return { ok: false as const, error: "quote_items_not_found" };
  const calculation = calculateQuote(storedLines(itemsResult.data as Array<Record<string, unknown>>), quote.pricing_snapshot as PricingProfile);
  const approvedAt = new Date().toISOString();
  const snapshot = buildApprovedSnapshot({ quote, items: itemsResult.data as Array<Record<string, unknown>>, review: reviewResult.data as Record<string, unknown> | null, calculation, approvedBy: input.actorUserId, approvedAt });
  const { data, error } = await client.rpc("crm_approve_quote", {
    p_quote_id: input.quoteId, p_expected_revision: input.expectedRevision, p_actor_user_id: input.actorUserId,
    p_approved_at: approvedAt, p_totals: totalsPayload(calculation), p_snapshot: snapshot,
  });
  return error ? { ok: false as const, error: error.message } : { ok: true as const, versionId: data as string, calculation };
}

export async function createQuoteRevision(input: { quoteId: string; actorUserId: string }, client: SupabaseClient | null = createServiceClient()) {
  if (!client) return { ok: false as const, error: "database_unavailable" };
  const { data, error } = await client.rpc("crm_create_quote_revision", { p_quote_id: input.quoteId, p_actor_user_id: input.actorUserId });
  return error ? { ok: false as const, error: error.message } : { ok: true as const, quoteId: data as string };
}
