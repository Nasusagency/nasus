/**
 * Registro de visitas de la guía, archivos para agentes (llms.txt, robots.txt,
 * sitemap.xml) y rutas inexistentes (404) de todo el sitio.
 *
 * Funciona en Edge (middleware) y Node (not-found): solo usa fetch y Web Crypto.
 * Escribe con la service role en `laberinto_visitas` (RLS sin políticas).
 *
 * Privacidad: no se guarda la IP, solo un HMAC de IP + día (no permite seguir
 * a alguien más allá de un día ni revertirse sin el secreto). Nada de esto va a
 * consola. Nunca lanza: si falla, la visita se pierde y la página sigue.
 */
import { classifyVisitor } from "./classify";

export type OrigenVisita = "guia" | "archivo" | "404";

export type VisitInput = {
  path: string;
  status: number;
  origen: OrigenVisita;
  method?: string;
  userAgent: string | null;
  ip: string | null;
  ref?: string | null;
  referer?: string | null;
};

/** Rutas a archivos que los agentes leen para entender el sitio. */
export const AGENT_FILES = new Set(["/llms.txt", "/llms-full.txt", "/robots.txt", "/sitemap.xml"]);

/** Rutas de escáneres de vulnerabilidades: ruido, no intención. */
const SCANNER = /\.(php\d?|aspx?|jsp|cgi|env|ini|sql|bak|old|swp|ya?ml|xml\.gz|git|DS_Store)(\/|$)|(^|\/)(wp-|wordpress|xmlrpc|phpmyadmin|cgi-bin|\.git|\.env|\.aws|\.ssh|vendor\/|boaform|actuator)/i;

/** Ruta con formato razonable para registrar: corta, con caracteres de URL comunes. */
export function shouldLogPath(path: string): boolean {
  if (path.length > 160) return false;
  if (!/^\/[A-Za-z0-9\-._~/%]*$/.test(path)) return false;
  if (path.split("/").length > 8) return false;
  return !SCANNER.test(path);
}

export function cleanRef(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase().slice(0, 80);
  return /^[a-z0-9\-/]+$/.test(v) ? v : null;
}

function refererHost(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.slice(0, 120) || null;
  } catch {
    return null;
  }
}

async function hashIp(ip: string | null): Promise<string | null> {
  const secret = process.env.GUIA_HASH_SALT || process.env.ADMIN_JWT_SECRET;
  if (!ip || !secret) return null;
  const day = new Date().toISOString().slice(0, 10);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${day}|${ip}`));
  return Array.from(new Uint8Array(sig).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function clientIp(headers: Headers): string | null {
  return headers.get("x-real-ip") || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

export async function logVisit(input: VisitInput): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    let path = input.path;
    try {
      path = decodeURIComponent(path);
    } catch {
      /* se queda como llegó */
    }
    path = path.replace(/\/+$/, "") || "/";
    const { tipo, agente } = classifyVisitor(input.userAgent);
    const row = {
      ruta: path.slice(0, 160),
      estado: input.status,
      origen: input.origen,
      metodo: (input.method ?? "GET").slice(0, 8),
      tipo_visitante: tipo,
      agente,
      referencia: cleanRef(input.ref),
      referer_host: refererHost(input.referer),
      user_agent: input.userAgent?.slice(0, 300) ?? null,
      ip_hash: await hashIp(input.ip),
    };
    await fetch(`${url}/rest/v1/laberinto_visitas`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
  } catch {
    // Sin consola a propósito: la ruta y el user agent no son PII, pero el
    // registro no debe ensuciar los logs ni tumbar la página.
  }
}
