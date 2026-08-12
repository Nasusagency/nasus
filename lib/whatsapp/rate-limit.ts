/**
 * Rate limiting y deduplicación en memoria.
 *
 * Al igual que el resto de rutas del proyecto, el estado vive en el proceso:
 * en Vercel cada instancia lleva su propio contador. Es suficiente como freno
 * de abuso, no como cuota exacta.
 */

// ─── Rate limit por número ────────────────────────────────────────────────────
//
// Dos cuotas según quién escribe:
//
// - Desconocidos (modo demo): 10/hora. Freno de abuso para un número público.
// - Clientes dados de alta: 100/hora. Un cliente describiendo varios ajustes
//   pasa de 10 sin problema, así que el límite bajo lo cortaría a media
//   conversación. No se les exenta del todo: el límite sigue siendo el tope
//   que evita que un bucle de mensajes queme el presupuesto de la API.

const RATE_LIMIT_DEMO = 10;
const RATE_LIMIT_CLIENTE = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60_000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * @param esClienteActivo El número existe en `whatsapp_clientes` con
 *   `activo = true`. El webhook ya hizo esa consulta para elegir el system
 *   prompt, así que se pasa como parámetro en vez de repetirla aquí.
 */
export function checkRateLimit(phone: string, esClienteActivo = false): boolean {
  const limite = esClienteActivo ? RATE_LIMIT_CLIENTE : RATE_LIMIT_DEMO;
  const now = Date.now();
  const entry = rateLimitMap.get(phone);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(phone, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  // El límite se evalúa con la cuota vigente en cada mensaje: si el número se
  // da de alta como cliente a media ventana, el contador acumulado se conserva
  // pero se compara contra la cuota nueva.
  if (entry.count >= limite) return false;

  entry.count++;
  return true;
}

// ─── Deduplicación de reintentos de Meta ──────────────────────────────────────
// Meta reenvía el webhook si no recibe 200 a tiempo. Sin esto, un reintento
// genera una segunda respuesta de Claude al mismo mensaje.
const SEEN_TTL_MS = 15 * 60_000;

const seenMessages = new Map<string, number>();

/** `true` la primera vez que se ve el id; `false` en reintentos. */
export function markMessageSeen(messageId: string): boolean {
  const now = Date.now();

  if (seenMessages.size > 1000) {
    for (const [id, at] of seenMessages) {
      if (now - at > SEEN_TTL_MS) seenMessages.delete(id);
    }
  }

  const previous = seenMessages.get(messageId);
  if (previous !== undefined && now - previous <= SEEN_TTL_MS) return false;

  seenMessages.set(messageId, now);
  return true;
}
