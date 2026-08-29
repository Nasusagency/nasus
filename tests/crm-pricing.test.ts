import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { analyzeQuoteScope } from "../lib/crm/quote-agent";
import { calculateQuote, lineFromRate, PricingValidationError, type QuoteLineInput } from "../lib/crm/pricing";
import type { LLMResponse } from "../lib/llm/provider";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createQuoteDraftFromScope } from "../lib/crm/quotes";

const labor: QuoteLineInput = { category: "backend", description: "Backend", unit: "hour", quantity: 0, hours: 10, unitRate: 1000, directCost: 0, externalCost: 0, marginPct: 20 };

describe("motor determinista de pricing", () => {
  test("crea un cálculo válido desde líneas de alcance", () => {
    const result = calculateQuote([labor], { contingencyPct: 10, taxPct: 16 });
    assert.equal(result.directCost, 10_000);
    assert.equal(result.marginAmount, 2_000);
    assert.equal(result.contingencyAmount, 1_200);
    assert.equal(result.subtotal, 13_200);
    assert.equal(result.taxAmount, 2_112);
    assert.equal(result.total, 15_312);
  });

  test("margen se calcula sobre costo laboral, directo y externo", () => {
    const result = calculateQuote([{ ...labor, hours: 2, directCost: 500, externalCost: 1_500, marginPct: 25 }], { contingencyPct: 0, taxPct: 0 });
    assert.equal(result.lines[0].laborCost, 2_000);
    assert.equal(result.lines[0].marginAmount, 1_000);
    assert.equal(result.total, 5_000);
  });

  test("costo externo se conserva separado en agregados", () => {
    const result = calculateQuote([{ ...labor, hours: 0, unitRate: 0, externalCost: 3_250, marginPct: 0 }], { contingencyPct: 0, taxPct: 0 });
    assert.equal(result.directCost, 0);
    assert.equal(result.externalCost, 3_250);
    assert.equal(result.total, 3_250);
  });

  test("edición manual y recálculo son puros y reproducibles", () => {
    const original = calculateQuote([labor], { contingencyPct: 0, taxPct: 0 });
    const edited = calculateQuote([{ ...labor, hours: 12, marginPct: 25 }], { contingencyPct: 0, taxPct: 0 });
    const repeated = calculateQuote([{ ...labor, hours: 12, marginPct: 25 }], { contingencyPct: 0, taxPct: 0 });
    assert.equal(original.total, 12_000);
    assert.equal(edited.total, 15_000);
    assert.deepEqual(edited, repeated);
  });

  test("una categoría sin tarifa configurada bloquea el draft", () => {
    assert.throws(() => lineFromRate({ category: "qa", description: "QA", estimatedHours: 4 }, { category: "qa", label: "QA", unit: "hour", unitLabel: "hora", rate: null, marginPct: 10 }), PricingValidationError);
  });

  test("rechaza importes negativos o porcentajes fuera de rango", () => {
    assert.throws(() => calculateQuote([{ ...labor, externalCost: -1 }], { contingencyPct: 0, taxPct: 0 }), PricingValidationError);
    assert.throws(() => calculateQuote([labor], { contingencyPct: 101, taxPct: 0 }), PricingValidationError);
  });
});

describe("frontera LLM del quote draft", () => {
  test("estructura alcance y descarta amount final inyectado", async () => {
    let exposedMoneyFields = false;
    const response: LLMResponse = { content: [{ type: "tool_use", id: "scope", name: "estructurar_alcance_cotizacion", input: { title: "CRM", items: [{ category: "backend", description: "API", estimated_hours: 20, amount: 1, total: 1 }], missing_requirements: ["Volumen"], risks: ["API externa"], total: 1, tax: 0 } }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: "tool_use", usedProvider: "groq" };
    const analysis = await analyzeQuoteScope("Construir CRM", { callAgent: async params => { const schema = params.tools?.[0].input_schema.properties ?? {}; exposedMoneyFields = ["amount", "total", "tax", "unit_rate", "margin"].some(field => field in schema); return response; } });
    assert.equal(exposedMoneyFields, false);
    assert.equal("total" in analysis, false);
    assert.equal("amount" in analysis.items[0], false);
    assert.equal(analysis.items[0].estimatedHours, 20);
  });

  test("SQL liga el quote al contacto server-side y no altera CRM comercial", () => {
    const sql = readFileSync("supabase/migrations/0012_crm_pricing_quotes.sql", "utf8");
    assert.match(sql, /contact_id uuid not null references public\.whatsapp_leads/);
    assert.match(sql, /p_contact_id uuid/);
    assert.doesNotMatch(sql, /update\s+whatsapp_leads/i);
    assert.doesNotMatch(sql, /acquisition_event/i);
    assert.match(sql, /quote_draft_created/);
    assert.match(sql, /quote_edited/);
    assert.match(sql, /quote_recalculated/);
  });

  test("servicio liga el draft al contactId confiable, nunca al sugerido por LLM", async () => {
    const contact = { id: "trusted-contact", nombre_contacto: "Juan", nombre_empresa: "Clínica", sector: "Salud", resumen: "CRM", problema_descrito: "Citas", lifecycle: "lead", stage: "opportunity" };
    let rpcArgs: Record<string, unknown> | undefined;
    const tables: Record<string, { data: unknown; error: null }> = {
      crm_pricing_profiles: { data: { id: "profile-1", name: "Nasus", currency: "MXN", contingency_pct: 10, tax_pct: 16, tax_label: "IVA", fiscal_config: {} }, error: null },
      crm_pricing_rates: { data: [{ category: "backend", label: "Backend", unit: "hour", unit_label: "hora", rate: 1000, margin_pct: 20, active: true, sort_order: 10 }], error: null },
      whatsapp_leads: { data: contact, error: null },
    };
    const fake = {
      from(table: string) {
        const result = tables[table];
        const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => result, order: async () => result };
        return chain;
      },
      async rpc(_name: string, args: Record<string, unknown>) { rpcArgs = args; return { data: "quote-1", error: null }; },
    } as unknown as SupabaseClient;
    const llm: LLMResponse = { content: [{ type: "tool_use", id: "scope", name: "estructurar_alcance_cotizacion", input: { title: "CRM", contact_id: "evil-contact", total: 1, items: [{ category: "backend", description: "API", estimated_hours: 10 }], missing_requirements: [], risks: [] } }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: "tool_use", usedProvider: "groq" };
    const result = await createQuoteDraftFromScope({ contactId: "trusted-contact", scope: "Construir API para gestionar las citas", requestKey: "request-1", actorUserId: "admin" }, { callAgent: async () => llm }, fake);
    assert.deepEqual(result, { ok: true, quoteId: "quote-1" });
    assert.equal(rpcArgs?.p_contact_id, "trusted-contact");
    assert.equal("contact_id" in ((rpcArgs?.p_items as Array<Record<string, unknown>>)[0]), false);
    assert.deepEqual(contact, { id: "trusted-contact", nombre_contacto: "Juan", nombre_empresa: "Clínica", sector: "Salud", resumen: "CRM", problema_descrito: "Citas", lifecycle: "lead", stage: "opportunity" });
  });
});
