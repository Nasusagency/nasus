/**
 * Persistencia de conversaciones de WhatsApp.
 *
 * A diferencia del resto del proyecto, aquí SÍ se guarda contenido de mensajes
 * y el número del contacto: es lo que permite armar los tickets de solicitud.
 * Ese dato vive solo en Postgres con RLS activo (ver la migración), nunca en
 * logs de consola.
 *
 * Ninguna función de este módulo lanza: si la base falla, el webhook debe
 * seguir contestando al cliente. Los errores se reportan sin incluir contenido.
 */

import { createServiceClient } from "@/lib/supabase/service";
import type { ClienteContexto, Direccion, StoredMessage } from "./types";

const TABLA_MENSAJES = "whatsapp_mensajes";
const TABLA_CLIENTES = "whatsapp_clientes";

/**
 * Inactividad que cierra una conversación. Con 24 h, escribir al día siguiente
 * abre un hilo nuevo, pero un intercambio con pausas de un par de horas sigue
 * contando como la misma conversación.
 */
const VENTANA_CONVERSACION_MS = 24 * 60 * 60_000;

/** Mensajes de historial que se mandan a Claude como contexto. */
export const HISTORIAL_MAX = 10;

function logError(scope: string, error: unknown): void {
  // Solo el mensaje de error: nunca el contenido ni el número.
  console.error(`[whatsapp/store] ${scope}:`, error instanceof Error ? error.message : String(error));
}

/**
 * Devuelve el `conversation_id` abierto del número, o uno nuevo si el último
 * mensaje quedó fuera de la ventana.
 */
export async function resolveConversationId(numero: string): Promise<string> {
  const supabase = createServiceClient();
  if (!supabase) return crypto.randomUUID();

  try {
    const { data, error } = await supabase
      .from(TABLA_MENSAJES)
      .select("conversation_id, created_at")
      .eq("numero", numero)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return crypto.randomUUID();

    const ultimo = new Date(data.created_at as string).getTime();
    if (Number.isNaN(ultimo) || Date.now() - ultimo > VENTANA_CONVERSACION_MS) {
      return crypto.randomUUID();
    }

    return data.conversation_id as string;
  } catch (err) {
    logError("resolveConversationId", err);
    return crypto.randomUUID();
  }
}

export async function saveMessage(params: {
  conversationId: string;
  numero: string;
  direccion: Direccion;
  contenido: string | null;
  mediaId?: string;
  mediaMime?: string;
  messageId?: string;
}): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) return;

  try {
    const { error } = await supabase.from(TABLA_MENSAJES).insert({
      conversation_id: params.conversationId,
      numero: params.numero,
      direccion: params.direccion,
      contenido: params.contenido,
      media_id: params.mediaId ?? null,
      media_mime: params.mediaMime ?? null,
      message_id: params.messageId ?? null,
    });

    // 23505 = unique_violation sobre message_id: es un reintento de Meta que ya
    // se guardó. No es un fallo.
    if (error && error.code !== "23505") throw error;
  } catch (err) {
    logError("saveMessage", err);
  }
}

/** Últimos mensajes del hilo, del más antiguo al más reciente. */
export async function getHistorial(
  conversationId: string,
  limite = HISTORIAL_MAX,
): Promise<StoredMessage[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from(TABLA_MENSAJES)
      .select("direccion, contenido, media_id, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limite);

    if (error) throw error;
    // Se pide descendente para quedarse con los N más recientes; Claude los
    // necesita en orden cronológico.
    return ((data ?? []) as StoredMessage[]).reverse();
  } catch (err) {
    logError("getHistorial", err);
    return [];
  }
}

/**
 * Busca el número en la tabla de clientes. Devuelve null si no está dado de
 * alta o si está pausado (`activo = false`): ambos casos son modo demo.
 */
export async function getCliente(numero: string): Promise<ClienteContexto | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from(TABLA_CLIENTES)
      .select("numero_whatsapp, nombre_negocio, contexto_negocio")
      .eq("numero_whatsapp", numero)
      .eq("activo", true)
      .maybeSingle();

    if (error) throw error;
    return (data as ClienteContexto | null) ?? null;
  } catch (err) {
    logError("getCliente", err);
    return null;
  }
}
