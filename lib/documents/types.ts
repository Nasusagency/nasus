export type DocumentType = "dni" | "acta" | "ine" | "curp" | "rfc" | "pasaporte";

export interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  editable: boolean;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  fields: Record<string, unknown>;
}

export interface DiditArgs {
  curp: string;
  nombres?: string | null;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  fecha_nacimiento?: string | null;
}

export interface DocumentConfig {
  id: DocumentType;
  name: string;
  description: string;
  countries: string[];
  fieldDefs: FieldDef[];
  validate: (raw: Record<string, unknown>) => ValidationResult;
  systemPrompt: string;
  diditSupported: boolean;
  getDiditArgs?: (fields: Record<string, unknown>) => DiditArgs | null;
  deriveFields?: (fields: Record<string, unknown>) => Record<string, unknown>;
}

export function adaptResult(r: {
  valid: boolean;
  issues: string[];
  fields: unknown;
}): ValidationResult {
  return { valid: r.valid, issues: r.issues, fields: r.fields as Record<string, unknown> };
}
