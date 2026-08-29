import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";
import { unarchiveLead } from "@/lib/crm/leads";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token || !(await verifyAdminToken(token))) return NextResponse.json({}, { status: 401 });
  const { id } = await params;
  const result = await unarchiveLead({ contactId: id, actorUserId: process.env.ADMIN_ACTOR || "admin" });
  if (!result.ok) {
    const status = result.error === "contact_not_found_or_not_archived" ? 404 : result.error === "database_unavailable" ? 503 : 500;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
