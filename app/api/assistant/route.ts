import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic/client";
import { textToSpeech } from "@/lib/voz/elevenlabs";
import {
  VOZ_MAX_CHARS_TTS,
  VOZ_MAX_TOKENS,
  VOZ_MODEL,
  VOZ_SYSTEM_PROMPT,
} from "@/lib/voz/prompt";

export const maxDuration = 30;

const MAX_MESSAGE_CHARS = 1000;

// ─── Rate limiting (5 conversaciones por IP por hora) ─────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return errorResponse(
      "Has alcanzado el límite de conversaciones por hora. Escríbenos por WhatsApp.",
      429,
    );
  }

  let message: string;
  try {
    const body = (await req.json()) as { message?: unknown };
    message = typeof body.message === "string" ? body.message.trim() : "";
  } catch {
    return errorResponse("Cuerpo inválido.", 400);
  }

  if (!message) {
    return errorResponse("No se entendió el mensaje.", 400);
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    message = message.slice(0, MAX_MESSAGE_CHARS);
  }

  // ─── Claude ────────────────────────────────────────────────────────────────
  let text: string;
  try {
    const response = await anthropic.messages.create({
      model: VOZ_MODEL,
      max_tokens: VOZ_MAX_TOKENS,
      // Haiku 4.5 no acepta `effort` ni `thinking: disabled`: omitirlos es el
      // equivalente correcto — sin `thinking`, el modelo no razona.
      system: [
        {
          type: "text",
          text: VOZ_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: message }],
    });

    text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join(" ")
      .trim();
  } catch {
    return errorResponse("No pude procesar tu pregunta. Intenta de nuevo.", 502);
  }

  if (!text) {
    return errorResponse("No pude procesar tu pregunta. Intenta de nuevo.", 502);
  }

  // ─── ElevenLabs ────────────────────────────────────────────────────────────
  const spoken = text.length > VOZ_MAX_CHARS_TTS ? text.slice(0, VOZ_MAX_CHARS_TTS) : text;

  try {
    const { audio, mimeType } = await textToSpeech(spoken);
    return NextResponse.json({
      text,
      audio: Buffer.from(audio).toString("base64"),
      mimeType,
    });
  } catch {
    // Si falla la voz, al menos devolvemos el texto para que la UI lo muestre.
    return NextResponse.json({ text, audio: null, mimeType: null });
  }
}
