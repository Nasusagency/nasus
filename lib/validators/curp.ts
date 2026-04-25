import { normalizeDocNumber, normalizeText } from "@/lib/normalizer";

export interface CurpFields {
  curp: string | null;
  nombres: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  fecha_nacimiento: string | null;
  sexo: string | null;
  entidad_nacimiento: string | null;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  fields: CurpFields;
}

// Estados y entidades federativas válidos en CURP (NE = nacido en el extranjero)
const ESTADOS_CURP = new Set([
  "AS", "BC", "BS", "CC", "CL", "CM", "CS", "CH", "DF", "DG",
  "GT", "GR", "HG", "JC", "MC", "MN", "MS", "NT", "NL", "OC",
  "PL", "QT", "QR", "SP", "SL", "SR", "TC", "TS", "TL", "VZ",
  "YN", "ZS", "NE",
]);

// Formato oficial CURP de 18 caracteres:
//   posiciones 0-3:   4 letras (iniciales de nombre y apellidos)
//   posiciones 4-9:   6 dígitos AAMMDD fecha de nacimiento
//   posición 10:      H o M (sexo)
//   posiciones 11-12: 2 letras clave de entidad federativa
//   posiciones 13-15: 3 consonantes internas
//   posición 16:      1 alfanumérico (homoclave)
//   posición 17:      1 dígito verificador
const CURP_REGEX =
  /^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;

export function validateCurp(raw: CurpFields): ValidationResult {
  const issues: string[] = [];

  const curp = raw.curp ? normalizeDocNumber(raw.curp).toUpperCase() : null;

  const fields: CurpFields = {
    curp,
    nombres: raw.nombres ? normalizeText(raw.nombres) : null,
    apellido_paterno: raw.apellido_paterno
      ? normalizeText(raw.apellido_paterno)
      : null,
    apellido_materno: raw.apellido_materno
      ? normalizeText(raw.apellido_materno)
      : null,
    fecha_nacimiento: raw.fecha_nacimiento?.trim() ?? null,
    sexo: raw.sexo ? raw.sexo.trim().toUpperCase() : null,
    entidad_nacimiento: raw.entidad_nacimiento
      ? normalizeText(raw.entidad_nacimiento)
      : null,
  };

  if (!fields.curp) {
    issues.push("CURP no detectada o ilegible");
    return { valid: false, issues, fields };
  }

  if (fields.curp.length !== 18) {
    issues.push(
      `CURP debe tener 18 caracteres, se encontraron ${fields.curp.length}`
    );
    return { valid: false, issues, fields };
  }

  if (!CURP_REGEX.test(fields.curp)) {
    issues.push(
      `CURP '${fields.curp}' no cumple el formato oficial (letras, fecha, sexo, entidad, consonantes)`
    );
  } else {
    const estado = fields.curp.substring(11, 13);
    if (!ESTADOS_CURP.has(estado)) {
      issues.push(`Código de entidad en CURP no reconocido: '${estado}'`);
    }

    const sexoEnCurp = fields.curp.charAt(10);
    if (fields.sexo && fields.sexo !== sexoEnCurp) {
      issues.push(
        `Sexo en CURP (${sexoEnCurp}) difiere del campo sexo (${fields.sexo})`
      );
    }
  }

  return { valid: issues.length === 0, issues, fields };
}
