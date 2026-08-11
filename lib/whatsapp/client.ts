/** Envío de mensajes salientes por WhatsApp Cloud API. */

const GRAPH_VERSION = "v21.0";

/** Límite de caracteres de un mensaje de texto en WhatsApp. */
const MAX_BODY_CHARS = 4096;

/**
 * Envía un mensaje de texto. Lanza un Error con código estable.
 * Nunca registra el cuerpo del mensaje (PII).
 */
export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error("whatsapp_not_configured");
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: body.slice(0, MAX_BODY_CHARS),
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    // Solo el status: el cuerpo del error de Graph repite el mensaje enviado.
    throw new Error(`whatsapp_send_failed:${res.status}`);
  }
}
