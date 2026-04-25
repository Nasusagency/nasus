import { normalizeDocNumber, normalizeText } from "@/lib/normalizer";

export interface RfcFields {
  rfc: string | null;
  nombre: string | null;
  tipo_persona: "fisica" | "moral" | null;
  fecha: string | null;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  fields: RfcFields;
}

// Persona física: 4 chars nombre + 6 dígitos fecha + 3 alfanuméricos homoclave = 13
// Los primeros 4 chars pueden incluir Ñ y & (iniciales de apellidos y nombre)
const RFC_FISICA_REGEX = /^[A-ZÑ&]{4}\d{6}[A-Z\d]{3}$/;

// Persona moral: 3 chars razón social + 6 dígitos + 3 alfanuméricos = 12
const RFC_MORAL_REGEX = /^[A-ZÑ&]{3}\d{6}[A-Z\d]{3}$/;

export function validateRfc(raw: RfcFields): ValidationResult {
  const issues: string[] = [];

  // normalizeDocNumber preserva Ñ y & (solo elimina espacios, guiones y puntos)
  const rfc = raw.rfc ? normalizeDocNumber(raw.rfc).toUpperCase() : null;

  const fields: RfcFields = {
    rfc,
    nombre: raw.nombre ? normalizeText(raw.nombre) : null,
    tipo_persona: raw.tipo_persona ?? null,
    fecha: raw.fecha?.trim() ?? null,
  };

  if (!fields.rfc) {
    issues.push("RFC no detectado o ilegible");
    return { valid: false, issues, fields };
  }

  const len = fields.rfc.length;

  if (len !== 12 && len !== 13) {
    issues.push(
      `RFC debe tener 12 o 13 caracteres, se encontraron ${len}`
    );
    return { valid: false, issues, fields };
  }

  const esFisica = len === 13;
  const pattern = esFisica ? RFC_FISICA_REGEX : RFC_MORAL_REGEX;

  if (!pattern.test(fields.rfc)) {
    issues.push(
      `RFC '${fields.rfc}' no cumple el formato oficial para persona ${
        esFisica ? "física" : "moral"
      }`
    );
  }

  // Inferir tipo_persona desde la longitud si no viene del OCR
  if (!fields.tipo_persona) {
    fields.tipo_persona = esFisica ? "fisica" : "moral";
  }

  if (!fields.nombre) {
    issues.push("Nombre o razón social no detectados");
  }

  return { valid: issues.length === 0, issues, fields };
}
