import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";

const DECISIONS = new Set(["lost", "former_client", "new_opportunity"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token || !(await verifyAdminToken(token))) return NextResponse.json({}, { status: 401 });
  const body = await req.json().catch(() => ({})) as { decision?: string; requestId?: string };
  if (!body.decision || !DECISIONS.has(body.decision) || !body.requestId) return NextResponse.json({ error: "decision/requestId inválidos" }, { status: 400 });
  const client = createServiceClient();
  if (!client) return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  const { id } = await params;
  const { data, error } = await client.rpc("crm_apply_human_decision", {
    p_contact_id: id,
    p_decision: body.decision,
    p_actor_user_id: process.env.ADMIN_ACTOR || "admin",
    p_idempotency_key: body.requestId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes("contact_not_found") ? 404 : 409 });
  return NextResponse.json({ ok: true, contact: data });
}
