import { normalizeDocNumber, normalizeText, parseDate } from "@/lib/normalizer";

export interface PasaporteFields {
  nombres: string | null;
  apellidos: string | null;
  numero_pasaporte: string | null;
  fecha_nacimiento: string | null;
  fecha_vencimiento: string | null;
  nacionalidad: string | null;
  curp: string | null;
  lugar_nacimiento: string | null;
  mrz_line1: string | null;
  mrz_line2: string | null;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  fields: PasaporteFields;
}

// Pasaporte mexicano: siempre 9 caracteres
// Formato antiguo: G + 8 dígitos (ej. G12345678)
// Formato moderno: 2 letras + 7 dígitos (ej. AB1234567)
const PASAPORTE_REGEX = /^(?:[A-Z]\d{8}|[A-Z]{2}\d{7})$/;

const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;

/** Compara los AAMMDD codificados en la CURP contra una fecha YYYY-MM-DD. */
function curpDateMatchesBirthDate(curp: string, fecha: string): boolean {
  const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return true;
  const yy = m[1].substring(2);
  return curp.substring(4, 6) === yy && curp.substring(6, 8) === m[2] && curp.substring(8, 10) === m[3];
}

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
    curp: raw.curp ? normalizeDocNumber(raw.curp).toUpperCase() : null,
    lugar_nacimiento: raw.lugar_nacimiento ? raw.lugar_nacimiento.trim() : null,
    mrz_line1: raw.mrz_line1 ? raw.mrz_line1.trim() : null,
    mrz_line2: raw.mrz_line2 ? raw.mrz_line2.trim() : null,
  };

  if (!fields.nombres) issues.push("Nombres no detectados o ilegibles");
  if (!fields.apellidos) issues.push("Apellidos no detectados o ilegibles");
  if (!fields.numero_pasaporte) issues.push("Número de pasaporte ausente");

  if (fields.numero_pasaporte && !PASAPORTE_REGEX.test(fields.numero_pasaporte)) {
    issues.push(
      `Número de pasaporte '${fields.numero_pasaporte}' no cumple el formato mexicano (9 caracteres: 1-2 letras + dígitos)`
    );
  }

  // Validación de CURP si está presente
  if (fields.curp) {
    if (fields.curp.length !== 18 || !CURP_REGEX.test(fields.curp)) {
      issues.push(`CURP '${fields.curp}' en el pasaporte no cumple el formato oficial`);
    } else if (fields.fecha_nacimiento) {
      // Validación cruzada: fecha codificada en CURP vs fecha_nacimiento
      const fechaParsed = parseDate(fields.fecha_nacimiento);
      if (fechaParsed && !curpDateMatchesBirthDate(fields.curp, fields.fecha_nacimiento)) {
        issues.push(
          "La fecha codificada en la CURP no coincide con la fecha de nacimiento del pasaporte"
        );
      }
    }
  }

  // Validación de número de pasaporte en MRZ
  if (fields.mrz_line2 && fields.numero_pasaporte) {
    const mrzPassNum = fields.mrz_line2.substring(0, 9).replace(/</g, "");
    if (mrzPassNum && mrzPassNum !== fields.numero_pasaporte) {
      issues.push(
        "El número de pasaporte en la zona MRZ no coincide con el número impreso"
      );
    }
  }

  const nacimiento = fields.fecha_nacimiento ? parseDate(fields.fecha_nacimiento) : null;
  const vencimiento = fields.fecha_vencimiento ? parseDate(fields.fecha_vencimiento) : null;

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
    issues.push("La fecha de vencimiento debe ser posterior a la de nacimiento");
  }

  return { valid: issues.length === 0, issues, fields };
}
