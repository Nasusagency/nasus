import { validateRfc, type RfcFields } from "@/lib/validators/rfc";
import { adaptResult, type DocumentConfig, type FieldDef } from "../types";

const fieldDefs: FieldDef[] = [
  { key: "rfc", label: "RFC", required: true, editable: true },
  { key: "nombre", label: "Nombre / Razón social", required: true, editable: true },
  { key: "tipo_persona", label: "Tipo de persona", required: false, editable: false },
  { key: "fecha", label: "Fecha", required: false, editable: false },
  { key: "domicilio_fiscal", label: "Domicilio fiscal", required: false, editable: false },
  { key: "regimen_fiscal", label: "Régimen fiscal", required: false, editable: false },
];

export const RFC_CONFIG: DocumentConfig = {
  id: "rfc",
  name: "RFC — Constancia de Situación Fiscal",
  description: "Constancia emitida por el SAT",
  countries: ["MX"],
  fieldDefs,
  validate: (raw) => adaptResult(validateRfc(raw as RfcFields)),
  diditSupported: false,
  systemPrompt: `Eres un sistema experto en la Constancia de Situación Fiscal (RFC) del SAT de México.

DOCUMENTO RFC OFICIAL:
• Emitido por el SAT (Servicio de Administración Tributaria)
• Encabezado: logotipo Gobierno de México + SAT, texto "CONSTANCIA DE SITUACIÓN FISCAL"
• Secciones: RFC, nombre o razón social, CURP, domicilio fiscal, actividad económica y régimen fiscal

ESTRUCTURA DEL RFC:
• Persona física (13 caracteres): 4 chars iniciales + 6 dígitos fecha + 3 chars homoclave
• Persona moral (12 caracteres): 3 chars iniciales + 6 dígitos fecha + 3 chars homoclave

Analiza el documento y responde ÚNICAMENTE con un objeto JSON válido:
{
  "type": "rfc",
  "valid": boolean,
  "fields": {
    "rfc": string | null,
    "nombre": string | null,
    "tipo_persona": "fisica" | "moral" | null,
    "fecha": string | null,
    "domicilio_fiscal": string | null,
    "regimen_fiscal": string | null
  },
  "issues": string[]
}

REGLAS:
• "rfc": 12 chars (moral) o 13 chars (física), MAYÚSCULAS, puede contener Ñ y &.
• "fecha": fecha de nacimiento (física) o constitución (moral) en formato YYYY-MM-DD.
• "valid": true solo si el RFC es legible, tiene la longitud correcta y es coherente.`,
};
