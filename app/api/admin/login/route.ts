import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { signAdminToken, ADMIN_COOKIE } from "@/lib/admin/auth";
import { contexto, estaBloqueado, registrarIntento, safeEqual, VENTANA_MIN } from "@/lib/admin/login-security";

export async function POST(req: NextRequest) {
  const ctx = contexto(req.headers);

  // Límite persistente por IP (ver lib/admin/login-security.ts): se revisa antes de mirar la contraseña.
  if (await estaBloqueado(ctx.ipHash)) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${VENTANA_MIN} minutos.` },
      { status: 429 }
    );
  }

  let email: string | undefined;
  let password: string | undefined;
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    email = body.email;
    password = body.password;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";

  // Ambas comparaciones se hacen siempre (tiempo constante), sin cortocircuito.
  const emailOk = typeof email === "string" && safeEqual(email.toLowerCase(), adminEmail.toLowerCase());
  const passwordOk = typeof password === "string" && safeEqual(password, adminPassword);
  const ok = !!adminEmail && !!adminPassword && emailOk && passwordOk;

  after(() => registrarIntento(ctx, ok));

  if (!ok) {
    return NextResponse.json({ error: "Credenciales incorrectas." }, { status: 401 });
  }

  const token = await signAdminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 86400 * 7,
  });
  return res;
}
