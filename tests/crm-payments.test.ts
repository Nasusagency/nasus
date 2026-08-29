import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentProvider } from "../lib/payments/provider";
import { createMercadoPagoProvider } from "../lib/payments/mercadopago";
import { createPayment, confirmPaymentFromProvider } from "../lib/crm/payments";

type Row = Record<string, unknown>;
function makeFakeClient(rpcImpl: (fn: string, args: Record<string, unknown>) => { data: unknown; error: { message: string } | null }, tables: Record<string, Row[]> = {}) {
  return {
    rpc: async (fn: string, args: Record<string, unknown>) => rpcImpl(fn, args),
    from(table: string) {
      const rows = tables[table] || (tables[table] = []);
      const filters: Array<(r: Row) => boolean> = [];
      const b = {
        select() { return b; },
        eq(col: string, val: unknown) { filters.push(r => r[col] === val); return b; },
        maybeSingle: async () => ({ data: rows.filter(r => filters.every(f => f(r)))[0] ?? null, error: null }),
        upsert: async (row: Row) => { rows.push(row); return { data: row, error: null }; },
      };
      return b;
    },
  } as unknown as SupabaseClient;
}

describe("Fase 8: crm_payments", () => {
  test("createPayment rechaza monto invalido", async () => {
    const result = await createPayment({ contactId: "c1", amount: 0, currency: "MXN", description: "x", actorUserId: "admin" }, {} as PaymentProvider, makeFakeClient(() => ({ data: null, error: null })));
    assert.deepEqual(result, { ok: false, error: "invalid_amount" });
  });
  test("createPayment crea checkout y adjunta la referencia del proveedor", async () => {
    let checkoutCalls = 0;
    const provider: PaymentProvider = { name: "mercadopago", createCheckout: async () => { checkoutCalls++; return { providerPaymentId: "pref-1", paymentUrl: "https://mp/x" }; }, verifyWebhookSignature: () => true, fetchPaymentStatus: async () => ({ status: "pending", paidAt: null, amount: 0, currency: "MXN", externalReference: null }) };
    const client = makeFakeClient((fn, args) => {
      if (fn === "crm_create_payment") return { data: { id: "p1", external_reference: args.p_external_reference, amount: args.p_amount, currency: args.p_currency, description: args.p_description, payment_url: null }, error: null };
      if (fn === "crm_attach_payment_checkout") return { data: null, error: null };
      return { data: null, error: { message: "unexpected_rpc" } };
    });
    const result = await createPayment({ contactId: "c1", amount: 1000, currency: "MXN", description: "Anticipo", actorUserId: "admin" }, provider, client);
    assert.equal(result.ok, true);
    assert.equal(checkoutCalls, 1);
    if (result.ok) assert.equal(result.payment.payment_url, "https://mp/x");
  });
  test("createPayment es idempotente: si ya existe checkout, no llama al proveedor otra vez", async () => {
    let checkoutCalls = 0;
    const provider: PaymentProvider = { name: "mercadopago", createCheckout: async () => { checkoutCalls++; return { providerPaymentId: "pref-2", paymentUrl: "https://mp/y" }; }, verifyWebhookSignature: () => true, fetchPaymentStatus: async () => ({ status: "pending", paidAt: null, amount: 0, currency: "MXN", externalReference: null }) };
    const client = makeFakeClient((fn) => {
      if (fn === "crm_create_payment") return { data: { id: "p1", external_reference: "payment:c1:existing", amount: 1000, currency: "MXN", description: "Anticipo", payment_url: "https://mp/existing" }, error: null };
      return { data: null, error: { message: "unexpected_rpc" } };
    });
    const result = await createPayment({ contactId: "c1", amount: 1000, currency: "MXN", description: "Anticipo", actorUserId: "admin" }, provider, client);
    assert.equal(result.ok, true);
    assert.equal(checkoutCalls, 0);
    if (result.ok) assert.equal(result.payment.payment_url, "https://mp/existing");
  });
  test("confirmPaymentFromProvider ignora estados que no son paid sin tocar la base", async () => {
    const provider: PaymentProvider = { name: "mercadopago", createCheckout: async () => { throw new Error("no debería llamarse"); }, verifyWebhookSignature: () => true, fetchPaymentStatus: async () => ({ status: "pending", paidAt: null, amount: 1000, currency: "MXN", externalReference: "payment:c1:x" }) };
    const client = makeFakeClient(() => ({ data: null, error: { message: "no debería llamarse" } }));
    const result = await confirmPaymentFromProvider({ providerPaymentId: "pay-1" }, provider, client);
    assert.deepEqual(result, { ok: true, ignored: true, status: "pending" });
  });
  test("confirmPaymentFromProvider rechaza si el monto no coincide con el registrado", async () => {
    const provider: PaymentProvider = { name: "mercadopago", createCheckout: async () => { throw new Error("no debería llamarse"); }, verifyWebhookSignature: () => true, fetchPaymentStatus: async () => ({ status: "paid", paidAt: "2026-08-29T00:00:00Z", amount: 500, currency: "MXN", externalReference: "payment:c1:x" }) };
    const client = makeFakeClient(() => ({ data: null, error: { message: "no debería llamarse" } }), { crm_payments: [{ id: "p1", amount: 1000, currency: "MXN", contact_id: "c1", external_reference: "payment:c1:x" }] });
    const result = await confirmPaymentFromProvider({ providerPaymentId: "pay-1" }, provider, client);
    assert.deepEqual(result, { ok: false, error: "payment_amount_mismatch" });
  });
  test("confirmPaymentFromProvider confirma un pago paid que coincide y registra actividad", async () => {
    const provider: PaymentProvider = { name: "mercadopago", createCheckout: async () => { throw new Error("no debería llamarse"); }, verifyWebhookSignature: () => true, fetchPaymentStatus: async () => ({ status: "paid", paidAt: "2026-08-29T00:00:00Z", amount: 1000, currency: "MXN", externalReference: "payment:c1:x" }) };
    let confirmCalled = false;
    const client = makeFakeClient((fn, args) => {
      if (fn === "crm_confirm_payment") { confirmCalled = true; return { data: { id: "p1", status: "paid", external_reference: args.p_external_reference }, error: null }; }
      return { data: null, error: { message: "unexpected_rpc" } };
    }, { crm_payments: [{ id: "p1", amount: 1000, currency: "MXN", contact_id: "c1", external_reference: "payment:c1:x" }] });
    const result = await confirmPaymentFromProvider({ providerPaymentId: "pay-1" }, provider, client);
    assert.equal(result.ok, true);
    assert.equal(confirmCalled, true);
  });
});

describe("Fase 9: Mercado Pago", () => {
  test("verifyWebhookSignature acepta una firma válida calculada con el secret configurado", () => {
    const old = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    process.env.MERCADOPAGO_WEBHOOK_SECRET = "test-secret";
    const dataId = "123456";
    const requestId = "req-1";
    const ts = "1700000000000";
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const hash = createHmac("sha256", "test-secret").update(manifest).digest("hex");
    const headers = new Headers({ "x-signature": `ts=${ts},v1=${hash}`, "x-request-id": requestId });
    const provider = createMercadoPagoProvider();
    assert.equal(provider.verifyWebhookSignature({ headers, dataId }), true);
    process.env.MERCADOPAGO_WEBHOOK_SECRET = old;
  });
  test("verifyWebhookSignature rechaza una firma alterada", () => {
    const old = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    process.env.MERCADOPAGO_WEBHOOK_SECRET = "test-secret";
    const headers = new Headers({ "x-signature": "ts=1700000000000,v1=deadbeef", "x-request-id": "req-1" });
    const provider = createMercadoPagoProvider();
    assert.equal(provider.verifyWebhookSignature({ headers, dataId: "123456" }), false);
    process.env.MERCADOPAGO_WEBHOOK_SECRET = old;
  });
  test("verifyWebhookSignature rechaza si no hay secret configurado (nunca falla abierto)", () => {
    const old = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const headers = new Headers({ "x-signature": "ts=1,v1=abc", "x-request-id": "req-1" });
    const provider = createMercadoPagoProvider();
    assert.equal(provider.verifyWebhookSignature({ headers, dataId: "1" }), false);
    process.env.MERCADOPAGO_WEBHOOK_SECRET = old;
  });
  test("el webhook nunca confía en el body del navegador para marcar paid", () => {
    const s = readFileSync("app/api/payments/mercadopago/webhook/route.ts", "utf8");
    assert.match(s, /verifyWebhookSignature/);
    assert.match(s, /confirmPaymentFromProvider/);
  });
});
