/**
 * Detección de solicitudes formales y armado del ticket.
 *
 * Una segunda llamada a Claude evalúa el mensaje del cliente: si describe una
 * petición concreta (un ajuste, un cambio, un problema) genera el ticket; si es
 * un saludo o una pregunta genérica, no genera nada.
 *
 * Se usa tool use forzado en lugar de pedir JSON en el texto: así el modelo no
 * puede devolver prosa alrededor del objeto y no hay que parsear a mano.
 */

import { getAnthropic } from "@/lib/anthropic/client";
import { WHATSAPP_MODEL } from "./prompt";
import type {
  ClienteContexto,
  DeteccionSolicitud,
  StoredMessage,
  Ticket,
  Urgencia,
} from "./types";

const DETECCION_MAX_TOKENS = 1024;

const URGENCIAS: Urgencia[] = ["baja", "media", "alta"];

/**
 * URL de la imagen en Graph. Requiere el bearer token para descargarse y la
 * URL final de Meta caduca a los pocos minutos, así que en el ticket va como
 * referencia para el asesor, no como enlace de un clic.
 */
const GRAPH_VERSION = "v21.0";

function urlDeMedia(mediaId: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(mediaId)}`;
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const INSTRUCCIONES_BASE = `Analizas mensajes que llegan por WhatsApp a Nasus Agency y decides si el cliente está haciendo una SOLICITUD FORMAL.

Es solicitud formal cuando el mensaje describe algo concreto que hay que hacer o revisar:
- Pedir un cambio o ajuste ("cámbienme el color del botón", "la foto de inicio está mal")
- Reportar un problema o error ("el formulario no envía", "la página carga lentísimo")
- Pedir algo nuevo dentro de un trabajo existente ("agréguenme una sección de contacto")

NO es solicitud formal:
- Saludos y cortesías ("hola", "buenos días", "gracias")
- Preguntas genéricas sobre la agencia ("¿qué servicios tienen?", "¿cuánto cuesta una página?")
- Conversación sin una petición concreta

Criterio de urgencia:
- alta: algo está caído, roto o bloquea al negocio (no se puede vender, no entran pedidos)
- media: algo funciona mal o incompleto pero el negocio sigue operando
- baja: mejora estética, texto, o algo que puede esperar

Escribe el resumen y la recomendación en español de México, claros y breves. El resumen describe lo que pide el cliente; la recomendación es una sugerencia técnica corta para quien lo va a resolver. Si no es solicitud formal, deja los campos de texto vacíos.`;

const TOOL_NAME = "registrar_evaluacion";

const TOOL_DEFINITION = {
  name: TOOL_NAME,
  description: "Registra el resultado de evaluar el mensaje del cliente.",
  input_schema: {
    type: "object" as const,
    properties: {
      es_solicitud_formal: {
        type: "boolean",
        description: "true solo si el mensaje describe una petición concreta de ajuste, cambio o problema.",
      },
      resumen: {
        type: "string",
        description: "Descripción corta de lo que pide el cliente. Vacío si no es solicitud formal.",
      },
      seccion_o_pagina: {
        type: "string",
        description: "Sección, página o parte del producto a la que se refiere. Vacío si no aplica.",
      },
      recomendacion_claude: {
        type: "string",
        description: "Sugerencia breve de cómo resolverlo. Vacío si no es solicitud formal.",
      },
      urgencia: {
        type: "string",
        enum: URGENCIAS,
        description: "Urgencia de la solicitud.",
      },
    },
    required: [
      "es_solicitud_formal",
      "resumen",
      "seccion_o_pagina",
      "recomendacion_claude",
      "urgencia",
    ],
    additionalProperties: false,
  },
};

/** Contexto del negocio del cliente, o nota de que es un prospecto. */
function bloqueContexto(cliente: ClienteContexto | null): string {
  if (!cliente) {
    return `El mensaje viene de un número NO registrado: es un prospecto que llegó por la demo pública de la agencia. No tiene un producto con nosotros todavía, así que una solicitud formal suya sería sobre algo que quiere que le hagamos.`;
  }

  return `El mensaje viene de un cliente activo.

NEGOCIO: ${cliente.nombre_negocio}

CONTEXTO DEL NEGOCIO:
${cliente.contexto_negocio}

Usa ese contexto para entender a qué sección, página o parte de su producto se refiere.`;
}

/** Historial en texto plano para que Claude vea el hilo. */
export function formatearHistorial(historial: StoredMessage[]): string {
  if (historial.length === 0) return "(sin mensajes previos)";

  return historial
    .map((m) => {
      const quien = m.direccion === "entrante" ? "Cliente" : "Nasus";
      const cuerpo = m.contenido?.trim() || (m.media_id ? "(envió una imagen)" : "(sin contenido)");
      return `${quien}: ${cuerpo}`;
    })
    .join("\n");
}

// ─── Detección ────────────────────────────────────────────────────────────────

function normalizarUrgencia(valor: unknown): Urgencia {
  return URGENCIAS.includes(valor as Urgencia) ? (valor as Urgencia) : "media";
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Evalúa el mensaje. Devuelve null si no es solicitud formal o si la llamada
 * falla: el webhook nunca debe romperse porque la detección no haya funcionado.
 */
export async function detectarSolicitud(params: {
  mensaje: string;
  historial: StoredMessage[];
  cliente: ClienteContexto | null;
  tieneImagen: boolean;
}): Promise<DeteccionSolicitud | null> {
  const { mensaje, historial, cliente, tieneImagen } = params;

  const contenido = [
    bloqueContexto(cliente),
    "",
    "CONVERSACIÓN RECIENTE:",
    formatearHistorial(historial),
    "",
    `ÚLTIMO MENSAJE DEL CLIENTE${tieneImagen ? " (viene acompañado de una imagen)" : ""}:`,
    mensaje || "(solo envió una imagen, sin texto)",
  ].join("\n");

  try {
    const response = await getAnthropic().messages.create({
      model: WHATSAPP_MODEL,
      max_tokens: DETECCION_MAX_TOKENS,
      // Las instrucciones son idénticas en cada llamada: se cachean.
      system: [
        {
          type: "text",
          text: INSTRUCCIONES_BASE,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [TOOL_DEFINITION],
      // Forzar la herramienta evita que responda con prosa en vez del objeto.
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: contenido }],
    });

    const bloque = response.content.find((b) => b.type === "tool_use");
    if (!bloque || bloque.type !== "tool_use") return null;

    const input = bloque.input as Record<string, unknown>;
    if (input.es_solicitud_formal !== true) return null;

    const resumen = texto(input.resumen);
    // Sin resumen no hay ticket que valga la pena mandar.
    if (!resumen) return null;

    return {
      es_solicitud_formal: true,
      resumen,
      seccion_o_pagina: texto(input.seccion_o_pagina),
      recomendacion_claude: texto(input.recomendacion_claude),
      urgencia: normalizarUrgencia(input.urgencia),
    };
  } catch (err) {
    console.error(
      "[whatsapp/ticket] fallo al evaluar la solicitud:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

// ─── Armado del ticket ────────────────────────────────────────────────────────

export function construirTicket(params: {
  deteccion: DeteccionSolicitud;
  numero: string;
  profileName?: string;
  cliente: ClienteContexto | null;
  mediaId?: string;
  historial: StoredMessage[];
}): Ticket {
  const { deteccion, numero, profileName, cliente, mediaId, historial } = params;

  return {
    cliente_numero: numero,
    cliente_nombre: profileName ?? "",
    resumen: deteccion.resumen,
    seccion_o_pagina: deteccion.seccion_o_pagina,
    tiene_imagen: Boolean(mediaId),
    url_imagen: mediaId ? urlDeMedia(mediaId) : "",
    recomendacion_claude: deteccion.recomendacion_claude,
    urgencia: deteccion.urgencia,
    contexto_conversacion: formatearHistorial(historial),
    origen: cliente ? "cliente_activo" : "prospecto_demo",
    nombre_negocio: cliente?.nombre_negocio ?? "",
  };
}
