import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin/auth";
import { getCrmProposals } from "@/lib/admin/crm-data";
import { createCrmProposal } from "@/lib/crm/service";

async function auth(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return !!token && (await verifyAdminToken(token));
}

export async function GET(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({}, { status: 401 });
  return NextResponse.json(await getCrmProposals());
}

export async function POST(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({}, { status: 401 });
  const body = (await req.json()) as { slug: string; titulo: string; contenido: string; contactId?: string };
  if (!body.slug || !body.titulo || !body.contenido || !body.contactId) {
    return NextResponse.json({ error: "contactId, slug, titulo y contenido son requeridos." }, { status: 400 });
  }
  const result = await createCrmProposal({
    contactId: body.contactId,
    slug: body.slug,
    title: body.titulo,
    content: body.contenido,
    actorUserId: process.env.ADMIN_ACTOR || "admin",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result.proposal, { status: 201 });
}
