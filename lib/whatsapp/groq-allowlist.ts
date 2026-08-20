/**
 * Allowlist para pruebas controladas de Groq Agent
 *
 * Permite activar Groq solo para números autorizados mientras se mantiene Claude
 * como fallback y default para el resto.
 */

/**
 * Normaliza un número de teléfono para comparación.
 * - Elimina caracteres no numéricos (excepto +)
 * - Para México: normaliza 521XXXXXXXXXX → 52XXXXXXXXXX
 * - Mantiene el formato sin caracteres especiales: solo dígitos
 */
export function normalizePhoneNumber(numero: string): string {
  if (!numero) return "";

  // Paso 1: Eliminar espacios, guiones, paréntesis, puntos
  let cleaned = numero.replace(/[^\d+]/g, "");

  // Paso 2: Eliminar el + al inicio si existe
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  // Paso 3: Regla específica para México
  // WhatsApp puede entregar números mexicanos como:
  // - 5213331002790 (52 + 1 + 10 dígitos nacionales) → normalizar a 523331002790
  // - 523331002790 (52 + 10 dígitos nacionales) → mantener igual
  // Indicador: 13 dígitos empezando con 521 = mexicano con lada de 1
  if (cleaned.startsWith("521") && cleaned.length === 13) {
    cleaned = "52" + cleaned.substring(3);
  }

  return cleaned;
}

/**
 * Verifica si un número está autorizado para Groq.
 *
 * @param numero Número de teléfono (con o sin +)
 * @param allowlistEnv Variable de entorno `WHATSAPP_GROQ_TEST_NUMBERS` (ej: "523331002790,523331002791")
 * @returns true si el número está en la allowlist
 */
export function isNumberInGroqAllowlist(numero: string, allowlistEnv?: string): boolean {
  // Si no hay allowlist configurada, nadie está autorizado
  if (!allowlistEnv || !allowlistEnv.trim()) {
    return false;
  }

  const normalized = normalizePhoneNumber(numero);
  if (!normalized) return false;

  // Parsear CSV: split por coma y normalizar cada número
  const allowedNumbers = allowlistEnv
    .split(",")
    .map((n) => normalizePhoneNumber(n.trim()))
    .filter((n) => n.length > 0);

  return allowedNumbers.includes(normalized);
}

/**
 * Enmascarar número de teléfono para logging (sin PII)
 * Ej: "523331002790" → "523331***790"
 */
export function maskPhoneNumber(numero: string): string {
  const normalized = normalizePhoneNumber(numero);
  if (normalized.length < 6) return "***";

  const start = normalized.slice(0, 3);
  const end = normalized.slice(-3);
  return `${start}***${end}`;
}

/**
 * Elige el provider (Groq o Claude) basado en:
 * 1. Feature flag WHATSAPP_AGENT_PROVIDER
 * 2. Allowlist WHATSAPP_GROQ_TEST_NUMBERS
 * 3. Número del contacto
 */
export function selectProvider(
  numero: string,
  envProvider?: string,
  envAllowlist?: string
): "groq" | "claude" {
  const provider = (envProvider || "claude").toLowerCase();

  // Si feature flag no es "groq", siempre usar Claude
  if (provider !== "groq") {
    return "claude";
  }

  // Si Groq está activado pero no hay allowlist, rechazarlo por seguridad
  if (!envAllowlist || !envAllowlist.trim()) {
    console.warn(
      "[groq-allowlist] WHATSAPP_AGENT_PROVIDER=groq pero WHATSAPP_GROQ_TEST_NUMBERS vacío: usando Claude"
    );
    return "claude";
  }

  // Verificar si el número está autorizado
  if (isNumberInGroqAllowlist(numero, envAllowlist)) {
    return "groq";
  }

  // No está autorizado: usar Claude
  return "claude";
}
