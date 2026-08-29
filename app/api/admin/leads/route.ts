import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";
import { createManualLead, MANUAL_LEAD_STAGES, type ManualLeadStage } from "@/lib/crm/leads";

const ERROR_STATUS: Record<string, number> = {
  invalid_phone: 400,
  duplicate: 409,
  duplicate_archived: 409,
  database_unavailable: 503,
};

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token || !(await verifyAdminToken(token))) return NextResponse.json({}, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    numero?: string;
    nombreContacto?: string;
    nombreEmpresa?: string;
    necesidad?: string;
    stage?: string;
  } | null;
  if (!body?.numero?.trim()) return NextResponse.json({ error: "numero_requerido" }, { status: 400 });

  const stage = MANUAL_LEAD_STAGES.includes(body.stage as ManualLeadStage)
    ? (body.stage as ManualLeadStage)
    : undefined;

  const result = await createManualLead({
    numero: body.numero,
    nombreContacto: body.nombreContacto,
    nombreEmpresa: body.nombreEmpresa,
    necesidad: body.necesidad,
    stage,
    actorUserId: process.env.ADMIN_ACTOR || "admin",
  });

  if (!result.ok) return NextResponse.json(result, { status: ERROR_STATUS[result.error] ?? 500 });
  return NextResponse.json(result, { status: 201 });
}
