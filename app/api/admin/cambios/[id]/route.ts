import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin/auth";
import { updateCambioEstado, deleteCambio, type EstadoCambio } from "@/lib/admin/data";

async function auth(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return !!token && (await verifyAdminToken(token));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await auth(req))) return NextResponse.json({}, { status: 401 });
  const { id } = await params;
  const { estado } = (await req.json()) as { estado: EstadoCambio };
  const updated = updateCambioEstado(id, estado);
  if (!updated) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await auth(req))) return NextResponse.json({}, { status: 401 });
  const { id } = await params;
  const ok = deleteCambio(id);
  if (!ok) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
