import { validateActa, type ActaFields } from "@/lib/validators/acta";
import { adaptResult, type DocumentConfig, type FieldDef } from "../types";

const fieldDefs: FieldDef[] = [
  { key: "tipo_acta", label: "Tipo de acta", required: true, editable: false },
  { key: "numero_acta", label: "N.º acta", required: true, editable: true },
  { key: "fecha_emision", label: "Fecha de emisión", required: false, editable: false },
  { key: "entidad_emisora", label: "Entidad emisora", required: true, editable: false },
  { key: "nombres_involucrados", label: "Personas involucradas", required: false, editable: false },
  { key: "nombre_registrado", label: "Nombre del registrado", required: false, editable: true },
  { key: "fecha_nacimiento", label: "Fecha de nacimiento", required: false, editable: true },
  { key: "nombre_madre", label: "Nombre de la madre", required: false, editable: true },
  { key: "nombre_padre", label: "Nombre del padre", required: false, editable: true },
  { key: "curp", label: "CURP", required: false, editable: true },
  { key: "folio_renasp", label: "Folio RENASP", required: false, editable: false },
  { key: "formato", label: "Formato", required: false, editable: false },
];

export const ACTA_CONFIG: DocumentConfig = {
  id: "acta",
  name: "Acta del Registro Civil",
  description: "Acta oficial emitida por el Registro Civil mexicano",
  countries: ["MX"],
  fieldDefs,
  validate: (raw) => adaptResult(validateActa(raw as unknown as ActaFields)),
  diditSupported: false,
  systemPrompt: `Eres un sistema experto en Actas del Registro Civil mexicano.

FORMATOS DE ACTA:
• Post-2021 (RENASP): formato nacional uniforme, folio RENASP, código QR verificable, datos estructurados
• Pre-2021: formatos variados por estado y municipio, pueden ser manuscritas o impresas

TIPOS DE ACTA: nacimiento, matrimonio, defuncion, otro

Analiza la imagen o documento y responde ÚNICAMENTE con un objeto JSON válido:
{
  "type": "acta",
  "valid": boolean,
  "fields": {
    "tipo_acta": "nacimiento" | "matrimonio" | "defuncion" | "otro" | null,
    "numero_acta": string | null,
    "fecha_emision": string | null,
    "entidad_emisora": string | null,
    "nombres_involucrados": string[],
    "nombre_registrado": string | null,
    "fecha_nacimiento": string | null,
    "nombre_madre": string | null,
    "nombre_padre": string | null,
    "curp": string | null,
    "folio_renasp": string | null,
    "formato": "pre2021" | "post2021" | null
  },
  "issues": string[]
}

REGLAS:
• "nombre_registrado": nombre completo de la persona principal (para nacimiento: el bebé).
• "nombre_madre" y "nombre_padre": solo para acta de nacimiento; null para otros tipos.
• "curp": CURP del registrado si aparece (18 caracteres); null si no aparece.
• "folio_renasp": código alfanumérico del folio RENASP (formato post-2021).
• Todas las fechas en formato YYYY-MM-DD.
• "valid": true solo si tipo de acta, número de acta y entidad emisora son identificables y sin anomalías graves.`,
};
