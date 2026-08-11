import { after, NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic/client";
import { VOZ_MAX_TOKENS, VOZ_MODEL, VOZ_SYSTEM_PROMPT } from "@/lib/voz/prompt";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { notifyAsesorRequest } from "@/lib/whatsapp/notify";
import { checkRateLimit, markMessageSeen } from "@/lib/whatsapp/rate-limit";
import { verifyMetaSignature } from "@/lib/whatsapp/signature";
import type { IncomingMessage, WhatsAppWebhookPayload } from "@/lib/whatsapp/types";

export const maxDuration = 30;

const MAX_MESSAGE_CHARS = 1000;

const RESPUESTA_ASESOR =
  "Claro. En breve un asesor de Nasus Agency te contacta por este mismo número. " +
  "Si es urgente, escríbenos a +52 33 2962 1602.";

const RESPUESTA_NO_TEXTO =
  "Por ahora solo puedo leer mensajes de texto. Escríbeme tu pregunta y con gusto te ayudo.";

const RESPUESTA_ERROR =
  "Tuve un problema para procesar tu mensaje. ¿Puedes intentarlo de nuevo?";

/** Quita acentos y baja a minúsculas para detectar palabras clave. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function pideAsesor(text: string): boolean {
  const t = normalize(text);
  return t.includes("humano") || t.includes("asesor");
}

// ─── GET: verificación del webhook por parte de Meta ──────────────────────────

export async function GET(req: NextRequest) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const params = req.nextUrl.searchParams;

  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (!verifyToken || mode !== "subscribe" || token !== verifyToken || !challenge) {
    return new NextResponse(null, { status: 403 });
  }

  // Meta espera el challenge en texto plano, sin comillas ni JSON.
  return new NextResponse(challenge, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

// ─── POST: mensajes entrantes ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // El cuerpo crudo es lo que Meta firmó: no re-serializar el JSON.
  const rawBody = await req.text();

  const valid = await verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"));
  if (!valid) {
    console.warn("[whatsapp/webhook] firma inválida o WHATSAPP_APP_SECRET sin configurar");
    return new NextResponse(null, { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const mensajes = extractMessages(payload);

  // Meta reintenta si no recibe 200 rápido: se responde ya y se procesa después.
  if (mensajes.length > 0) {
    after(async () => {
      for (const mensaje of mensajes) {
        await procesarMensaje(mensaje);
      }
    });
  }

  return new NextResponse(null, { status: 200 });
}

// ─── Extracción ───────────────────────────────────────────────────────────────

function extractMessages(payload: WhatsAppWebhookPayload): IncomingMessage[] {
  const out: IncomingMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages) continue;

      // El nombre de perfil viene en `contacts`, indexado por wa_id.
      const nombres = new Map<string, string>();
      for (const contacto of value.contacts ?? []) {
        if (contacto.wa_id && contacto.profile?.name) {
          nombres.set(contacto.wa_id, contacto.profile.name);
        }
      }

      for (const msg of value.messages) {
        if (!msg?.id || !msg.from) continue;
        out.push({
          messageId: msg.id,
          from: msg.from,
          // `type` distinto de "text" deja el texto vacío: se responde con aviso.
          text: msg.type === "text" ? (msg.text?.body ?? "").trim() : "",
          profileName: nombres.get(msg.from),
        });
      }
    }
  }

  return out;
}

// ─── Procesamiento ────────────────────────────────────────────────────────────

async function procesarMensaje(mensaje: IncomingMessage): Promise<void> {
  const { messageId, from, text, profileName } = mensaje;

  if (!markMessageSeen(messageId)) return;

  // Al alcanzar el límite se deja de responder en silencio: contestar aquí
  // solo alimentaría el bucle que se intenta frenar.
  if (!checkRateLimit(from)) {
    console.warn("[whatsapp/webhook] límite por número alcanzado");
    return;
  }

  try {
    if (!text) {
      await sendWhatsAppText(from, RESPUESTA_NO_TEXTO);
      return;
    }

    if (pideAsesor(text)) {
      // Las dos mitades son independientes a propósito: si el envío por
      // WhatsApp falla, el asesor debe enterarse igual (y viceversa).
      const [aviso, correo] = await Promise.allSettled([
        sendWhatsAppText(from, RESPUESTA_ASESOR),
        notifyAsesorRequest({ phone: from, profileName }),
      ]);

      if (aviso.status === "rejected") {
        console.error(
          "[whatsapp/webhook] fallo al confirmar escalación:",
          aviso.reason instanceof Error ? aviso.reason.message : String(aviso.reason),
        );
      }
      if (correo.status === "rejected") {
        console.error(
          "[whatsapp/webhook] fallo al notificar asesor:",
          correo.reason instanceof Error ? correo.reason.message : String(correo.reason),
        );
      }
      return;
    }

    const respuesta = await responderConClaude(text);
    await sendWhatsAppText(from, respuesta);
  } catch (err) {
    // Sin contenido del mensaje ni número completo en el log (PII).
    console.error(
      "[whatsapp/webhook] error procesando mensaje:",
      err instanceof Error ? err.message : String(err),
    );
    try {
      await sendWhatsAppText(from, RESPUESTA_ERROR);
    } catch {
      // Si tampoco se puede enviar, no queda nada por hacer.
    }
  }
}

async function responderConClaude(text: string): Promise<string> {
  const message = text.length > MAX_MESSAGE_CHARS ? text.slice(0, MAX_MESSAGE_CHARS) : text;

  const response = await anthropic.messages.create({
    model: VOZ_MODEL,
    max_tokens: VOZ_MAX_TOKENS,
    // Mismo system prompt que el asistente de voz: al ser byte a byte idéntico
    // comparte la caché de prompt con `/api/assistant`.
    system: [
      {
        type: "text",
        text: VOZ_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: message }],
  });

  const out = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join(" ")
    .trim();

  if (!out) throw new Error("claude_empty_response");
  return out;
}
