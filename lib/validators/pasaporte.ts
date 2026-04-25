import { normalizeDocNumber, normalizeText, parseDate } from "@/lib/normalizer";

export interface PasaporteFields {
  nombres: string | null;
  apellidos: string | null;
  numero_pasaporte: string | null;
  fecha_nacimiento: string | null;
  fecha_vencimiento: string | null;
  nacionalidad: string | null;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  fields: PasaporteFields;
}

// Pasaporte mexicano: siempre 9 caracteres alfanuméricos
// Formato pre-2009: G + 8 dígitos (ej. G12345678)
// Formato moderno:  2 letras + 7 dígitos (ej. AB1234567)
const PASAPORTE_REGEX = /^(?:[A-Z]\d{8}|[A-Z]{2}\d{7})$/;

export function validatePasaporte(raw: PasaporteFields): ValidationResult {
  const issues: string[] = [];

  const fields: PasaporteFields = {
    nombres: raw.nombres ? normalizeText(raw.nombres) : null,
    apellidos: raw.apellidos ? normalizeText(raw.apellidos) : null,
    numero_pasaporte: raw.numero_pasaporte
      ? normalizeDocNumber(raw.numero_pasaporte).toUpperCase()
      : null,
    fecha_nacimiento: raw.fecha_nacimiento?.trim() ?? null,
    fecha_vencimiento: raw.fecha_vencimiento?.trim() ?? null,
    nacionalidad: raw.nacionalidad ? normalizeText(raw.nacionalidad) : null,
  };

  if (!fields.nombres) issues.push("Nombres no detectados o ilegibles");
  if (!fields.apellidos) issues.push("Apellidos no detectados o ilegibles");
  if (!fields.numero_pasaporte) issues.push("Número de pasaporte ausente");

  if (
    fields.numero_pasaporte &&
    !PASAPORTE_REGEX.test(fields.numero_pasaporte)
  ) {
    issues.push(
      `Número de pasaporte '${fields.numero_pasaporte}' no cumple el formato mexicano (9 caracteres: 1-2 letras + dígitos)`
    );
  }

  const nacimiento = fields.fecha_nacimiento
    ? parseDate(fields.fecha_nacimiento)
    : null;
  const vencimiento = fields.fecha_vencimiento
    ? parseDate(fields.fecha_vencimiento)
    : null;

  if (fields.fecha_nacimiento && !nacimiento) {
    issues.push(`Fecha de nacimiento inválida: '${fields.fecha_nacimiento}'`);
  }
  if (fields.fecha_vencimiento && !vencimiento) {
    issues.push(`Fecha de vencimiento inválida: '${fields.fecha_vencimiento}'`);
  }
  if (vencimiento && vencimiento < new Date()) {
    issues.push("El pasaporte está vencido");
  }
  if (nacimiento && vencimiento && vencimiento <= nacimiento) {
    issues.push(
      "La fecha de vencimiento debe ser posterior a la de nacimiento"
    );
  }

  return { valid: issues.length === 0, issues, fields };
}
