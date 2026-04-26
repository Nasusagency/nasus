import { normalizeDocNumber, normalizeText, parseDate } from "@/lib/normalizer";
import { decodeCurp } from "@/lib/validators/curp";

export interface IneFields {
  nombres: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  clave_elector: string | null;
  curp: string | null;
  fecha_nacimiento: string | null;
  fecha_vencimiento: string | null;
  seccion: string | null;
  generacion: "2008" | "2014" | "2020" | null;
  domicilio: string | null;
  entidad: string | null;
  folio: string | null;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  fields: IneFields;
}

// Clave de elector: 18 alfanuméricos, primeros 6 siempre letras
const CLAVE_ELECTOR_REGEX = /^[A-Z]{6}[A-Z0-9]{12}$/;

// Validación básica de CURP embebida en la credencial
const CURP_BASIC_REGEX =
  /^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;

/** Compara los AAMMDD codificados en la CURP contra una fecha YYYY-MM-DD. */
function curpDateMatchesBirthDate(curp: string, fecha: string): boolean {
  const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return true;
  const yy = m[1].substring(2);
  return curp.substring(4, 6) === yy && curp.substring(6, 8) === m[2] && curp.substring(8, 10) === m[3];
}

export function validateIne(raw: IneFields): ValidationResult {
  const issues: string[] = [];

  const fields: IneFields = {
    nombres: raw.nombres ? normalizeText(raw.nombres) : null,
    apellido_paterno: raw.apellido_paterno ? normalizeText(raw.apellido_paterno) : null,
    apellido_materno: raw.apellido_materno ? normalizeText(raw.apellido_materno) : null,
    clave_elector: raw.clave_elector
      ? normalizeDocNumber(raw.clave_elector).toUpperCase()
      : null,
    curp: raw.curp ? normalizeDocNumber(raw.curp).toUpperCase() : null,
    fecha_nacimiento: raw.fecha_nacimiento?.trim() ?? null,
    fecha_vencimiento: raw.fecha_vencimiento?.trim() ?? null,
    seccion: raw.seccion?.trim() ?? null,
    generacion: raw.generacion ?? null,
    domicilio: raw.domicilio ? raw.domicilio.trim() : null,
    entidad: raw.entidad ? normalizeText(raw.entidad) : null,
    folio: raw.folio ? normalizeDocNumber(raw.folio) : null,
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
        "Clave de elector no cumple el formato (18 caracteres alfanuméricos, primeros 6 letras)"
      );
    }
  }

  if (fields.curp) {
    if (!CURP_BASIC_REGEX.test(fields.curp)) {
      issues.push("CURP impresa en la credencial no cumple el formato oficial");
    } else if (fields.fecha_nacimiento) {
      // Validación cruzada: fecha codificada en la CURP vs fecha de nacimiento
      const fechaParsed = parseDate(fields.fecha_nacimiento);
      if (fechaParsed && !curpDateMatchesBirthDate(fields.curp, fields.fecha_nacimiento)) {
        issues.push(
          "La fecha codificada en la CURP no coincide con la fecha de nacimiento del documento"
        );
      }
    }
  }

  // Validación cruzada: fecha de nacimiento codificada en la clave de elector (posiciones 7-12 = AAMMDD)
  if (
    fields.clave_elector &&
    fields.clave_elector.length === 18 &&
    CLAVE_ELECTOR_REGEX.test(fields.clave_elector) &&
    fields.fecha_nacimiento
  ) {
    const claveDate = fields.clave_elector.substring(6, 12); // AAMMDD
    const fechaParsed = parseDate(fields.fecha_nacimiento);
    if (fechaParsed) {
      const yy = fields.fecha_nacimiento.substring(2, 4);
      const mm = fields.fecha_nacimiento.substring(5, 7);
      const dd = fields.fecha_nacimiento.substring(8, 10);
      if (claveDate !== `${yy}${mm}${dd}`) {
        issues.push(
          "La fecha codificada en la clave de elector no coincide con la fecha de nacimiento"
        );
      }
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
    issues.push("La credencial está vencida");
  }

  // Detectar generación inconsistente: gen 2014/2020 deberían tener CURP
  if (fields.generacion && fields.generacion !== "2008" && !fields.curp) {
    issues.push(
      `Credencial generación ${fields.generacion} debería incluir CURP pero no fue detectada`
    );
  }

  // Exportamos el resultado de decodeCurp para posibles usos externos (sin effect en issues)
  void decodeCurp;

  return { valid: issues.length === 0, issues, fields };
}
