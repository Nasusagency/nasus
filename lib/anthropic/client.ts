import Anthropic from "@anthropic-ai/sdk";

/**
 * Cliente de Claude con instanciación perezosa.
 *
 * Antes se validaba la clave y se creaba el cliente al evaluar el módulo. Eso
 * rompía el build: durante `Collecting page data` Next importa cada route para
 * leer sus exports (`runtime`, `maxDuration`), al importarla se evaluaba este
 * módulo y lanzaba. Cualquier entorno sin ANTHROPIC_API_KEY —los previews de
 * Vercel, por ejemplo— no compilaba, aunque la ruta jamás llegara a ejecutarse.
 *
 * La validación sigue siendo igual de estricta; lo único que cambia es CUÁNDO
 * ocurre: al invocar, no al importar.
 *
 * El mensaje nombra la variable de entorno a propósito, y por eso este error
 * no puede llegar nunca al cliente (ver .cloud/agents/security.md, paso 4:
 * exponer nombres de env vars al cliente es bloqueante). Los handlers que
 * llaman aquí responden con textos fijos y solo registran `err.message` en el
 * log del servidor, que es donde este detalle sí resulta útil para operar.
 */
let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return (client ??= new Anthropic({ apiKey }));
}
