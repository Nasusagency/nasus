/**
 * Resolución del número real almacenado para el reset de QA/E2E
 * (scripts/qa-reset-contact.ts).
 *
 * Contactos mexicanos antiguos pueden estar guardados con el prefijo
 * histórico 521 (13 dígitos) mientras que el flujo actual normaliza a 52
 * (12 dígitos, ver normalizePhoneNumber en groq-allowlist.ts). Forzar esa
 * normalización antes de buscar rompe el reset de contactos históricos: el
 * RPC de preview hace match exacto por texto, así que hay que probar las
 * variantes posibles y dejar que los datos reales digan cuál existe, en vez
 * de asumir cuál es la "correcta".
 */

const DIGITS_ONLY = /^\d{10,15}$/;

function sanitizeDigits(raw: string): string {
  if (!raw) return "";
  let cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  return cleaned;
}

/** 521XXXXXXXXXX (13) -> 52XXXXXXXXXX ; XXXXXXXXXX (10, local MX) -> 52XXXXXXXXXX */
function mxCanonicalVariant(sanitized: string): string | null {
  if (sanitized.startsWith("521") && sanitized.length === 13) {
    return "52" + sanitized.slice(3);
  }
  if (sanitized.length === 10) {
    return "52" + sanitized;
  }
  return null;
}

/** 52XXXXXXXXXX (12) -> 521XXXXXXXXXX ; XXXXXXXXXX (10, local MX) -> 521XXXXXXXXXX */
function mxHistoricVariant(sanitized: string): string | null {
  if (sanitized.startsWith("52") && sanitized.length === 12) {
    return "521" + sanitized.slice(2);
  }
  if (sanitized.length === 10) {
    return "521" + sanitized;
  }
  return null;
}

/**
 * Candidatos seguros de búsqueda a partir del input crudo: el valor
 * sanitizado tal cual, más las variantes canónica (52) e histórica (521)
 * de México cuando apliquen. Deduplicado, solo formatos válidos
 * (10-15 dígitos, igual que el check del backend y de la función SQL).
 */
export function buildLookupCandidates(rawInput: string): string[] {
  const sanitized = sanitizeDigits(rawInput);
  const raw = [sanitized, mxCanonicalVariant(sanitized), mxHistoricVariant(sanitized)];
  const valid = raw.filter((c): c is string => !!c && DIGITS_ONLY.test(c));
  return Array.from(new Set(valid));
}

export interface ContactPreview {
  numero_masked: string;
  lead_found: boolean;
  whatsapp_leads: number;
  crm_suggestions: number;
  crm_proposals: number;
  crm_activities: number;
  whatsapp_requerimientos: number;
  whatsapp_mensajes: number;
  whatsapp_conversations: number;
  whatsapp_clientes: number;
  acquisition_events_linked: number;
}

export function totalRows(p: ContactPreview): number {
  return (
    p.whatsapp_leads +
    p.crm_suggestions +
    p.crm_proposals +
    p.crm_activities +
    p.whatsapp_requerimientos +
    p.whatsapp_mensajes +
    p.whatsapp_conversations +
    p.whatsapp_clientes +
    p.acquisition_events_linked
  );
}

export type ResolveResult =
  | { status: "invalid" }
  | { status: "empty"; candidates: string[] }
  | { status: "ambiguous"; candidates: string[] }
  | { status: "resolved"; numero: string; candidates: string[]; preview: ContactPreview };

/**
 * Prueba cada candidato con `fetchPreview` (solo lectura) y resuelve a
 * exactamente UN número real antes de que el caller borre nada.
 *
 * - Ningún candidato con registros -> "empty" (no hay nada que borrar).
 * - Más de un candidato con registros -> "ambiguous": aborta, no se puede
 *   asumir cuál es el contacto real sin intervención humana.
 * - Exactamente uno con registros -> "resolved": ese es el número a usar,
 *   siempre, para preview final, reset, limpieza de idempotency y verificación.
 */
export async function resolveContactNumero(
  rawInput: string,
  fetchPreview: (numero: string) => Promise<ContactPreview>,
): Promise<ResolveResult> {
  const candidates = buildLookupCandidates(rawInput);
  if (candidates.length === 0) return { status: "invalid" };

  const found: Array<{ numero: string; preview: ContactPreview }> = [];
  for (const candidate of candidates) {
    const preview = await fetchPreview(candidate);
    if (totalRows(preview) > 0) found.push({ numero: candidate, preview });
  }

  if (found.length === 0) return { status: "empty", candidates };
  if (found.length > 1) return { status: "ambiguous", candidates: found.map((f) => f.numero) };
  return { status: "resolved", numero: found[0].numero, candidates, preview: found[0].preview };
}
