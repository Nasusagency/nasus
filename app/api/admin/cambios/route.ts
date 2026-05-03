import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin/auth";
import { getCambios, saveCambio, type EstadoCambio } from "@/lib/admin/data";

async function auth(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return !!token && (await verifyAdminToken(token));
}

export async function GET(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({}, { status: 401 });
  const slug = req.nextUrl.searchParams.get("cliente") ?? undefined;
  return NextResponse.json(getCambios(slug));
}

export async function POST(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({}, { status: 401 });
  const body = (await req.json()) as {
    clienteSlug: string;
    descripcion: string;
    estado?: EstadoCambio;
    solicitadoPor?: string;
  };
  if (!body.clienteSlug || !body.descripcion) {
    return NextResponse.json({ error: "clienteSlug y descripcion son requeridos." }, { status: 400 });
  }
  const cambio = saveCambio({
    clienteSlug: body.clienteSlug,
    descripcion: body.descripcion,
    estado: body.estado ?? "Pendiente",
    solicitadoPor: body.solicitadoPor,
  });
  return NextResponse.json(cambio, { status: 201 });
}
