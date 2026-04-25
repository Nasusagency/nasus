import { normalizeDocNumber, normalizeText, parseDate } from "@/lib/normalizer";

export interface ActaFields {
  tipo_acta: string | null;
  numero_acta: string | null;
  fecha_emision: string | null;
  entidad_emisora: string | null;
  nombres_involucrados: string[];
  // Campos enriquecidos (principalmente para nacimiento)
  nombre_registrado: string | null;
  fecha_nacimiento: string | null;
  nombre_madre: string | null;
  nombre_padre: string | null;
  curp: string | null;
  folio_renasp: string | null;
  formato: "pre2021" | "post2021" | null;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  fields: ActaFields;
}

const VALID_TYPES = ["NACIMIENTO", "MATRIMONIO", "DEFUNCION", "OTRO"];
const MAX_AGE_YEARS = 100;
const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;

export function validateActa(raw: ActaFields): ValidationResult {
  const issues: string[] = [];

  const fields: ActaFields = {
    tipo_acta: raw.tipo_acta ? normalizeText(raw.tipo_acta) : null,
    numero_acta: raw.numero_acta ? normalizeDocNumber(raw.numero_acta) : null,
    fecha_emision: raw.fecha_emision?.trim() ?? null,
    entidad_emisora: raw.entidad_emisora ? normalizeText(raw.entidad_emisora) : null,
    nombres_involucrados: (raw.nombres_involucrados ?? []).map((n) => normalizeText(n)),
    nombre_registrado: raw.nombre_registrado ? normalizeText(raw.nombre_registrado) : null,
    fecha_nacimiento: raw.fecha_nacimiento?.trim() ?? null,
    nombre_madre: raw.nombre_madre ? normalizeText(raw.nombre_madre) : null,
    nombre_padre: raw.nombre_padre ? normalizeText(raw.nombre_padre) : null,
    curp: raw.curp ? raw.curp.trim().toUpperCase() : null,
    folio_renasp: raw.folio_renasp ? raw.folio_renasp.trim() : null,
    formato: raw.formato ?? null,
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
  if (fields.nombres_involucrados.length === 0 && !fields.nombre_registrado) {
    issues.push("No se detectaron nombres de personas involucradas");
  }

  // 5. Validaciones específicas para NACIMIENTO
  if (fields.tipo_acta === "NACIMIENTO") {
    if (!fields.nombre_registrado) {
      issues.push("Nombre del registrado ausente o ilegible");
    }
    if (!fields.fecha_nacimiento) {
      issues.push("Fecha de nacimiento del registrado ausente");
    }
    if (!fields.nombre_madre && !fields.nombre_padre) {
      issues.push("Se requiere al menos el nombre de uno de los padres");
    }
  }

  // 6. Validar CURP si está presente
  if (fields.curp) {
    if (fields.curp.length !== 18 || !CURP_REGEX.test(fields.curp)) {
      issues.push(`CURP '${fields.curp}' en el acta no cumple el formato oficial`);
    } else if (fields.fecha_nacimiento) {
      // Validación cruzada fecha codificada en CURP vs fecha_nacimiento del acta
      const m = fields.fecha_nacimiento.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) {
        const yy = m[1].substring(2);
        if (
          fields.curp.substring(4, 6) !== yy ||
          fields.curp.substring(6, 8) !== m[2] ||
          fields.curp.substring(8, 10) !== m[3]
        ) {
          issues.push("La fecha codificada en la CURP no coincide con la fecha de nacimiento del acta");
        }
      }
    }
  }

  // 7. Consistencia formato/folio
  if (fields.folio_renasp && fields.formato === "pre2021") {
    issues.push("El acta indica formato pre-2021 pero tiene folio RENASP (inconsistente)");
  }

  // 8. Fecha de emisión válida y coherente
  const emision = fields.fecha_emision ? parseDate(fields.fecha_emision) : null;

  if (fields.fecha_emision && !emision) {
    issues.push(`Fecha de emisión inválida: '${fields.fecha_emision}'`);
  }

  if (emision) {
    const now = new Date();
    if (emision > now) {
      issues.push("La fecha de emisión está en el futuro");
    }
    const ageYears = (now.getTime() - emision.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (ageYears > MAX_AGE_YEARS) {
      issues.push(`La fecha de emisión supera los ${MAX_AGE_YEARS} años de antigüedad permitidos`);
    }
  }

  // 9. Fecha de nacimiento válida (si aplica)
  if (fields.fecha_nacimiento) {
    const nacimiento = parseDate(fields.fecha_nacimiento);
    if (!nacimiento) {
      issues.push(`Fecha de nacimiento inválida: '${fields.fecha_nacimiento}'`);
    } else if (emision && nacimiento > emision) {
      issues.push("La fecha de nacimiento es posterior a la fecha de emisión del acta");
    }
  }

  return { valid: issues.length === 0, issues, fields };
}
