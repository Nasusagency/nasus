import { after, NextRequest, NextResponse } from "next/server";
import { getAnthropic } from "@/lib/anthropic/client";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { enviarTicket, notifyAsesorRequest } from "@/lib/whatsapp/notify";
import { buildSystemPrompt, WHATSAPP_MAX_TOKENS, WHATSAPP_MODEL } from "@/lib/whatsapp/prompt";
import { checkRateLimit, markMessageSeen } from "@/lib/whatsapp/rate-limit";
import { verifyMetaSignature } from "@/lib/whatsapp/signature";
import {
  getCliente,
  getHistorial,
  resolveConversationId,
  saveMessage,
} from "@/lib/whatsapp/store";
import { construirTicket, detectarSolicitud, formatearHistorial } from "@/lib/whatsapp/ticket";
import { callLLM } from "@/lib/llm/provider";
import { ALL_TOOLS } from "@/lib/llm/tools";
import { executeToolCall } from "@/lib/whatsapp/agent-handlers";
import { selectProvider, maskPhoneNumber } from "@/lib/whatsapp/groq-allowlist";
import type {
  ClienteContexto,
  DeteccionSolicitud,
  IncomingMessage,
  StoredMessage,
  WhatsAppWebhookPayload,
} from "@/lib/whatsapp/types";
import type { LLMMessage } from "@/lib/llm/provider";

export const maxDuration = 30;

const MAX_MESSAGE_CHARS = 1000;

// Sin el número de la agencia: la persona ya está escribiendo justo a ese
// número, así que dárselo aquí es una referencia circular.
const RESPUESTA_ASESOR =
  "Claro que sí. Ya le avisé al equipo y en breve un asesor de Nasus Agency " +
  "te escribe por aquí mismo.";

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

function logError(scope: string, err: unknown): void {
  console.error(`[whatsapp/webhook] ${scope}:`, err instanceof Error ? err.message : String(err));
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

        // En una imagen el texto útil es el pie de foto, si lo trae.
        const esImagen = msg.type === "image";
        const texto =
          msg.type === "text"
            ? (msg.text?.body ?? "").trim()
            : esImagen
              ? (msg.image?.caption ?? "").trim()
              : "";

        out.push({
          messageId: msg.id,
          from: msg.from,
          text: texto,
          profileName: nombres.get(msg.from),
          mediaId: esImagen ? msg.image?.id : undefined,
          mediaMime: esImagen ? msg.image?.mime_type : undefined,
        });
      }
    }
  }

  return out;
}

// ─── Procesamiento ────────────────────────────────────────────────────────────

async function procesarMensaje(mensaje: IncomingMessage): Promise<void> {
  const { messageId, from, text, profileName, mediaId, mediaMime } = mensaje;

  if (!markMessageSeen(messageId)) return;

  // Se resuelve el cliente antes del rate limit porque la cuota depende de si
  // está dado de alta: 100/hora para clientes, 10/hora para desconocidos.
  const cliente = await getCliente(from);

  // Al alcanzar el límite se deja de responder en silencio: contestar aquí
  // solo alimentaría el bucle que se intenta frenar.
  if (!checkRateLimit(from, cliente !== null)) {
    console.warn("[whatsapp/webhook] límite por número alcanzado");
    return;
  }

  const conversationId = await resolveConversationId(from);

  await saveMessage({
    conversationId,
    numero: from,
    direccion: "entrante",
    contenido: text || null,
    mediaId,
    mediaMime,
    messageId,
  });

  // El historial se lee después de guardar, así que ya incluye este mensaje.
  const historial = await getHistorial(conversationId);

  try {
    // Sin texto ni imagen no hay nada que interpretar (audio, sticker, etc.).
    if (!text && !mediaId) {
      await responder(conversationId, from, RESPUESTA_NO_TEXTO);
      return;
    }

    if (text && pideAsesor(text)) {
      await escalarAAsesor(conversationId, from, profileName);
      return;
    }

    // Allowlist controlada: elegir entre Groq (solo números autorizados) o Claude
    const provider = selectProvider(
      from,
      process.env.WHATSAPP_AGENT_PROVIDER,
      process.env.WHATSAPP_GROQ_TEST_NUMBERS
    );

    const maskedNumber = maskPhoneNumber(from);

    let respuesta: string;
    let fallbackUsed = false;

    if (provider === "groq") {
      // Groq Agent con tools (número autorizado)
      const startTime = Date.now();

      try {
        console.log(`[whatsapp] ${maskedNumber} → Groq Agent (autorizado)`);
        respuesta = await callGroqAgent(text, historial, from, profileName);
        const latency = Date.now() - startTime;

        console.log(
          `[whatsapp] ${maskedNumber} Groq completado ${latency}ms | ${provider} | ${cliente ? "cliente" : "prospecto"}`
        );
      } catch (groqErr) {
        // Fallback a Claude si Groq falla
        fallbackUsed = true;
        const latency = Date.now() - startTime;

        logError(`groq fallback a claude (${latency}ms)`, groqErr);

        const deteccion = await detectarSolicitud({
          mensaje: text,
          historial,
          cliente,
          tieneImagen: Boolean(mediaId),
        });

        respuesta = await responderConClaude(text, historial, cliente, deteccion);

        console.log(
          `[whatsapp] ${maskedNumber} Fallback a Claude | prospecto: ${cliente ? "cliente" : "sí"}`
        );
      }
    } else {
      // Claude con detección clásica (default o número no autorizado)
      const startTime = Date.now();

      const deteccion = await detectarSolicitud({
        mensaje: text,
        historial,
        cliente,
        tieneImagen: Boolean(mediaId),
      });

      respuesta = await responderConClaude(text, historial, cliente, deteccion);

      const latency = Date.now() - startTime;

      console.log(
        `[whatsapp] ${maskedNumber} Claude ${latency}ms | ${cliente ? "cliente" : "prospecto"} ${deteccion ? "| ticket" : ""}`
      );

      // El ticket se manda antes de contestar: si la API de WhatsApp falla, el
      // equipo se entera igual de la solicitud.
      if (deteccion) {
        await enviarTicketDeSolicitud({
          deteccion,
          numero: from,
          profileName,
          cliente,
          mediaId,
          historial,
        });
      }
    }

    await responder(conversationId, from, respuesta);
  } catch (err) {
    // Sin contenido del mensaje ni número completo en el log.
    logError("error procesando mensaje", err);
    try {
      await responder(conversationId, from, RESPUESTA_ERROR);
    } catch {
      // Si tampoco se puede enviar, no queda nada por hacer.
    }
  }
}

/** Envía y deja constancia del mensaje saliente en la misma conversación. */
async function responder(
  conversationId: string,
  numero: string,
  texto: string,
): Promise<void> {
  await sendWhatsAppText(numero, texto);
  await saveMessage({
    conversationId,
    numero,
    direccion: "saliente",
    contenido: texto,
  });
}

async function escalarAAsesor(
  conversationId: string,
  numero: string,
  profileName?: string,
): Promise<void> {
  // Las dos mitades son independientes a propósito: si el envío por WhatsApp
  // falla, el asesor debe enterarse igual (y viceversa).
  const [aviso, correo] = await Promise.allSettled([
    responder(conversationId, numero, RESPUESTA_ASESOR),
    notifyAsesorRequest({ phone: numero, profileName }),
  ]);

  if (aviso.status === "rejected") logError("fallo al confirmar escalación", aviso.reason);
  if (correo.status === "rejected") logError("fallo al notificar asesor", correo.reason);
}

// ─── Solicitud formal ─────────────────────────────────────────────────────────

/**
 * Manda el ticket por correo. No lanza: que el correo falle no debe impedir
 * que el cliente reciba su respuesta — el mensaje ya quedó guardado en la base,
 * así que la solicitud es recuperable aunque el aviso se pierda.
 */
async function enviarTicketDeSolicitud(params: {
  deteccion: DeteccionSolicitud;
  numero: string;
  profileName?: string;
  cliente: ClienteContexto | null;
  mediaId?: string;
  historial: StoredMessage[];
}): Promise<void> {
  try {
    await enviarTicket(construirTicket(params));
  } catch (err) {
    logError("fallo al enviar el ticket", err);
  }
}

// ─── Groq Agent (Feature Flag) ────────────────────────────────────────────────

/**
 * Ejecuta el flujo del Groq Agent v1 con fallback a Claude.
 * Diseñado para prospectos: detecta oportunidades, gestiona leads, registra solicitudes.
 *
 * Si Groq falla, `callLLM` automáticamente usa Claude.
 */
async function callGroqAgent(
  text: string,
  historial: StoredMessage[],
  numero: string,
  profileName?: string,
): Promise<string> {
  try {
    const base =
      historial.length > 1
        ? `Conversación hasta ahora:\n${formatearHistorial(historial)}\n\nResponde al último mensaje del cliente.`
        : text || "(el cliente envió una imagen sin texto)";

    const messages: LLMMessage[] = [
      { role: "user", content: base },
    ];

    const systemPrompt = [
      {
        type: "text",
        text: buildSystemPrompt(null, true), // Groq Agent: prompt específico + sin contexto de cliente
        cache_control: { type: "ephemeral" },
      },
    ];

    const response = await callLLM({
      model: "openai/gpt-oss-120b", // Groq
      max_tokens: WHATSAPP_MAX_TOKENS,
      system: systemPrompt as any,
      messages,
      tools: ALL_TOOLS,
      tool_choice: { type: "auto" },
    });

    // Procesar respuesta
    let respuestaFinal = "";
    const toolsEjecutados: string[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        respuestaFinal += block.text + " ";
      }

      if (block.type === "tool_use") {
        toolsEjecutados.push(block.name);
        // Ejecutar tool y capturar resultado
        try {
          const result = await executeToolCall(block.name as any, block.input);
          console.log(`[groq-agent] ${block.name} ejecutado:`, result);

          // Nota: el resultado se usa para razonamiento del agente, no se manda al cliente
          // (si Groq necesita el resultado, lo incluye en siguiente vuelta)
        } catch (toolErr) {
          console.error(`[groq-agent] error en tool ${block.name}:`, toolErr);
        }
      }
    }

    // Si Groq solo ejecutó tools sin text, genera fallback contextual
    if (!respuestaFinal.trim()) {
      if (toolsEjecutados.includes("guardar_actualizar_lead")) {
        // Groq guardó el lead: reconocer y preguntar más
        respuestaFinal = "Perfecto, entendí. Cuéntame más: ¿qué proceso manual que realizan hoy les gustaría mejorar?";
      } else if (toolsEjecutados.length > 0) {
        // Ejecutó otros tools
        respuestaFinal = "Gracias por compartir eso. ¿Qué desafío específico enfrentan ahora?";
      } else {
        // No ejecutó nada: pregunta genérica
        respuestaFinal = "Cuéntame sobre tu negocio: ¿a qué se dedican y qué proceso o servicio les gustaría mejorar?";
      }
    }

    return respuestaFinal.trim();
  } catch (err) {
    logError("groq_agent error", err);
    // Fallback a Claude si Groq falla (callLLM ya lo hace internamente)
    throw err;
  }
}

// ─── Respuesta de Claude ──────────────────────────────────────────────────────

/**
 * Instrucción que se añade cuando la detección encontró una solicitud formal,
 * para que el acuse salga dentro de la misma respuesta y no como un segundo
 * mensaje. Va como nota interna: describe qué comunicar, no el texto literal.
 */
const NOTA_ACUSE =
  "NOTA INTERNA (no la menciones ni la cites): lo que pide el cliente ya quedó registrado " +
  "como solicitud y el equipo le va a dar seguimiento. Incorpora eso de forma natural en tu " +
  "respuesta, en una sola oración y con tus propias palabras. No suenes a ticket automático, " +
  "no des fechas ni prometas tiempos de entrega.";

async function responderConClaude(
  text: string,
  historial: StoredMessage[],
  cliente: ClienteContexto | null,
  deteccion: DeteccionSolicitud | null,
): Promise<string> {
  const message = text.length > MAX_MESSAGE_CHARS ? text.slice(0, MAX_MESSAGE_CHARS) : text;

  // El historial ya incluye el mensaje actual (se guardó antes de leerlo), así
  // que se manda como contexto del hilo y no se repite aparte.
  const base =
    historial.length > 1
      ? `Conversación hasta ahora:\n${formatearHistorial(historial)}\n\nResponde al último mensaje del cliente.`
      : message || "(el cliente envió una imagen sin texto)";

  const contenido = deteccion ? `${base}\n\n${NOTA_ACUSE}` : base;

  const response = await getAnthropic().messages.create({
    model: WHATSAPP_MODEL,
    max_tokens: WHATSAPP_MAX_TOKENS,
    // En modo demo el prompt es idéntico byte a byte al del asistente de voz,
    // así que comparte la caché con /api/assistant. En modo cliente la caché
    // se comparte entre los mensajes de ese mismo cliente.
    system: [
      {
        type: "text",
        text: buildSystemPrompt(cliente),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: contenido }],
  });

  const out = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join(" ")
    .trim();

  if (!out) throw new Error("claude_empty_response");
  return out;
}
