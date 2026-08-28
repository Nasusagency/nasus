import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token || !(await verifyAdminToken(token))) return NextResponse.json({}, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { proposalId?: string };
  const client = createServiceClient();
  if (!client) return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  const { data, error } = await client.rpc("crm_convert_contact", {
    p_contact_id: id,
    p_actor_user_id: process.env.ADMIN_ACTOR || "admin",
    p_proposal_id: body.proposalId ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes("contact_not_found") ? 404 : 500 });
  return NextResponse.json({ ok: true, contact: data });
}
