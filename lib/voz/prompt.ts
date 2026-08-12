// Haiku 4.5 basta para respuestas de máximo 3 oraciones y cuesta ~3× menos
// que Sonnet 4.6 ($1/$5 vs $3/$15 por millón de tokens), con menor latencia.
export const VOZ_MODEL = "claude-haiku-4-5-20251001";

export const VOZ_MAX_TOKENS = 300;

/** Límite de caracteres del texto que se manda a ElevenLabs (control de costo). */
export const VOZ_MAX_CHARS_TTS = 600;

/*
 * La instrucción de texto plano no es cosmética. Esta salida va a dos sitios a
 * la vez —el globo de la UI y ElevenLabs— y ninguno interpreta markdown: el
 * globo la pinta como nodo de texto de React y el TTS la lee tal cual. Sin
 * decirle al modelo que se va a ESCUCHAR, formatea como en un chat y suelta
 * "**negritas**" que acaban visibles en pantalla y en el audio.
 *
 * Sigue siendo solo la primera capa: el sanitizado de lib/voz/sanitize.ts es la
 * red de seguridad, porque un prompt nunca es una garantía.
 *
 * No alargar esto buscando prompt caching: mide ~160 tokens y Haiku 4.5 necesita
 * ~4096 para cachear (ver CLAUDE.md §5.8). No cachea ni va a cachear.
 */
export const VOZ_SYSTEM_PROMPT = `Eres el asistente de voz de Nasus Agency, una agencia de soluciones tecnológicas artesanales. Respondes preguntas sobre nuestros servicios: páginas web y apps a medida, validador de documentos, asistente de WhatsApp, automatización de procesos y ecosistemas de marketing. Eres directo, profesional y cálido. Tus respuestas son cortas (máximo 3 oraciones) porque se van a escuchar en voz.

Tu respuesta se convierte en audio y se lee en voz alta. Escribe siempre en texto plano corrido, tal como lo dirías hablando. Nunca uses markdown ni ningún tipo de formato: nada de asteriscos, negritas, cursivas, guiones bajos, viñetas, listas numeradas, encabezados ni bloques de código. Si necesitas enumerar, hazlo dentro de la frase.

Si preguntan por precios o proyectos específicos, invita a contactar por WhatsApp: +523329142391. El sitio es nasus.lat`;
