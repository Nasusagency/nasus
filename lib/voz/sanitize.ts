/**
 * Convierte a texto plano la respuesta del asistente de voz.
 *
 * Segunda capa del arreglo: el system prompt ya prohíbe el markdown, pero un
 * prompt es una petición, no una garantía — los modelos derivan, y aquí el
 * fallo lo ve cualquier visitante y además se cuela en el audio.
 *
 * Se aplica una sola vez en la route, antes de repartir el texto hacia
 * ElevenLabs y hacia la UI, para que ambos reciban exactamente lo mismo.
 *
 * Criterio: esto es habla. Un asterisco no tiene ninguna lectura válida en voz,
 * así que se eliminan todos sin contemplaciones. El guion bajo sí puede
 * aparecer legítimamente (correos, URLs), de modo que solo se quita cuando
 * envuelve una frase, que es la forma en que el markdown lo usa.
 */
export function stripMarkdown(text: string): string {
  return (
    text
      // Bloques de código completos: no hay forma sensata de leerlos en voz.
      .replace(/```[\s\S]*?```/g, " ")
      // Enlaces e imágenes: se conserva el texto, se descarta la URL.
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Código en línea y tachado.
      .replace(/`([^`]+)`/g, "$1")
      .replace(/~~(.+?)~~/g, "$1")
      // Encabezados, viñetas y citas al principio de línea.
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}[-*+]\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      // Énfasis con guion bajo: solo si envuelve texto (__x__ o _x_).
      .replace(/__(.+?)__/g, "$1")
      .replace(/(^|\s)_(?!\s)([^_]+?)(?<!\s)_(?=$|[\s.,;:!?)])/g, "$1$2")
      // Cualquier asterisco restante, incluidos los de **negrita**.
      .replace(/\*/g, "")
      // Colapsa el espacio que dejan las sustituciones.
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
