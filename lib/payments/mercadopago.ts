import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider, PaymentStatus } from "./provider";

type Fetcher = typeof fetch;
const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`mercadopago_config_missing:${name}`); return value; };

// https://www.mercadopago.com.mx/developers/es/docs/checkout-pro/additional-content/notifications/webhooks
// manifest = `id:{data.id};request-id:{x-request-id};ts:{ts};` firmado con HMAC-SHA256 y el secret del webhook.
function verifySignature(input: { headers: Headers; dataId: string }): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return false;
  const signature = input.headers.get("x-signature");
  const requestId = input.headers.get("x-request-id");
  if (!signature || !requestId) return false;
  let ts = "", hash = "";
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=").map(s => s.trim());
    if (key === "ts") ts = value;
    if (key === "v1") hash = value;
  }
  if (!ts || !hash) return false;
  const manifest = `id:${input.dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected, "hex"), b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function mapStatus(mpStatus: string): PaymentStatus {
  if (mpStatus === "approved") return "paid";
  if (mpStatus === "rejected") return "failed";
  if (mpStatus === "cancelled") return "cancelled";
  if (mpStatus === "refunded" || mpStatus === "charged_back") return "refunded";
  return "pending";
}

export function createMercadoPagoProvider(fetcher: Fetcher = fetch): PaymentProvider {
  return {
    name: "mercadopago",
    async createCheckout(input) {
      const token = required("MERCADOPAGO_ACCESS_TOKEN");
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nasus.lat";
      const res = await fetcher("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          items: [{ title: input.description, quantity: 1, unit_price: input.amount, currency_id: input.currency }],
          external_reference: input.externalReference,
          notification_url: `${siteUrl}/api/payments/mercadopago/webhook`,
          back_urls: { success: `${siteUrl}/pagar/gracias`, pending: `${siteUrl}/pagar/gracias`, failure: `${siteUrl}/pagar/gracias` },
          ...(input.payerEmail ? { payer: { email: input.payerEmail } } : {}),
        }),
      });
      if (!res.ok) throw new Error(`mercadopago_checkout_failed:${res.status}`);
      const data = await res.json() as { id?: string; init_point?: string };
      if (!data.id || !data.init_point) throw new Error("mercadopago_missing_provider_reference");
      return { providerPaymentId: data.id, paymentUrl: data.init_point };
    },
    verifyWebhookSignature: verifySignature,
    async fetchPaymentStatus(providerPaymentId) {
      const token = required("MERCADOPAGO_ACCESS_TOKEN");
      const res = await fetcher(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(providerPaymentId)}`, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`mercadopago_payment_lookup_failed:${res.status}`);
      const data = await res.json() as { status?: string; date_approved?: string | null; transaction_amount?: number; currency_id?: string; external_reference?: string | null };
      if (!data.status) throw new Error("mercadopago_missing_status");
      return { status: mapStatus(data.status), paidAt: data.date_approved ?? null, amount: Number(data.transaction_amount ?? 0), currency: String(data.currency_id ?? "MXN"), externalReference: data.external_reference ?? null };
    },
  };
}
