import { NextRequest, NextResponse } from "next/server";
import { createMercadoPagoProvider } from "@/lib/payments/mercadopago";
import { confirmPaymentFromProvider } from "@/lib/crm/payments";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || url.searchParams.get("topic");
  const dataId = url.searchParams.get("data.id") || url.searchParams.get("id");
  await req.text().catch(() => "");
  if (type !== "payment" || !dataId) return NextResponse.json({ ok: true, ignored: true });

  const provider = createMercadoPagoProvider();
  if (!provider.verifyWebhookSignature({ headers: req.headers, dataId })) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  try {
    const result = await confirmPaymentFromProvider({ providerPaymentId: dataId }, provider);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "webhook_processing_failed" }, { status: 400 });
  }
}
