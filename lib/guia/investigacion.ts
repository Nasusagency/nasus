/**
 * Datos de la investigación "Laberinto de Agentes" (nasus.mx/investigacion).
 * Autoría: la publica Nasus Agency (organización). Para añadir un autor
 * personal con nombre, agregar una entrada en AUTORES_PERSONAS; aparece en la
 * página y en el JSON-LD sin tocar nada más.
 */
export const INVESTIGACION = {
  slug: "laberinto-de-agentes",
  titulo: "Laberinto de Agentes",
  definicion:
    "El Laberinto de Agentes es un estudio de Nasus Agency que mide cómo navegan los agentes de IA por un sitio web real y usa las rutas que eligen, y las que piden sin que existan, para inferir qué buscaban.",
  inicio: "2026-11-23",
  version: "0.1",
  licencia: { nombre: "Creative Commons BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/deed.es" },
} as const;

/**
 * BORRADOR: mientras sea false la página existe pero no se anuncia: noindex,
 * fuera del sitemap, de llms.txt y del footer. Pasar a true solo cuando el
 * dueño decida publicar (previsto con 1 o 2 meses de datos).
 */
export const PUBLICADA = false;

/** Autores con nombre (con su perfil de LinkedIn). */
export const AUTORES_PERSONAS: { nombre: string; url?: string }[] = [
  { nombre: "Luis Oscar Alpizar", url: "https://www.linkedin.com/in/alpizaroscar" },
];

export const URL_ESTUDIO = `https://nasus.mx/investigacion/${INVESTIGACION.slug}`;
