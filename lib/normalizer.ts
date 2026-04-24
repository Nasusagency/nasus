/**
 * Normalizes OCR-extracted text to reduce noise before validation.
 * Handles common Gemini misreads: O↔0, I↔1, accents, stray chars.
 */

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")                          // descompone tildes
    .replace(/[̀-ͯ]/g, "")           // elimina diacríticos
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")              // solo alfanumérico y espacios
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDocNumber(value: string): string {
  // elimina espacios, guiones y puntos que el OCR suele insertar
  return value.replace(/[\s\-\.]/g, "").toUpperCase();
}

/** Expects YYYY-MM-DD; returns null if the string is not a valid date. */
export function parseDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

export function normalizeFields<T extends Record<string, unknown>>(fields: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(fields)) {
    if (typeof val === "string") {
      result[key] = normalizeText(val);
    } else if (Array.isArray(val)) {
      result[key] = val.map((v) => (typeof v === "string" ? normalizeText(v) : v));
    } else {
      result[key] = val;
    }
  }
  return result as T;
}
