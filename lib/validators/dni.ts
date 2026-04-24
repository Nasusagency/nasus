import { normalizeDocNumber, normalizeText, parseDate } from "@/lib/normalizer";

export interface DniFields {
  nombres: string | null;
  apellidos: string | null;
  numero_documento: string | null;
  fecha_nacimiento: string | null;
  fecha_vencimiento: string | null;
  pais: string | null;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  fields: DniFields;
}

// Reglas de formato de número de documento por país
const DOC_NUMBER_RULES: Record<string, RegExp> = {
  PE: /^\d{8}$/,          // Perú: 8 dígitos exactos
  AR: /^\d{7,8}$/,        // Argentina: 7 u 8 dígitos
  CO: /^\d{6,10}$/,       // Colombia: 6–10 dígitos
  ES: /^\d{8}[A-Z]$/,     // España: 8 dígitos + letra
  MX: /^[A-Z0-9]{10,20}$/,                      // INE: Clave de Elector (18 chars) u otros formatos MX
  DEFAULT: /^[A-Z0-9]{6,12}$/,
};

const MIN_AGE = 0;
const MAX_AGE = 120;

function countryCode(pais: string | null): string {
  if (!pais) return "DEFAULT";
  const normalized = normalizeText(pais);
  if (normalized.includes("PERU") || normalized === "PE") return "PE";
  if (normalized.includes("ARGENTINA") || normalized === "AR") return "AR";
  if (normalized.includes("COLOMBIA") || normalized === "CO") return "CO";
  if (normalized.includes("ESPANA") || normalized === "ES") return "ES";
  if (normalized.includes("MEXICO") || normalized === "MX" || normalized.includes("MEXICANOS")) return "MX";
  return "DEFAULT";
}

export function validateDni(raw: DniFields): ValidationResult {
  const issues: string[] = [];

  const fields: DniFields = {
    nombres: raw.nombres ? normalizeText(raw.nombres) : null,
    apellidos: raw.apellidos ? normalizeText(raw.apellidos) : null,
    numero_documento: raw.numero_documento
      ? normalizeDocNumber(raw.numero_documento)
      : null,
    fecha_nacimiento: raw.fecha_nacimiento?.trim() ?? null,
    fecha_vencimiento: raw.fecha_vencimiento?.trim() ?? null,
    pais: raw.pais ? normalizeText(raw.pais) : null,
  };

  // 1. Campos obligatorios presentes
  if (!fields.nombres) issues.push("Nombres no detectados o ilegibles");
  if (!fields.apellidos) issues.push("Apellidos no detectados o ilegibles");
  if (!fields.numero_documento) issues.push("Número de documento ausente");

  // 2. Formato del número de documento según país
  if (fields.numero_documento) {
    const code = countryCode(fields.pais);
    const rule = DOC_NUMBER_RULES[code] ?? DOC_NUMBER_RULES.DEFAULT;
    if (!rule.test(fields.numero_documento)) {
      issues.push(
        `Número de documento '${fields.numero_documento}' no cumple el formato esperado para ${code}`
      );
    }
  }

  // 3. Fechas válidas
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

  // 4. Coherencia de fechas
  if (nacimiento) {
    const now = new Date();
    const age = (now.getTime() - nacimiento.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (age < MIN_AGE || age > MAX_AGE) {
      issues.push(`Edad calculada fuera de rango: ${Math.round(age)} años`);
    }
    if (nacimiento > now) {
      issues.push("La fecha de nacimiento está en el futuro");
    }
  }

  if (nacimiento && vencimiento && vencimiento <= nacimiento) {
    issues.push("La fecha de vencimiento debe ser posterior a la de nacimiento");
  }

  return {
    valid: issues.length === 0,
    issues,
    fields,
  };
}
