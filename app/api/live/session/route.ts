import { NextRequest, NextResponse } from "next/server";

import { hashIp, releaseLiveReservation, reserveLiveSession } from "@/lib/live/budget";
import {
  LIVE_BACKEND_INSTRUCTIONS,
  LIVE_IDLE_TIMEOUT_S,
  LIVE_INSTRUCTIONS,
  liveLimits,
  liveModels,
} from "@/lib/live/config";

// Node runtime (no edge): usa node:crypto para el hash de la IP.
export const maxDuration = 30;

const MAX_BODY_BYTES = 32_000;
const OPENAI_LIVE_URL = "https://api.openai.com/v1/live/sessions";

/**
 * Respuestas con `fallback: true` le dicen al cliente que use el asistente
 * anterior (texto, sin voz en vivo). Cualquier problema —sin llave, sin
 * presupuesto, error de OpenAI— termina ahí en vez de romper el botón.
 */
function fail(status: number, error: string, reason: string) {
  return NextResponse.json({ error, reason, fallback: true }, { status });
}

/**
 * Abre una sesión de voz con GPT-Live. El navegador manda su oferta WebRTC (SDP)
 * y este endpoint la intercambia con OpenAI usando la llave del servidor, que
 * nunca llega al cliente. Antes de llamar a OpenAI se reserva presupuesto.
 */
export async function POST(req: NextRequest) {
  // Mismo origen: bloquea que otros sitios o scripts usen este endpoint.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  let sameOrigin = false;
  try {
    sameOrigin = !!origin && !!host && new URL(origin).host === host;
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin) return fail(403, "Origen no permitido.", "origin");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fail(503, "La voz en vivo no está disponible.", "not_configured");

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return fail(413, "Solicitud demasiado grande.", "too_large");

  let sdp: string;
  try {
    const body = JSON.parse(raw) as { sdp?: unknown };
    sdp = typeof body.sdp === "string" ? body.sdp : "";
  } catch {
    return fail(400, "Solicitud inválida.", "bad_request");
  }
  if (!sdp.startsWith("v=0")) return fail(400, "Solicitud inválida.", "bad_request");

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const reservation = await reserveLiveSession(hashIp(ip));
  if (!reservation.ok) {
    if (reservation.reason === "ip") {
      return fail(429, "Ya usaste el asistente de voz varias veces hoy. Escríbenos por WhatsApp.", "ip");
    }
    if (reservation.reason === "day" || reservation.reason === "month") {
      return fail(
        429,
        "El asistente de voz tiene mucha demanda ahora. Escríbenos por WhatsApp.",
        reservation.reason,
      );
    }
    return fail(503, "La voz en vivo no está disponible.", "unavailable");
  }

  const { model, backendModel, voice } = liveModels();

  let res: Response;
  try {
    res = await fetch(OPENAI_LIVE_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        session: {
          model,
          instructions: LIVE_INSTRUCTIONS,
          audio: { output: { voice } },
          // Espera a que la persona hable y pasa a espera (más barata) si hay silencio.
          wake_policy: { type: "speech" },
          idle_timeout_s: LIVE_IDLE_TIMEOUT_S,
          delegation: {
            type: "responses",
            responses: { model: backendModel, instructions: LIVE_BACKEND_INSTRUCTIONS },
          },
        },
        transport: { type: "webrtc", sdp },
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    await releaseLiveReservation(reservation.id);
    console.error("[live] OpenAI fetch error:", err instanceof Error ? err.message : String(err));
    return fail(502, "No pude conectar la voz en vivo.", "upstream");
  }

  if (!res.ok) {
    await releaseLiveReservation(reservation.id);
    // Solo el status: el cuerpo puede incluir la oferta SDP u otros datos.
    console.error("[live] OpenAI status:", res.status);
    return fail(502, "No pude conectar la voz en vivo.", "upstream");
  }

  let answer: string | undefined;
  try {
    const data = (await res.json()) as { transport?: { sdp?: string } };
    answer = data.transport?.sdp;
  } catch {
    answer = undefined;
  }
  if (!answer) {
    console.error("[live] respuesta de OpenAI sin SDP");
    return fail(502, "No pude conectar la voz en vivo.", "upstream");
  }

  return NextResponse.json(
    { sdp: answer, maxSeconds: liveLimits().sessionSeconds },
    { status: 201 },
  );
}
