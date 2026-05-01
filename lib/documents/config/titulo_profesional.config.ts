import { validateTituloProfesional, type TituloFields } from "@/lib/validators/titulo_profesional";
import { adaptResult, type DocumentConfig, type FieldDef } from "../types";

const fieldDefs: FieldDef[] = [
  { key: "nombre_completo", label: "Nombre completo", required: true, editable: true },
  { key: "institucion", label: "Institución", required: true, editable: true },
  { key: "carrera", label: "Carrera / Licenciatura", required: true, editable: true },
  { key: "fecha_expedicion", label: "Fecha de expedición", required: false, editable: true },
  { key: "cedula_profesional", label: "Cédula profesional (SEP)", required: false, editable: true },
  { key: "firmante", label: "Firmante (rector/director)", required: false, editable: false },
];

export const TITULO_PROFESIONAL_CONFIG: DocumentConfig = {
  id: "titulo_profesional",
  name: "Título Universitario / Cédula Profesional",
  description: "Título emitido por institución de educación superior y cédula SEP",
  countries: ["MX"],
  fieldDefs,
  validate: (raw) => adaptResult(validateTituloProfesional(raw as unknown as TituloFields)),
  diditSupported: false,
  systemPrompt: `Eres un experto en la extracción de datos de Títulos Universitarios y Cédulas Profesionales mexicanas.

DOCUMENTOS:
• Título universitario: emitido por la institución, firmado por rector o director
• Cédula profesional SEP: emitida por la Dirección General de Profesiones, número de 7-8 dígitos
• Pueden presentarse juntos (título con cédula adjunta) o por separado

Analiza el documento y responde ÚNICAMENTE con un objeto JSON válido:
{
  "type": "titulo_profesional",
  "valid": boolean,
  "fields": {
    "nombre_completo": string | null,
    "institucion": string | null,
    "carrera": string | null,
    "fecha_expedicion": string | null,
    "cedula_profesional": string | null,
    "firmante": string | null
  },
  "issues": string[]
}

REGLAS:
• "cedula_profesional": número de 7-8 dígitos numéricos emitido por la SEP; null si no aparece o si es solo el título sin cédula
• "carrera": nombre completo de la licenciatura, ingeniería, posgrado o área de estudio
• "fecha_expedicion": fecha en formato YYYY-MM-DD; convierte si está en otro formato
• "firmante": nombre y cargo del rector, director o autoridad que firma el documento
• "valid": true si nombre_completo, institucion y carrera son legibles
• En "issues": texto ilegible, datos faltantes, número de cédula con formato inválido`,
};
