import { normalizeDocNumber, normalizeText, parseDate } from "@/lib/normalizer";

export interface ActaFields {
  tipo_acta: string | null;
  numero_acta: string | null;
  fecha_emision: string | null;
  entidad_emisora: string | null;
  nombres_involucrados: string[];
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  fields: ActaFields;
}

const VALID_TYPES = ["NACIMIENTO", "MATRIMONIO", "DEFUNCION", "OTRO"];

// Las actas no deben ser emitidas a más de 100 años ni en el futuro
const MAX_AGE_YEARS = 100;

export function validateActa(raw: ActaFields): ValidationResult {
  const issues: string[] = [];

  const fields: ActaFields = {
    tipo_acta: raw.tipo_acta ? normalizeText(raw.tipo_acta) : null,
    numero_acta: raw.numero_acta ? normalizeDocNumber(raw.numero_acta) : null,
    fecha_emision: raw.fecha_emision?.trim() ?? null,
    entidad_emisora: raw.entidad_emisora ? normalizeText(raw.entidad_emisora) : null,
    nombres_involucrados: (raw.nombres_involucrados ?? []).map((n) =>
      normalizeText(n)
    ),
  };

  // 1. Tipo de acta reconocido
  if (!fields.tipo_acta) {
    issues.push("Tipo de acta no detectado");
  } else if (!VALID_TYPES.includes(fields.tipo_acta)) {
    issues.push(`Tipo de acta desconocido: '${fields.tipo_acta}'`);
  }

  // 2. Número de acta presente
  if (!fields.numero_acta) {
    issues.push("Número de acta ausente o ilegible");
  }

  // 3. Entidad emisora presente
  if (!fields.entidad_emisora) {
    issues.push("Entidad emisora no detectada");
  }

  // 4. Al menos un nombre involucrado
  if (fields.nombres_involucrados.length === 0) {
    issues.push("No se detectaron nombres de personas involucradas");
  }

  // 5. Fecha de emisión válida y coherente
  const emision = fields.fecha_emision ? parseDate(fields.fecha_emision) : null;

  if (fields.fecha_emision && !emision) {
    issues.push(`Fecha de emisión inválida: '${fields.fecha_emision}'`);
  }

  if (emision) {
    const now = new Date();
    if (emision > now) {
      issues.push("La fecha de emisión está en el futuro");
    }
    const ageYears =
      (now.getTime() - emision.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (ageYears > MAX_AGE_YEARS) {
      issues.push(
        `La fecha de emisión supera los ${MAX_AGE_YEARS} años de antigüedad permitidos`
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    fields,
  };
}
