import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";
import { markCrmProposalSent } from "@/lib/crm/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token || !(await verifyAdminToken(token))) return NextResponse.json({}, { status: 401 });
  const { deliveryId } = await req.json() as { deliveryId?: string };
  if (!deliveryId) return NextResponse.json({ error: "deliveryId requerido; no se marca sent antes de confirmar el envío real." }, { status: 400 });
  const { id } = await params;
  const result = await markCrmProposalSent({ proposalId: id, deliveryId, actorUserId: process.env.ADMIN_ACTOR || "admin" });
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
