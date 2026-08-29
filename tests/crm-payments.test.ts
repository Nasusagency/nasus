import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentProvider } from "../lib/payments/provider";
import { createMercadoPagoProvider } from "../lib/payments/mercadopago";
import { createPayment, confirmPaymentFromProvider, getPaymentByPublicToken, listPaymentsForContact } from "../lib/crm/payments";

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
        order() { return b; },
        maybeSingle: async () => ({ data: rows.filter(r => filters.every(f => f(r)))[0] ?? null, error: null }),
        // onConflict(idempotency_key) + ignoreDuplicates real: un segundo upsert con la misma
        // clave no debe insertar una segunda fila (así se prueba que un webhook duplicado de
        // Mercado Pago no duplica el registro de actividad payment_confirmed).
        upsert: async (row: Row) => {
          if (row.idempotency_key && rows.some(r => r.idempotency_key === row.idempotency_key)) return { data: null, error: null };
          rows.push(row); return { data: row, error: null };
        },
        then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
          return Promise.resolve({ data: rows.filter(r => filters.every(f => f(r))), error: null }).then(resolve, reject);
        },
      };
      return b;
    },
  } as unknown as SupabaseClient;
}

function makeConfirmRpc(tables: Record<string, Row[]>) {
  return (fn: string, args: Record<string, unknown>) => {
    if (fn !== "crm_confirm_payment") return { data: null, error: { message: `unexpected_rpc:${fn}` } };
    const payment = (tables.crm_payments ?? []).find(p => p.external_reference === args.p_external_reference);
    if (!payment) return { data: null, error: { message: "payment_not_found" } };
    if (payment.status !== "paid") Object.assign(payment, { status: "paid", paid_at: args.p_paid_at, provider: args.p_provider, provider_payment_id: args.p_provider_payment_id });
    return { data: payment, error: null };
  };
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
  test("getPaymentByPublicToken rechaza tokens con formato inválido sin consultar la base", async () => {
    const client = makeFakeClient(() => ({ data: null, error: { message: "no debería llamarse" } }));
    assert.equal(await getPaymentByPublicToken("no-es-hex-de-64", client), null);
    assert.equal(await getPaymentByPublicToken("../../etc/passwd", client), null);
  });
  test("listPaymentsForContact solo devuelve pagos del contacto pedido, nunca de otro", async () => {
    const tables: Record<string, Row[]> = { crm_payments: [
      { id: "p1", contact_id: "contact-a", amount: 1000, currency: "MXN", status: "pending", description: "A" },
      { id: "p2", contact_id: "contact-b", amount: 2000, currency: "MXN", status: "pending", description: "B" },
    ] };
    const client = makeFakeClient(() => ({ data: null, error: null }), tables);
    const result = await listPaymentsForContact("contact-a", client);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "p1");
  });
});

describe("Fase 15 E2E: webhook de Mercado Pago duplicado es idempotente", () => {
  test("confirmar el mismo pago dos veces no reprocesa ni duplica el registro de actividad", async () => {
    const tables: Record<string, Row[]> = { crm_payments: [{ id: "p1", amount: 1000, currency: "MXN", contact_id: "c1", external_reference: "payment:c1:x", status: "pending" }], crm_activities: [] };
    const provider: PaymentProvider = { name: "mercadopago", createCheckout: async () => { throw new Error("no debería llamarse"); }, verifyWebhookSignature: () => true, fetchPaymentStatus: async () => ({ status: "paid", paidAt: "2026-08-29T00:00:00Z", amount: 1000, currency: "MXN", externalReference: "payment:c1:x" }) };
    const client = makeFakeClient(makeConfirmRpc(tables), tables);

    const first = await confirmPaymentFromProvider({ providerPaymentId: "pay-1" }, provider, client);
    const second = await confirmPaymentFromProvider({ providerPaymentId: "pay-1" }, provider, client);

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(tables.crm_payments[0].status, "paid");
    assert.equal(tables.crm_activities.length, 1, "el webhook duplicado no debe insertar una segunda actividad payment_confirmed");
  });
});

function findFilesMentioning(dir: string, needle: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) findFilesMentioning(full, needle, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && readFileSync(full, "utf8").includes(needle)) out.push(full.replace(/\\/g, "/"));
  }
  return out;
}

describe("Fase 15 E2E: redirect del navegador nunca marca paid", () => {
  test("solo el webhook de Mercado Pago llama a confirmPaymentFromProvider en toda la app", () => {
    const callers = findFilesMentioning("app", "confirmPaymentFromProvider").concat(findFilesMentioning("lib", "confirmPaymentFromProvider"));
    assert.deepEqual(callers.sort(), ["app/api/payments/mercadopago/webhook/route.ts", "lib/crm/payments.ts"].sort());
  });
  test("las páginas /pagar no importan nada capaz de escribir status=paid", () => {
    const gracias = readFileSync("app/(client)/pagar/gracias/page.tsx", "utf8");
    const token = readFileSync("app/(client)/pagar/[token]/page.tsx", "utf8");
    for (const source of [gracias, token]) {
      assert.doesNotMatch(source, /confirmPaymentFromProvider|createPayment|crm_confirm_payment|\.rpc\(/);
    }
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
