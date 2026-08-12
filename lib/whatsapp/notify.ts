/**
 * Correos salientes hacia el equipo (Resend por HTTP, sin dependencias nuevas).
 *
 * Si `RESEND_API_KEY` no está configurada se omite el envío: nunca rompe la
 * respuesta al usuario de WhatsApp.
 */

import type { Ticket } from "./types";

const NOTIFY_TO = "nasusagency@gmail.com";
const DEFAULT_FROM = "Nasus Agency <onboarding@resend.dev>";

/**
 * `||` y no `??`: cuando NOTIFY_FROM está declarada pero vacía en el entorno,
 * `??` la daría por buena y Resend rechazaría el envío por remitente vacío.
 */
function remitente(): string {
  return process.env.NOTIFY_FROM || DEFAULT_FROM;
}

async function enviarCorreo(params: {
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[whatsapp/notify] RESEND_API_KEY sin configurar: correo no enviado");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: remitente(),
      to: [NOTIFY_TO],
      subject: params.subject,
      text: params.text,
      ...(params.html ? { html: params.html } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`notify_failed:${res.status}`);
  }
}

// ─── Escalación a asesor humano ───────────────────────────────────────────────

/**
 * Aviso cuando alguien pide hablar con un asesor.
 *
 * Lleva el número (es lo que el asesor necesita para devolver el contacto)
 * pero NO el contenido del mensaje.
 */
export async function notifyAsesorRequest(params: {
  phone: string;
  profileName?: string;
}): Promise<void> {
  const nombre = params.profileName ? ` (${params.profileName})` : "";

  await enviarCorreo({
    subject: "WhatsApp: alguien pide hablar con un asesor",
    text: [
      "Un contacto pidió hablar con un asesor por WhatsApp.",
      "",
      `Número: +${params.phone}${nombre}`,
      `Fecha: ${new Date().toISOString()}`,
      "",
      "El contenido del mensaje no se incluye por política de privacidad.",
    ].join("\n"),
  });
}

// ─── Ticket de solicitud formal ───────────────────────────────────────────────

function escapeHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Nombre para el asunto: negocio si es cliente, si no el perfil, si no el número. */
export function etiquetaTicket(ticket: Ticket): string {
  if (ticket.origen === "cliente_activo" && ticket.nombre_negocio) return ticket.nombre_negocio;
  if (ticket.cliente_nombre) return ticket.cliente_nombre;
  return `+${ticket.cliente_numero}`;
}

const COLOR_URGENCIA: Record<Ticket["urgencia"], string> = {
  alta: "#c0392b",
  media: "#c4a882",
  baja: "#7f8c8d",
};

function filasTicket(ticket: Ticket): Array<[string, string]> {
  const origen =
    ticket.origen === "cliente_activo"
      ? `Cliente activo — ${ticket.nombre_negocio}`
      : "Prospecto (modo demo)";

  const filas: Array<[string, string]> = [
    ["Origen", origen],
    ["Número", `+${ticket.cliente_numero}`],
  ];

  if (ticket.cliente_nombre) filas.push(["Nombre", ticket.cliente_nombre]);
  filas.push(["Urgencia", ticket.urgencia.toUpperCase()]);
  filas.push(["Resumen", ticket.resumen]);
  if (ticket.seccion_o_pagina) filas.push(["Sección o página", ticket.seccion_o_pagina]);
  filas.push(["Recomendación", ticket.recomendacion_claude]);
  filas.push(["Imagen", ticket.tiene_imagen ? ticket.url_imagen : "No"]);

  return filas;
}

function ticketHtml(ticket: Ticket): string {
  const filas = filasTicket(ticket)
    .map(
      ([etiqueta, valor]) =>
        `<tr>
          <td style="padding:8px 12px;color:#8a8a8a;font-size:13px;vertical-align:top;white-space:nowrap">${escapeHtml(etiqueta)}</td>
          <td style="padding:8px 12px;color:#f2f2f2;font-size:14px">${escapeHtml(valor)}</td>
        </tr>`,
    )
    .join("");

  return `<div style="background:#050508;padding:24px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">
  <div style="max-width:640px;margin:0 auto;background:#0e0e14;border:1px solid #24242e;border-radius:10px;overflow:hidden">
    <div style="padding:16px 20px;border-bottom:1px solid #24242e;border-left:3px solid ${COLOR_URGENCIA[ticket.urgencia]}">
      <div style="color:#c4a882;font-size:15px;font-weight:600">Nueva solicitud</div>
      <div style="color:#8a8a8a;font-size:13px;margin-top:2px">${escapeHtml(etiquetaTicket(ticket))}</div>
    </div>
    <table style="width:100%;border-collapse:collapse">${filas}</table>
    <div style="padding:16px 20px;border-top:1px solid #24242e">
      <div style="color:#8a8a8a;font-size:12px;margin-bottom:6px">Conversación reciente</div>
      <pre style="margin:0;white-space:pre-wrap;color:#d5d5d5;font-size:13px;line-height:1.5">${escapeHtml(ticket.contexto_conversacion)}</pre>
    </div>
    <div style="padding:16px 20px;border-top:1px solid #24242e">
      <div style="color:#8a8a8a;font-size:12px;margin-bottom:6px">JSON</div>
      <pre style="margin:0;white-space:pre-wrap;color:#00f2ff;font-size:12px;line-height:1.5">${escapeHtml(JSON.stringify(ticket, null, 2))}</pre>
    </div>
  </div>
</div>`;
}

function ticketTexto(ticket: Ticket): string {
  const filas = filasTicket(ticket).map(([etiqueta, valor]) => `${etiqueta}: ${valor}`);

  return [
    "NUEVA SOLICITUD",
    "",
    ...filas,
    "",
    "Conversación reciente:",
    ticket.contexto_conversacion,
    "",
    "JSON:",
    JSON.stringify(ticket, null, 2),
  ].join("\n");
}

export async function enviarTicket(ticket: Ticket): Promise<void> {
  await enviarCorreo({
    subject: `Nueva solicitud - ${etiquetaTicket(ticket)}`,
    text: ticketTexto(ticket),
    html: ticketHtml(ticket),
  });
}
