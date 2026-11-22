import { NextResponse } from "next/server";
import { canonicalPhone, createWebLead } from "@/lib/crm/web-leads";
import { notifyWebLead } from "@/lib/whatsapp/notify";

export const maxDuration = 30;

// Freno de abuso en memoria (por instancia), igual que el resto de rutas públicas.
const WINDOW_MS = 60 * 60_000;
const LIMIT = 5;
const hits = new Map<string, { count: number; resetAt: number }>();

function allowed(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now >= e.resetAt) { hits.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return true; }
  if (e.count >= LIMIT) return false;
  e.count++;
  return true;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowed(ip)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  // Honeypot: un bot lo llena, una persona no lo ve. Se responde "ok" sin guardar.
  if (text(body.website, 100)) return NextResponse.json({ ok: true });

  const nombre = text(body.nombre, 120);
  const empresa = text(body.empresa, 160);
  const problema = text(body.problema, 2000);
  const telefono = text(body.telefono, 30);
  const email = text(body.email, 254) || null;
  if (!nombre || !empresa || !problema || !telefono) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const at = body.attribution && typeof body.attribution === "object" && !Array.isArray(body.attribution)
    ? (body.attribution as Record<string, unknown>) : {};
  const attribution = {
    source: text(at.source, 100) || null, medium: text(at.medium, 100) || null, campaign: text(at.campaign, 160) || null,
    content: text(at.content, 160) || null, term: text(at.term, 160) || null, landingPath: text(at.landingPath, 300) || null,
  };

  // Casillas sin marcar por defecto: solo `true` explícito cuenta como permiso.
  const consentRaw = body.consents && typeof body.consents === "object" ? (body.consents as Record<string, unknown>) : {};
  const consents = { email: consentRaw.email === true, whatsapp: consentRaw.whatsapp === true };

  const result = await createWebLead({ nombre, empresa, problema, telefono, email, consents, attribution });
  if (!result.ok) {
    const status = result.error === "invalid_phone" || result.error === "invalid_email" ? 400 : 503;
    return NextResponse.json({ error: result.error }, { status });
  }

  // El correo al equipo nunca debe romper el alta ni la respuesta.
  try {
    await notifyWebLead({ nombre, empresa, problema, telefono: canonicalPhone(telefono) ?? telefono, email, fuente: [attribution.source, attribution.campaign].filter(Boolean).join(" / ") || null, permisos: [consents.email && email ? "correo" : "", consents.whatsapp ? "WhatsApp" : ""].filter(Boolean) });
  } catch (e) {
    console.error("[contact] notify_failed", e instanceof Error ? e.message : "unknown");
  }
  return NextResponse.json({ ok: true });
}
