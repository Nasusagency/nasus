import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";
import { createPayment } from "@/lib/crm/payments";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token || !await verifyAdminToken(token)) return NextResponse.json({}, { status: 401 });
  const body = await req.json().catch(() => null) as {
    contactId?: string; proposalId?: string; quoteId?: string; quoteVersionId?: string;
    amount?: number; currency?: string; description?: string; dueAt?: string; payerEmail?: string;
  } | null;
  if (!body?.contactId || !body.amount || !body.currency || !body.description) return NextResponse.json({ error: "datos_incompletos" }, { status: 400 });
  const result = await createPayment({
    contactId: body.contactId, proposalId: body.proposalId ?? null, quoteId: body.quoteId ?? null, quoteVersionId: body.quoteVersionId ?? null,
    amount: body.amount, currency: body.currency, description: body.description, dueAt: body.dueAt ?? null, payerEmail: body.payerEmail ?? null,
    actorUserId: process.env.ADMIN_ACTOR || "admin",
  });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
