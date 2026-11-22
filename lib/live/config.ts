/**
 * Configuración del asistente de voz en vivo (OpenAI GPT-Live).
 *
 * Presupuesto de referencia: ~200 MXN/mes (~US$10). GPT-Live cobra US$0.05 por
 * minuto activo (por segundo) y 15 s al abrir la sesión; el modelo "backend"
 * (gpt-5.6-luna) cuesta centavos por conversación. Los topes de abajo salen de
 * ahí y se pueden ajustar sin tocar código con variables de entorno en Vercel.
 *
 * El tope DURO de gasto es el límite mensual del proyecto en el panel de OpenAI;
 * esto es la primera línea de defensa, no la única.
 */

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

export function liveLimits() {
  return {
    /** Segundos que se reservan por sesión y que el cliente respeta como máximo. */
    sessionSeconds: intFromEnv("LIVE_SESSION_SECONDS", 90, 30, 300),
    /** Sesiones por IP en 24 h. */
    ipDailySessions: intFromEnv("LIVE_IP_DAILY_SESSIONS", 4, 1, 50),
    /** Segundos reservados en total por día (24 h móviles): 2400 s = 40 min ≈ US$2. */
    dailySeconds: intFromEnv("LIVE_DAILY_SECONDS", 2400, 60, 100_000),
    /** Segundos reservados en total por mes: 9000 s = 150 min ≈ US$7.5. */
    monthlySeconds: intFromEnv("LIVE_MONTHLY_SECONDS", 9000, 60, 1_000_000),
  };
}

/** Tras cuántos segundos sin voz la sesión pasa a espera (se cobra a US$0.02/min). */
export const LIVE_IDLE_TIMEOUT_S = 15;

export function liveModels() {
  return {
    model: process.env.LIVE_MODEL ?? "gpt-live-1.1",
    backendModel: process.env.LIVE_BACKEND_MODEL ?? "gpt-5.6-luna",
    voice: process.env.LIVE_VOICE ?? "marin",
  };
}

/** Idiomas que ofrece la tarjeta de voz. `auto` = responde en el idioma de quien habla. */
export const LIVE_LANGS: Record<string, string> = {
  auto: "",
  es: "español de México",
  en: "English",
  pt: "português do Brasil",
  fr: "français",
  de: "Deutsch",
};

function lineaDeIdioma(lang: string): string {
  const nombre = LIVE_LANGS[lang];
  if (!nombre) {
    return "Responde siempre en el idioma en que te hable la persona. Si no queda claro, usa español de México.";
  }
  return `Habla en ${nombre} durante toda la conversación, aunque estas instrucciones estén en español.`;
}

// Se escribe sin markdown ni listas: todo se va a escuchar. Mismo contenido de
// negocio que lib/voz/prompt.ts, pensado para conversación hablada.
export function liveInstructions(lang = "auto"): string {
  const idioma = lang in LIVE_LANGS ? lang : "auto";
  return `Eres el asistente de voz de Nasus Agency, una agencia mexicana de soluciones tecnológicas artesanales. Tu tono es directo, profesional y cálido, como una persona real en una llamada. ${lineaDeIdioma(idioma)}

Responde siempre en frases cortas, máximo tres oraciones por turno, y deja que la persona hable; si te interrumpe, para y escúchala. No uses listas ni formato: todo se escucha.

Qué hace Nasus: páginas web y apps a la medida, validador de documentos oficiales, asistente de WhatsApp con inteligencia artificial, automatización de procesos y ecosistemas de marketing.

Si preguntan por precios, cotizaciones o proyectos específicos, no inventes cifras: invítalos a escribir por WhatsApp al 33 2962 1602 o entrar a nasus.lat. Si preguntan algo que no tiene que ver con Nasus, responde brevemente y regresa a cómo podemos ayudarles. Nunca prometas fechas ni descuentos.`;
}

export const LIVE_BACKEND_INSTRUCTIONS = `Respondes dudas sobre Nasus Agency para una conversación hablada: entrega respuestas breves, claras y sin formato. Servicios: páginas web y apps a la medida, validador de documentos (INE, CURP, RFC, actas, títulos, facturas de Google y Meta Ads a Excel), asistente de WhatsApp con IA que califica prospectos y genera tickets, automatización de procesos y ecosistemas de marketing. No inventes precios, plazos ni clientes. Para cotizar: WhatsApp 33 2962 1602 o nasus.lat.`;
