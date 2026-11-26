import "server-only";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { enviarCorreo } from "@/lib/whatsapp/notify";

/**
 * Seguridad del inicio de sesión del admin.
 *
 * - Límite de intentos fallidos por IP guardado en la base (admin_login_log, migración 0025):
 *   sobrevive entre instancias y reinicios de Vercel. Si la base falla, se usa un contador
 *   en memoria como respaldo (peor, pero nunca deja al dueño fuera por un error de Supabase).
 * - Comparación en tiempo constante de correo y contraseña.
 * - Registro de cada intento y aviso por correo de accesos desde un dispositivo nuevo y de
 *   rachas de intentos fallidos.
 *
 * Privacidad: no se guarda la IP (solo un HMAC), ni el correo o contraseña escritos.
 * Nada de esto va a consola.
 */

export const MAX_FALLOS = 8;
export const VENTANA_MIN = 15;
const AVISO_FALLOS = 5;
const DIAS_DISPOSITIVO_CONOCIDO = 60;

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function hashIp(ip: string): string {
  const secret = process.env.ADMIN_JWT_SECRET || "sin-secreto";
  return createHmac("sha256", secret).update(`admin-login|${ip}`).digest("hex").slice(0, 24);
}

export type Contexto = { ipHash: string; country: string | null; city: string | null; userAgent: string | null };

export function contexto(headers: Headers): Contexto {
  const city = headers.get("x-vercel-ip-city");
  let cityDecoded: string | null = null;
  if (city) {
    try { cityDecoded = decodeURIComponent(city).slice(0, 80); } catch { cityDecoded = city.slice(0, 80); }
  }
  return {
    ipHash: hashIp(clientIp(headers)),
    country: headers.get("x-vercel-ip-country")?.slice(0, 8) ?? null,
    city: cityDecoded,
    userAgent: headers.get("user-agent")?.slice(0, 200) ?? null,
  };
}

// ── Respaldo en memoria (solo si la base no responde) ──────────────────────
const memoria = new Map<string, { count: number; resetAt: number }>();
function memoriaBloqueada(ipHash: string): boolean {
  const e = memoria.get(ipHash);
  return !!e && Date.now() < e.resetAt && e.count >= MAX_FALLOS;
}
function memoriaFallo(ipHash: string): void {
  const now = Date.now();
  const e = memoria.get(ipHash);
  if (!e || now >= e.resetAt) memoria.set(ipHash, { count: 1, resetAt: now + VENTANA_MIN * 60_000 });
  else e.count++;
}

const desde = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();

/** Fallos de esta IP en la ventana. null = la base no respondió. */
async function fallosRecientes(ipHash: string): Promise<number | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;
  const { count, error } = await supabase.from("admin_login_log")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash).eq("ok", false).gte("ts", desde(VENTANA_MIN));
  return error ? null : (count ?? 0);
}

/** ¿Debe bloquearse este intento antes de mirar la contraseña? */
export async function estaBloqueado(ipHash: string): Promise<boolean> {
  const n = await fallosRecientes(ipHash);
  return n === null ? memoriaBloqueada(ipHash) : n >= MAX_FALLOS;
}

async function esDispositivoNuevo(ipHash: string): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) return false;
  const { count, error } = await supabase.from("admin_login_log")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash).eq("ok", true).gte("ts", desde(DIAS_DISPOSITIVO_CONOCIDO * 1440));
  return error ? false : (count ?? 0) === 0;
}

async function guardar(ctx: Contexto, ok: boolean): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) return;
  await supabase.from("admin_login_log").insert({
    ip_hash: ctx.ipHash, ok, country: ctx.country, city: ctx.city, user_agent: ctx.userAgent,
  });
}

function lugar(ctx: Contexto): string {
  return [ctx.city, ctx.country].filter(Boolean).join(", ") || "ubicación desconocida";
}
const hora = () => new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" });

/**
 * Registra el intento y manda los avisos que correspondan. Pensado para correr
 * en `after()`: nunca lanza.
 */
export async function registrarIntento(ctx: Contexto, ok: boolean): Promise<void> {
  try {
    if (ok) {
      const nuevo = await esDispositivoNuevo(ctx.ipHash);
      await guardar(ctx, true);
      if (nuevo) {
        await enviarCorreo({
          subject: "Nuevo inicio de sesión en el admin de Nasus",
          text: `Alguien inició sesión en /admin desde un dispositivo o red que no se había visto en ${DIAS_DISPOSITIVO_CONOCIDO} días.\n\nCuándo: ${hora()} (CDMX)\nDónde (aproximado): ${lugar(ctx)}\nNavegador: ${ctx.userAgent ?? "desconocido"}\n\nSi fuiste tú, no hagas nada. Si no, cambia ADMIN_PASSWORD y ADMIN_JWT_SECRET en Vercel de inmediato (esto cierra todas las sesiones).`,
        });
      }
      return;
    }
    memoriaFallo(ctx.ipHash);
    await guardar(ctx, false);
    const n = await fallosRecientes(ctx.ipHash);
    if (n === AVISO_FALLOS) {
      await enviarCorreo({
        subject: "Intentos fallidos de inicio de sesión en el admin de Nasus",
        text: `Van ${AVISO_FALLOS} intentos fallidos seguidos en /admin en los últimos ${VENTANA_MIN} minutos.\n\nCuándo: ${hora()} (CDMX)\nDónde (aproximado): ${lugar(ctx)}\nNavegador: ${ctx.userAgent ?? "desconocido"}\n\nA los ${MAX_FALLOS} intentos esa red queda bloqueada ${VENTANA_MIN} minutos. Si no fuiste tú, considera cambiar ADMIN_PASSWORD en Vercel.`,
      });
    }
  } catch {
    // Sin consola: el registro y los avisos nunca deben tumbar el inicio de sesión.
  }
}
