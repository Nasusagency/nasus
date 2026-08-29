import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LLMResponse } from "../lib/llm/provider";
import { decideClaudeReview, reviewQuoteAnalysis } from "../lib/crm/quote-reviewer";
import { approveQuote, buildApprovedSnapshot } from "../lib/crm/quotes";
import { calculateQuote, type PricingProfile, type QuoteLineInput } from "../lib/crm/pricing";

const profile: PricingProfile = { id: "pricing-1", name: "Nasus", currency: "MXN", contingencyPct: 10, taxPct: 16, taxLabel: "IVA", rates: [] };
const line: QuoteLineInput = { category: "backend", description: "API", unit: "hour", quantity: 0, hours: 10, unitRate: 1000, directCost: 0, externalCost: 0, marginPct: 20 };
const analysis = { title: "CRM", items: [{ category: "backend" as const, description: "API", estimatedHours: 10 }], missingRequirements: [], risks: [] };

describe("revisión selectiva Groq + Claude", () => {
  test("quote simple no usa Claude", () => assert.deepEqual(decideClaudeReview("API CRUD bien definida", analysis), { required: false, reasons: [] }));

  test("quote compleja activa Claude por reglas deterministas", () => {
    const decision = decideClaudeReview("Plataforma", { ...analysis, items: Array.from({ length: 6 }, (_, i) => ({ category: "backend" as const, description: `Módulo ${i}`, estimatedHours: 15 })) });
    assert.equal(decision.required, true);
    assert.ok(decision.reasons.includes("cotizacion_compleja"));
    assert.ok(decision.reasons.includes("horas_elevadas"));
  });

  test("reviewer detecta omisión y la salida no contiene campos de precio", async () => {
    let schema = {} as Record<string, unknown>;
    const response: LLMResponse = { content: [{ type: "tool_use", id: "review", name: "revisar_cotizacion_tecnica", input: { findings: ["Falta definir recuperación"], risks: [], missing_requirements: ["RTO/RPO"], recommendations: ["Agregar backup"], total: 1, tax: 0, unit_rate: 1 } }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: "tool_use", usedProvider: "claude" };
    const review = await reviewQuoteAnalysis("Sistema crítico", analysis, { callReviewer: async params => { schema = params.tools?.[0].input_schema.properties ?? {}; return response; }, now: () => new Date("2026-01-01T00:00:00Z") });
    assert.deepEqual(review.missingRequirements, ["RTO/RPO"]);
    assert.equal("total" in review, false);
    assert.equal("total" in schema, false);
    assert.equal(review.reviewerProvider, "claude");
  });
});

describe("aprobación humana e historial inmutable", () => {
  test("snapshot contiene alcance, items, pricing, revisión y totales calculados", () => {
    const calculation = calculateQuote([line], profile);
    const snapshot = buildApprovedSnapshot({ quote: { id: "q1", contact_id: "c1", version: 1, title: "CRM", scope: "API", notes: null, currency: "MXN", pricing_snapshot: profile }, items: [], review: { findings: ["ok"] }, calculation, approvedBy: "admin", approvedAt: "2026-01-01T00:00:00Z" });
    assert.equal(snapshot.contactId, "c1");
    assert.equal(snapshot.totals.total, 15312);
    assert.equal(snapshot.items[0].hours, 10);
    assert.deepEqual(snapshot.review, { findings: ["ok"] });
  });

  test("aprobación recalcula server-side e ignora cualquier total del navegador", async () => {
    const quote = { id: "q1", contact_id: "c1", status: "draft", revision: 3, version: 1, title: "CRM", scope: "API", notes: null, currency: "MXN", pricing_snapshot: profile };
    const item = { category: "backend", description: "API", unit: "hour", quantity: 0, hours: 10, unit_rate: 1000, direct_cost: 0, external_cost: 0, margin_pct: 20 };
    let rpcArgs: Record<string, unknown> | undefined;
    const results: Record<string, { data: unknown; error: null }> = { crm_quotes: { data: quote, error: null }, crm_quote_items: { data: [item], error: null }, crm_quote_reviews: { data: null, error: null } };
    const fake = { from(table: string) { const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, maybeSingle: async () => results[table], then: (resolve: (value: unknown) => unknown) => Promise.resolve(results[table]).then(resolve) }; return chain; }, async rpc(_name: string, args: Record<string, unknown>) { rpcArgs = args; return { data: "version-1", error: null }; } } as unknown as SupabaseClient;
    const result = await approveQuote({ quoteId: "q1", expectedRevision: 3, actorUserId: "admin" }, fake);
    assert.equal(result.ok, true);
    assert.equal((rpcArgs?.p_totals as Record<string, unknown>).total, 15312);
    assert.equal((rpcArgs?.p_snapshot as Record<string, unknown>).contactId, "c1");
  });

  test("optimistic locking rechaza una revisión desactualizada antes del RPC", async () => {
    let called = false;
    const fake = { from() { const result = { data: { id: "q1", status: "draft", revision: 4 }, error: null }; const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => result }; return chain; }, async rpc() { called = true; return { data: null, error: null }; } } as unknown as SupabaseClient;
    assert.deepEqual(await approveQuote({ quoteId: "q1", expectedRevision: 3, actorUserId: "admin" }, fake), { ok: false, error: "quote_revision_conflict" });
    assert.equal(called, false);
  });

  test("SQL conserva aprobada, crea nueva versión y registra activities", () => {
    const sql = readFileSync("supabase/migrations/0013_quote_review_approval.sql", "utf8");
    assert.match(sql, /crm_guard_approved_quote/);
    assert.match(sql, /approved_quote_immutable/);
    assert.match(sql, /insert into crm_quote_versions/);
    assert.match(sql, /source\.status <> 'approved'/);
    assert.match(sql, /quote_reviewed/);
    assert.match(sql, /quote_approved/);
    assert.match(sql, /quote_revision_created/);
    assert.doesNotMatch(sql, /update\s+whatsapp_leads/i);
  });

  test("ningún activity insert usa actores fuera del enum crm_actor", () => {
    const sources = [
      ...["0008_crm_lifecycle_activity.sql", "0010_whatsapp_master_agent.sql", "0011_whatsapp_passive_observer.sql", "0012_crm_pricing_quotes.sql", "0013_quote_review_approval.sql", "0014_fix_quote_review_actor.sql"]
        .map(file => readFileSync(`supabase/migrations/${file}`, "utf8")),
      readFileSync("lib/crm/service.ts", "utf8"),
      readFileSync("lib/whatsapp/master-agent.ts", "utf8"),
      readFileSync("lib/whatsapp/passive-observer.ts", "utf8"),
    ].join("\n");
    const sqlActors = sources.split(";")
      .filter(statement => /insert into (?:public\.)?crm_activities/i.test(statement))
      .map(statement => statement.match(/values\s*\(\s*[^,]+,\s*'[^']+',\s*'([^']+)'/i)?.[1])
      .filter((actor): actor is string => Boolean(actor));
    const actors = [...sqlActors, ...[...sources.matchAll(/actor\s*:\s*["']([^"']+)["']/g)].map(match => match[1])];
    assert.ok(actors.length > 0);
    assert.deepEqual([...new Set(actors)].filter(actor => !["groq", "human", "system"].includes(actor)), []);
    assert.doesNotMatch(sources, /actor[^\n]*["']ai["']|values\s*\([^;]*'ai'/i);
  });

  test("quote_reviewed usa system y conserva Claude como reviewer_provider", () => {
    const sql = readFileSync("supabase/migrations/0014_fix_quote_review_actor.sql", "utf8");
    assert.match(sql, /'quote_reviewed','system'/);
    assert.match(sql, /'reviewer_provider',p_review->>'reviewerProvider'/);
    assert.doesNotMatch(sql, /'quote_reviewed','ai'/);
  });

  test("API exige cookie admin y no acepta total para aprobar", () => {
    const route = readFileSync("app/api/admin/quotes/[id]/route.ts", "utf8");
    assert.match(route, /await authorized\(request\)/);
    assert.match(route, /approveQuote\(\{ quoteId, expectedRevision: Number\(body\.expectedRevision\), actorUserId \}\)/);
    assert.equal(route.includes("body.total"), false);
  });
});
