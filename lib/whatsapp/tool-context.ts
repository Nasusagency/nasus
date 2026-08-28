import type { ToolName } from "@/lib/llm/tools";

export type CanonicalToolContext = {
  numero: string;
  conversationId?: string;
};

/**
 * Canonical identifiers are transport data, never model output. Strip every
 * identifier a model may have emitted and bind the values known by Meta/the DB.
 */
export function bindCanonicalToolInput(
  toolName: ToolName,
  modelInput: Record<string, unknown>,
  context: CanonicalToolContext,
): Record<string, unknown> {
  const input = { ...modelInput };
  delete input.numero;
  delete input.numero_contacto;
  delete input.conversation_id;
  delete input.contact_id;
  delete input.cliente_slug;

  if (toolName === "guardar_actualizar_lead" || toolName === "consultar_contexto_contacto") {
    input.numero = context.numero;
  }
  if (toolName === "registrar_requerimiento" || toolName === "notificar_humano") {
    input.numero_contacto = context.numero;
  }
  if (toolName === "registrar_requerimiento" && context.conversationId) {
    input.conversation_id = context.conversationId;
  }
  return input;
}
