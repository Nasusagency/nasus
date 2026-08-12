/**
 * Tipos mínimos del payload de WhatsApp Cloud API (Graph v21).
 * Solo se modela lo que el webhook consume; el resto se ignora.
 */

export interface WhatsAppMediaObject {
  id?: string;
  mime_type?: string;
  caption?: string;
}

export interface WhatsAppTextMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  image?: WhatsAppMediaObject;
}

export interface WhatsAppContact {
  wa_id?: string;
  profile?: { name?: string };
}

export interface WhatsAppValue {
  messaging_product?: string;
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppTextMessage[];
  statuses?: unknown[];
}

export interface WhatsAppChange {
  field?: string;
  value?: WhatsAppValue;
}

export interface WhatsAppEntry {
  id?: string;
  changes?: WhatsAppChange[];
}

export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: WhatsAppEntry[];
}

/** Mensaje entrante ya normalizado. */
export interface IncomingMessage {
  messageId: string;
  from: string;
  /** Texto del mensaje, o el pie de foto si vino una imagen. */
  text: string;
  profileName?: string;
  /** Media id de Meta cuando el mensaje trae imagen. */
  mediaId?: string;
  mediaMime?: string;
}

// ─── Persistencia ─────────────────────────────────────────────────────────────

export type Direccion = "entrante" | "saliente";

/** Mensaje del historial tal como se lee de la base. */
export interface StoredMessage {
  direccion: Direccion;
  contenido: string | null;
  media_id: string | null;
  created_at: string;
}

// ─── Cliente con contexto ─────────────────────────────────────────────────────

export interface ClienteContexto {
  numero_whatsapp: string;
  nombre_negocio: string;
  contexto_negocio: string;
}

// ─── Ticket / solicitud formal ────────────────────────────────────────────────

export type Urgencia = "baja" | "media" | "alta";

/**
 * Lo que devuelve Claude al evaluar el mensaje. `es_solicitud_formal` en false
 * significa saludo o pregunta genérica: no se genera ticket.
 *
 * No incluye un texto de confirmación: la detección corre antes de responder,
 * así que el acuse lo redacta la respuesta principal y el cliente recibe un
 * solo mensaje.
 */
export interface DeteccionSolicitud {
  es_solicitud_formal: boolean;
  resumen: string;
  seccion_o_pagina: string;
  recomendacion_claude: string;
  urgencia: Urgencia;
}

/** Ticket completo que viaja por correo. */
export interface Ticket {
  cliente_numero: string;
  cliente_nombre: string;
  resumen: string;
  seccion_o_pagina: string;
  tiene_imagen: boolean;
  url_imagen: string;
  recomendacion_claude: string;
  urgencia: Urgencia;
  contexto_conversacion: string;
  /** Distingue prospecto en demo de cliente dado de alta en la tabla. */
  origen: "prospecto_demo" | "cliente_activo";
  nombre_negocio: string;
}
