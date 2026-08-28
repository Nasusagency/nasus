import { after, NextRequest, NextResponse } from "next/server";
import { getAnthropic } from "@/lib/anthropic/client";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { enviarTicket, notifyAsesorRequest } from "@/lib/whatsapp/notify";
import { buildSystemPrompt, WHATSAPP_MAX_TOKENS, WHATSAPP_MODEL } from "@/lib/whatsapp/prompt";
import { checkRateLimit, markMessageSeen } from "@/lib/whatsapp/rate-limit";
import { verifyMetaSignature } from "@/lib/whatsapp/signature";
import {
  getCliente,
  getConversationMode,
  getHistorial,
  ensureConversation,
  resolveConversationId,
  saveMessage,
} from "@/lib/whatsapp/store";
import { shouldAutoRespond } from "@/lib/whatsapp/conversation-policy";
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
import type { LLMCreateParams, LLMMessage, LLMResponse } from "@/lib/llm/provider";
import type { ToolName } from "@/lib/llm/tools";
import type { ToolResult } from "@/lib/llm/tool-results";
import { extractAttributionToken } from "@/lib/acquisition/attribution";
import { resolveAndAssociateAttribution } from "@/lib/acquisition/server";

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
  const { messageId, from, profileName, mediaId, mediaMime } = mensaje;
  const { cleanText: text, attributionId } = extractAttributionToken(mensaje.text);

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
  await ensureConversation(conversationId, from);

  const conversationMode = await getConversationMode(conversationId);
  if (!shouldAutoRespond(conversationMode)) {
    console.log(`[whatsapp] ${maskPhoneNumber(from)} auto_response_skipped mode=${conversationMode}`);
    return;
  }

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
    // El tool de Groq ya creó/actualizó el lead. La asociación es best-effort:
    // una atribución ausente o una migración pendiente nunca rompe el webhook.
    if (attributionId && !cliente) {
      await resolveAndAssociateAttribution(attributionId, from);
    }
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
/**
 * Detecta si el texto es razonamiento interno que NO debe enviarse al usuario.
 */
function isInternalReasoning(text: string): boolean {
  const reasoning = text.toLowerCase();
  const internalMarkers = [
    "voy a responder",
    "voy a analizar",
    "voy a revisar",
    "veo que hay",
    "he visto",
    "el usuario",
    "el cliente",
    "el prospecto",
    "debo",
    "necesito",
    "voy a",
    "parece que",
    "notar que",
    "repetición en el historial",
  ];

  return internalMarkers.some((marker) => reasoning.includes(marker));
}

export interface GroqAgentDependencies {
  callLLM: (params: LLMCreateParams) => Promise<LLMResponse>;
  executeToolCall: (
    toolName: ToolName,
    toolInput: Record<string, unknown>,
  ) => Promise<ToolResult>;
}

export async function callGroqAgent(
  text: string,
  historial: StoredMessage[],
  numero: string,
  profileName?: string,
  dependencies: GroqAgentDependencies = { callLLM, executeToolCall },
): Promise<string> {
  const MAX_TOOL_ROUNDS = 3;

  try {
    console.log(`[GROQ_AGENT] iniciando | numero=${numero.slice(0, 2)}***${numero.slice(-3)}`);

    // PREFLIGHT: consultar contexto del contacto
    console.log(`[GROQ_AGENT] preflight_context_lookup`);
    let contextResult: any = null;
    try {
      contextResult = await dependencies.executeToolCall("consultar_contexto_contacto", {
        numero,
        buscar_cliente: true,
        buscar_lead: true,
      } as unknown as Record<string, unknown>);
    } catch (err) {
      console.warn(`[GROQ_AGENT] preflight error:`, err);
    }

    const esCliente = contextResult?.es_cliente || false;
    const esLead = contextResult?.es_lead || false;
    console.log(`[GROQ_AGENT] context es_cliente=${esCliente} es_lead=${esLead}`);

    const base =
      historial.length > 1
        ? `Conversación hasta ahora:\n${formatearHistorial(historial)}\n\nResponde al último mensaje del cliente.`
        : text || "(el cliente envió una imagen sin texto)";

    // Inicializar conversación
    const messages: LLMMessage[] = [];

    // Si el contexto existe, agregarlo como contexto inicial
    if (contextResult && (esCliente || esLead)) {
      const leadStage = contextResult.lead?.stage;
      const contextoObj: Record<string, unknown> = {
        es_cliente: contextResult.es_cliente,
        es_lead: contextResult.es_lead,
        cliente: contextResult.cliente ? { nombre_negocio: contextResult.cliente.nombre_negocio } : null,
        lead: contextResult.lead ? {
          stage: contextResult.lead.stage,
          nombre_empresa: contextResult.lead.nombre_empresa,
          problema_descrito: contextResult.lead.problema_descrito,
        } : null,
      };

      // Si ya está en high_intent, agregar nota para Groq
      if (leadStage === "high_intent" && !esCliente) {
        contextoObj.nota_importante =
          "El prospecto ya fue escalado a high_intent. El equipo de Nasus ya fue notificado. NO vuelvas a ejecutar notificar_humano. Responde brevemente reconociendo su mensaje. El contexto ya fue preservado.";
      }

      messages.push({
        role: "user",
        content: `[CONTEXTO PREVIO DEL CONTACTO]:\n${JSON.stringify(contextoObj).slice(0, 300)}\n\nAhora, ${text}`,
      });
    } else {
      messages.push({
        role: "user",
        content: base,
      });
    }

    const systemPrompt = [
      {
        type: "text",
        text: buildSystemPrompt(null, true),
        cache_control: { type: "ephemeral" },
      },
    ];

    let respuestaFinal = "";
    let ronda = 0;
    const toolsEjecutados: string[] = [];
    const toolResults: Record<string, boolean> = {};
    let ultimoLeadInput: Record<string, unknown> | null = null;

    const persistirLead = async (
      input: Record<string, unknown>,
      scope: "tool" | "fallback",
    ): Promise<boolean> => {
      const result = await dependencies.executeToolCall("guardar_actualizar_lead", input);
      const exito = "exito" in result && result.exito === true;
      toolResults.guardar_actualizar_lead = exito;
      const leadId = "lead_id" in result ? result.lead_id : "";
      console.log(
        `[GROQ_AGENT] lead_persist scope=${scope} exito=${exito} stage=${String(input.stage ?? "unknown")} lead_id=${leadId || "none"}`,
      );
      return exito;
    };

    // Loop agentico: máximo 3 rondas
    while (ronda < MAX_TOOL_ROUNDS) {
      ronda++;
      console.log(`[GROQ_AGENT] round=${ronda} tool_choice=auto`);

      const response = await dependencies.callLLM({
        model: "openai/gpt-oss-120b",
        max_tokens: WHATSAPP_MAX_TOKENS,
        system: systemPrompt as any,
        messages,
        tools: ALL_TOOLS,
        tool_choice: { type: "auto" },
      });

      if (!response.content || response.content.length === 0) {
        console.log(`[GROQ_AGENT] round=${ronda} empty_response breaking`);
        break;
      }

      let hasToolCalls = false;
      const toolCallsThisRound: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

      // Procesar bloques de respuesta
      for (const block of response.content) {
        if (block.type === "text") {
          respuestaFinal += block.text + " ";
          console.log(`[GROQ_AGENT] round=${ronda} text: ${block.text.slice(0, 40)}...`);
        }

        if (block.type === "tool_use") {
          hasToolCalls = true;
          toolCallsThisRound.push({
            id: block.id,
            name: block.name,
            input: block.input,
          });
          console.log(`[GROQ_AGENT] round=${ronda} tool_requested=${block.name}`);
        }
      }

      // Ejecutar tools de esta ronda
      if (hasToolCalls) {
        messages.push({
          role: "assistant",
          content: toolCallsThisRound
            .map((tc) => `[tool_use: ${tc.name}]`)
            .join(" "),
        });

        const toolResultsContent: string[] = [];

        // Persistencia primero: una notificación humana nunca debe adelantarse
        // al lead aunque el modelo devuelva las tools en otro orden.
        toolCallsThisRound.sort((a, b) => {
          if (a.name === "guardar_actualizar_lead") return -1;
          if (b.name === "guardar_actualizar_lead") return 1;
          return 0;
        });

        for (const toolCall of toolCallsThisRound) {
          try {
            toolsEjecutados.push(toolCall.name);
            let result: ToolResult;

            if (toolCall.name === "guardar_actualizar_lead") {
              ultimoLeadInput = toolCall.input;
              const exito = await persistirLead(toolCall.input, "tool");
              result = {
                exito,
                lead_id: "",
                operacion: "actualizado",
                mensaje: exito ? "Lead persistido" : "No se pudo persistir el lead",
              };
            } else {
              if (
                toolCall.name === "notificar_humano" &&
                !esCliente &&
                toolResults.guardar_actualizar_lead !== true
              ) {
                const inputGarantia: Record<string, unknown> = ultimoLeadInput ?? {
                  numero,
                  nombre_contacto: profileName,
                  stage: "high_intent",
                  requiere_humano: true,
                  razon_handoff: "Notificación humana solicitada por el agente",
                  problema_descrito: text?.slice(0, 150) || "Prospecto nuevo",
                };
                ultimoLeadInput = inputGarantia;
                const persisted = await persistirLead(inputGarantia, "fallback");
                if (!persisted) {
                  result = {
                    exito: false,
                    mensaje: "Notificación bloqueada: el lead no fue persistido",
                    email_enviado: false,
                    motivo_fallo: "lead_persistence_required",
                  };
                } else {
                  result = await dependencies.executeToolCall(
                    toolCall.name as ToolName,
                    toolCall.input,
                  );
                }
              } else {
                result = await dependencies.executeToolCall(
                  toolCall.name as ToolName,
                  toolCall.input,
                );
              }
            }
            const exito = (result as any)?.exito === true;
            toolResults[toolCall.name] = exito;

            const resultStr = JSON.stringify(result).slice(0, 80);
            console.log(`[GROQ_AGENT] round=${ronda} tool=${toolCall.name} exito=${exito}`);
            toolResultsContent.push(
              `[${toolCall.id}] ${toolCall.name}: ${exito ? "✓" : "✗"} ${resultStr}...`
            );
          } catch (toolErr) {
            toolResults[toolCall.name] = false;
            console.error(`[GROQ_AGENT] round=${ronda} tool=${toolCall.name} error`);
            toolResultsContent.push(
              `[${toolCall.id}] ${toolCall.name}: error`
            );
          }
        }

        messages.push({
          role: "user",
          content: `Tool results:\n${toolResultsContent.join("\n")}`,
        });

        if (respuestaFinal.trim()) {
          console.log(`[GROQ_AGENT] round=${ronda} breaking: texto obtenido`);
          break;
        }
      } else {
        console.log(`[GROQ_AGENT] round=${ronda} breaking: sin tool calls`);
        break;
      }
    }

    // Fallback determinista basado en éxito real, no en que Groq haya pedido la tool.
    if (!esCliente && toolResults.guardar_actualizar_lead !== true) {
      console.log(`[GROQ_AGENT] fallback_persist_lead`);
      try {
        const fallbackInput = ultimoLeadInput ?? {
          numero,
          nombre_contacto: profileName,
          stage: contextResult?.lead?.stage ?? "exploring",
          ...(!esLead
            ? { problema_descrito: text?.slice(0, 150) || "Prospecto nuevo" }
            : {}),
        };
        await persistirLead(fallbackInput, "fallback");
      } catch (err) {
        console.error(`[GROQ_AGENT] fallback_persist error:`, err);
      }
    }

    const guardoLead = toolResults["guardar_actualizar_lead"] === true;
    console.log(
      `[GROQ_AGENT] completed rounds=${ronda} tools=${toolsEjecutados.length} lead_updated=${guardoLead} text_length=${respuestaFinal.trim().length}`
    );

    // Si no hay respuesta o es razonamiento interno, generar fallback
    let finalResponse = respuestaFinal.trim();

    if (!finalResponse || isInternalReasoning(finalResponse)) {
      console.log(`[GROQ_AGENT] respuesta_invalid sanitizing`);

      if (guardoLead) {
        finalResponse = "Perfecto, entendí. Cuéntame más sobre tu negocio para poder ayudarte mejor.";
      } else if (esLead && contextResult?.lead?.stage) {
        // Ya tenemos contexto del lead, ser más específico
        finalResponse = "Gracias por compartir eso. ¿Hay algo más que debería saber sobre tu negocio?";
      } else if (toolsEjecutados.length > 0) {
        finalResponse = "Gracias por compartir eso. Cuéntame más: ¿qué desafío específico enfrentan?";
      } else {
        finalResponse = "Cuéntame sobre tu negocio: ¿a qué se dedican y qué proceso o servicio les gustaría mejorar?";
      }
    }

    console.log(`[GROQ_AGENT] final_response_ready`);
    return finalResponse;
  } catch (err) {
    logError("groq_agent error", err);
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
