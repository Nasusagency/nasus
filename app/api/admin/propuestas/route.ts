import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin/auth";
import { getPropuestas, savePropuesta } from "@/lib/admin/data";

async function auth(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return !!token && (await verifyAdminToken(token));
}

export async function GET(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({}, { status: 401 });
  return NextResponse.json(getPropuestas());
}

export async function POST(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({}, { status: 401 });
  const body = (await req.json()) as { slug: string; titulo: string; contenido: string; clienteSlug?: string };
  if (!body.slug || !body.titulo || !body.contenido) {
    return NextResponse.json({ error: "slug, titulo y contenido son requeridos." }, { status: 400 });
  }
  const p = savePropuesta({
    slug: body.slug,
    titulo: body.titulo,
    contenido: body.contenido,
    clienteSlug: body.clienteSlug,
  });
  return NextResponse.json(p, { status: 201 });
}
