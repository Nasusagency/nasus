/**
 * Rate limiting y deduplicación en memoria.
 *
 * Al igual que el resto de rutas del proyecto, el estado vive en el proceso:
 * en Vercel cada instancia lleva su propio contador. Es suficiente como freno
 * de abuso, no como cuota exacta.
 */

// ─── Rate limit: 10 mensajes por número por hora ──────────────────────────────
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60_000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(phone: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(phone);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(phone, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
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
