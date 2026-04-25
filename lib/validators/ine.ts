import { normalizeDocNumber, normalizeText, parseDate } from "@/lib/normalizer";

export interface IneFields {
  nombres: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  clave_elector: string | null;
  curp: string | null;
  fecha_nacimiento: string | null;
  fecha_vencimiento: string | null;
  seccion: string | null;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  fields: IneFields;
}

// Clave de elector: 18 alfanuméricos, los primeros 6 siempre son letras
// Estructura: 6 letras (iniciales del nombre) + 6 dígitos (AAMMDD) +
//             2 dígitos (entidad) + 3 dígitos (sección) + 1 alfanumérico (dígito verificador)
const CLAVE_ELECTOR_REGEX = /^[A-Z]{6}[A-Z0-9]{12}$/;

// Validación básica de CURP embebida en la credencial
const CURP_BASIC_REGEX =
  /^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;

export function validateIne(raw: IneFields): ValidationResult {
  const issues: string[] = [];

  const fields: IneFields = {
    nombres: raw.nombres ? normalizeText(raw.nombres) : null,
    apellido_paterno: raw.apellido_paterno
      ? normalizeText(raw.apellido_paterno)
      : null,
    apellido_materno: raw.apellido_materno
      ? normalizeText(raw.apellido_materno)
      : null,
    clave_elector: raw.clave_elector
      ? normalizeDocNumber(raw.clave_elector).toUpperCase()
      : null,
    curp: raw.curp
      ? normalizeDocNumber(raw.curp).toUpperCase()
      : null,
    fecha_nacimiento: raw.fecha_nacimiento?.trim() ?? null,
    fecha_vencimiento: raw.fecha_vencimiento?.trim() ?? null,
    seccion: raw.seccion?.trim() ?? null,
  };

  if (!fields.nombres) issues.push("Nombres no detectados o ilegibles");
  if (!fields.apellido_paterno) issues.push("Apellido paterno ausente");
  if (!fields.clave_elector) issues.push("Clave de elector ausente");

  if (fields.clave_elector) {
    if (
      fields.clave_elector.length !== 18 ||
      !CLAVE_ELECTOR_REGEX.test(fields.clave_elector)
    ) {
      issues.push(
        `Clave de elector '${fields.clave_elector}' no cumple el formato (18 caracteres alfanuméricos, primeros 6 letras)`
      );
    }
  }

  if (fields.curp && !CURP_BASIC_REGEX.test(fields.curp)) {
    issues.push("CURP impresa en la credencial no cumple el formato oficial");
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
    issues.push("La credencial está vencida");
  }

  return { valid: issues.length === 0, issues, fields };
}
