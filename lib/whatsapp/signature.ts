/**
 * Verificación de la firma X-Hub-Signature-256 de Meta.
 *
 * Meta firma el cuerpo crudo con HMAC-SHA256 usando el App Secret de la app
 * de Meta (no el token de acceso). La comparación es en tiempo constante.
 */

const encoder = new TextEncoder();

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Comparación en tiempo constante (evita timing attacks sobre la firma). */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * @param rawBody Cuerpo exacto tal como llegó (sin re-serializar el JSON).
 * @param header  Valor del header `x-hub-signature-256` (`sha256=<hex>`).
 */
export async function verifyMetaSignature(
  rawBody: string,
  header: string | null,
): Promise<boolean> {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !header) return false;

  const prefix = "sha256=";
  if (!header.startsWith(prefix)) return false;

  const received = hexToBytes(header.slice(prefix.length));
  if (!received) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody)),
  );

  return timingSafeEqual(received, expected);
}
