import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";
import { createQuoteDraftFromScope } from "@/lib/crm/quotes";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token || !(await verifyAdminToken(token))) return NextResponse.json({}, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const contactId = typeof body?.contactId === "string" ? body.contactId : "";
  const scope = typeof body?.scope === "string" ? body.scope.trim().slice(0, 10000) : "";
  const requestKey = typeof body?.requestKey === "string" ? body.requestKey : "";
  if (!/^[0-9a-f-]{36}$/i.test(contactId) || !scope || scope.length < 10 || !/^[0-9a-f-]{36}$/i.test(requestKey)) return NextResponse.json({ error: "Contacto, alcance o requestId inválido" }, { status: 400 });
  try {
    const result = await createQuoteDraftFromScope({ contactId, scope, requestKey, actorUserId: process.env.ADMIN_ACTOR || "admin" });
    return NextResponse.json(result, { status: result.ok ? 201 : result.error.includes("tarifa") ? 409 : 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear la cotización" }, { status: 400 });
  }
}
