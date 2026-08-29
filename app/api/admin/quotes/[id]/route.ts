import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";
import { getQuoteDraft, updateQuoteDraft } from "@/lib/crm/quotes";

async function authorized(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  return Boolean(token && await verifyAdminToken(token));
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized(request))) return NextResponse.json({}, { status: 401 });
  const quote = await getQuoteDraft((await params).id);
  return quote ? NextResponse.json(quote) : NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized(request))) return NextResponse.json({}, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  try {
    const result = await updateQuoteDraft({ quoteId: (await params).id, expectedRevision: Number(body.expectedRevision), title: String(body.title ?? ""), scope: String(body.scope ?? ""), notes: typeof body.notes === "string" ? body.notes : undefined, lines: body.lines, actorUserId: process.env.ADMIN_ACTOR || "admin" });
    return NextResponse.json(result, { status: result.ok ? 200 : result.error.includes("revision_conflict") ? 409 : 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo recalcular" }, { status: 400 });
  }
}
