import { validateCertificadoBachillerato, type CertificadoBachilleratoFields } from "@/lib/validators/certificado_bachillerato";
import { adaptResult, type DocumentConfig, type FieldDef } from "../types";

const fieldDefs: FieldDef[] = [
  { key: "nombre_completo", label: "Nombre completo", required: true, editable: true },
  { key: "institucion", label: "Institución / Plantel", required: true, editable: true },
  { key: "promedio", label: "Promedio final", required: false, editable: true },
  { key: "fecha_egreso", label: "Fecha de egreso", required: false, editable: true },
  { key: "cct", label: "CCT (Clave de Centro de Trabajo)", required: false, editable: true },
  { key: "folio_certificado", label: "Folio del certificado", required: false, editable: false },
];

export const CERTIFICADO_BACHILLERATO_CONFIG: DocumentConfig = {
  id: "certificado_bachillerato",
  name: "Certificado de Bachillerato / Preparatoria",
  description: "Certificado oficial emitido por preparatoria o bachillerato (SEP, UNAM, IPN, CONALEP, etc.)",
  countries: ["MX"],
  fieldDefs,
  validate: (raw) => adaptResult(validateCertificadoBachillerato(raw as unknown as CertificadoBachilleratoFields)),
  diditSupported: false,
  systemPrompt: `Eres un experto en la extracción de datos de Certificados de Bachillerato y Preparatoria mexicanos.

DOCUMENTO:
• Certificado oficial de preparatoria, bachillerato o bachillerato tecnológico
• Emitido por: UNAM, IPN, CONALEP, SEP, Colegio de Bachilleres, preparatorias privadas con RVOE, etc.
• Incluye: nombre del alumno, institución/plantel, promedio final, CCT del plantel, folio del certificado, fecha de egreso

CLAVE DE CENTRO DE TRABAJO (CCT):
• Formato: 2 letras (estado) + 2 dígitos (nivel educativo) + 4 dígitos (número del plantel) + 1 letra (tipo) + 1 dígito (verificador)
• Ejemplo: DF021234P3, MC02000103, NL030987H5
• Aparece impresa en el certificado, generalmente cerca del sello oficial

Analiza el documento y responde ÚNICAMENTE con un objeto JSON válido:
{
  "type": "certificado_bachillerato",
  "valid": boolean,
  "fields": {
    "nombre_completo": string | null,
    "institucion": string | null,
    "promedio": string | null,
    "fecha_egreso": string | null,
    "cct": string | null,
    "folio_certificado": string | null
  },
  "issues": string[]
}

REGLAS:
• "promedio": como string decimal (ej. "8.5", "9.20", "10.0"); rango válido 0.0-10.0
• "fecha_egreso": fecha en formato YYYY-MM-DD
• "cct": exactamente 10 caracteres en MAYÚSCULAS; null si no es legible
• "folio_certificado": número o código alfanumérico del folio impreso en el certificado
• "valid": true si nombre_completo e institución son legibles
• En "issues": datos ilegibles, promedio fuera de rango, CCT con formato inválido`,
};
