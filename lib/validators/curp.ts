import { normalizeDocNumber, normalizeText, parseDate } from "@/lib/normalizer";

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

// Formato oficial CURP de 18 caracteres
const CURP_REGEX =
  /^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;

/**
 * Extrae los datos codificados en la cadena CURP.
 * Requiere que la CURP ya haya pasado la validación de formato (CURP_REGEX).
 */
export function decodeCurp(curp: string): {
  fechaNacimiento: string;
  sexo: "H" | "M";
  estadoClave: string;
} | null {
  if (!CURP_REGEX.test(curp)) return null;
  const aa = curp.substring(4, 6);
  const mm = curp.substring(6, 8);
  const dd = curp.substring(8, 10);
  const aaNum = parseInt(aa, 10);
  const currentYY = new Date().getFullYear() % 100;
  const year = aaNum <= currentYY ? `20${aa}` : `19${aa}`;
  return {
    fechaNacimiento: `${year}-${mm}-${dd}`,
    sexo: curp.charAt(10) as "H" | "M",
    estadoClave: curp.substring(11, 13),
  };
}

/** Compara los AAMMDD codificados en la CURP contra una fecha YYYY-MM-DD. */
function curpDateMatchesBirthDate(curp: string, fecha: string): boolean {
  const nacMatch = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!nacMatch) return true; // fecha inválida — no bloquear aquí
  const yy = nacMatch[1].substring(2);
  const mm = nacMatch[2];
  const dd = nacMatch[3];
  return (
    curp.substring(4, 6) === yy &&
    curp.substring(6, 8) === mm &&
    curp.substring(8, 10) === dd
  );
}

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

    // Validación cruzada: fecha codificada en CURP vs fecha_nacimiento del documento
    if (fields.fecha_nacimiento) {
      const fechaParsed = parseDate(fields.fecha_nacimiento);
      if (fechaParsed && !curpDateMatchesBirthDate(fields.curp, fields.fecha_nacimiento)) {
        issues.push(
          "La fecha codificada en la CURP no coincide con la fecha de nacimiento del documento"
        );
      }
    }
  }

  return { valid: issues.length === 0, issues, fields };
}
