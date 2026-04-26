import { validatePasaporte, type PasaporteFields } from "@/lib/validators/pasaporte";
import { adaptResult, type DocumentConfig, type FieldDef } from "../types";

const fieldDefs: FieldDef[] = [
  { key: "nombres", label: "Nombres", required: true, editable: true },
  { key: "apellidos", label: "Apellidos", required: true, editable: true },
  { key: "numero_pasaporte", label: "N.º de pasaporte", required: true, editable: true },
  { key: "fecha_nacimiento", label: "Fecha de nacimiento", required: false, editable: true },
  { key: "fecha_vencimiento", label: "Fecha de vencimiento", required: false, editable: false },
  { key: "nacionalidad", label: "Nacionalidad", required: false, editable: false },
  { key: "curp", label: "CURP", required: false, editable: true },
  { key: "lugar_nacimiento", label: "Lugar de nacimiento", required: false, editable: false },
  { key: "mrz_line1", label: "MRZ línea 1", required: false, editable: false },
  { key: "mrz_line2", label: "MRZ línea 2", required: false, editable: false },
];

export const PASAPORTE_CONFIG: DocumentConfig = {
  id: "pasaporte",
  name: "Pasaporte Mexicano",
  description: "Pasaporte emitido por la Secretaría de Relaciones Exteriores (SRE)",
  countries: ["MX"],
  fieldDefs,
  validate: (raw) => adaptResult(validatePasaporte(raw as PasaporteFields)),
  diditSupported: false,
  systemPrompt: `Eres un sistema experto en Pasaportes Mexicanos emitidos por la Secretaría de Relaciones Exteriores (SRE).

FORMATO DEL PASAPORTE MEXICANO:
• Tipo ICAO P (pasaporte ordinario)
• Número de pasaporte: 9 caracteres alfanuméricos
  – Formato antiguo (~hasta 2008): G + 8 dígitos (ej. G12345678)
  – Formato moderno (~desde 2008): 2 letras + 7 dígitos (ej. AB1234567)
• MRZ (Machine Readable Zone) — 2 líneas de 44 caracteres
• Fecha de nacimiento como DD/MMM/YYYY (ej. 15/ENE/1990)

Analiza la imagen y responde ÚNICAMENTE con un objeto JSON válido:
{
  "type": "pasaporte",
  "valid": boolean,
  "fields": {
    "nombres": string | null,
    "apellidos": string | null,
    "numero_pasaporte": string | null,
    "fecha_nacimiento": string | null,
    "fecha_vencimiento": string | null,
    "nacionalidad": string | null,
    "curp": string | null,
    "lugar_nacimiento": string | null,
    "mrz_line1": string | null,
    "mrz_line2": string | null
  },
  "issues": string[]
}

REGLAS:
• "numero_pasaporte": exactamente 9 caracteres, MAYÚSCULAS (sin espacios).
• Fechas en formato YYYY-MM-DD; convierte de DD/MMM/YYYY (ENE→01, FEB→02, MAR→03, ABR→04, MAY→05, JUN→06, JUL→07, AGO→08, SEP→09, OCT→10, NOV→11, DIC→12).
• VALIDACIÓN CRUZADA: si la CURP está presente, verifica que los chars 5–10 de la CURP coincidan con la fecha de nacimiento; si el MRZ es legible, verifica que el número de pasaporte del MRZ coincida con el impreso.
• "valid": true solo si número de pasaporte, nombres, apellidos y fechas son legibles y coherentes.`,
};
