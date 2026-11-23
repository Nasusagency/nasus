import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";

/**
 * ¿La petición trae una sesión de admin válida? Para rutas de API que solo debe usar
 * el equipo (diagnóstico, pruebas). Lee la cookie del header directamente, así funciona
 * con Request y NextRequest por igual.
 */
export async function isAdminRequest(req: Request): Promise<boolean> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);
  if (!token) return false;
  try {
    return await verifyAdminToken(decodeURIComponent(token));
  } catch {
    return false;
  }
}
