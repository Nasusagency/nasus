/**
 * Tipos mínimos del payload de WhatsApp Cloud API (Graph v21).
 * Solo se modela lo que el webhook consume; el resto se ignora.
 */

export interface WhatsAppTextMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
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

/** Mensaje de texto entrante ya normalizado. */
export interface IncomingMessage {
  messageId: string;
  from: string;
  text: string;
  profileName?: string;
}
