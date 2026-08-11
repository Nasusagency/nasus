/**
 * Notificación por email cuando alguien pide hablar con un asesor.
 *
 * El proyecto no tenía infraestructura de correo, así que se usa Resend por
 * HTTP (sin dependencias nuevas). Si `RESEND_API_KEY` no está configurada, la
 * notificación se omite: nunca rompe la respuesta al usuario de WhatsApp.
 *
 * El correo lleva el número (es el dato que el asesor necesita para devolver
 * el contacto) pero NO el contenido del mensaje.
 */

const NOTIFY_TO = "nasusagency@gmail.com";
const DEFAULT_FROM = "Nasus Agency <onboarding@resend.dev>";

export async function notifyAsesorRequest(params: {
  phone: string;
  profileName?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[whatsapp/notify] RESEND_API_KEY sin configurar: escalación no notificada");
    return;
  }

  const from = process.env.NOTIFY_FROM ?? DEFAULT_FROM;
  const nombre = params.profileName ? ` (${params.profileName})` : "";
  const cuando = new Date().toISOString();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [NOTIFY_TO],
      subject: "WhatsApp: alguien pide hablar con un asesor",
      text: [
        "Un contacto pidió hablar con un asesor por WhatsApp.",
        "",
        `Número: +${params.phone}${nombre}`,
        `Fecha: ${cuando}`,
        "",
        "El contenido del mensaje no se incluye por política de privacidad.",
      ].join("\n"),
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`notify_failed:${res.status}`);
  }
}
