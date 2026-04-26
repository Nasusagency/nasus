import { validateDni, type DniFields } from "@/lib/validators/dni";
import { adaptResult, type DocumentConfig, type FieldDef } from "../types";

const fieldDefs: FieldDef[] = [
  { key: "nombres", label: "Nombres", required: true, editable: true },
  { key: "apellidos", label: "Apellidos", required: true, editable: true },
  { key: "numero_documento", label: "N.º documento", required: true, editable: true },
  { key: "fecha_nacimiento", label: "Fecha de nacimiento", required: false, editable: true },
  { key: "fecha_vencimiento", label: "Fecha de vencimiento", required: false, editable: false },
  { key: "pais", label: "País", required: false, editable: false },
];

export const DNI_CONFIG: DocumentConfig = {
  id: "dni",
  name: "DNI / Cédula de Identidad",
  description: "Documento de identidad genérico (Perú, Argentina, Colombia, España, México y otros)",
  countries: ["PE", "AR", "CO", "ES", "MX"],
  fieldDefs,
  validate: (raw) => adaptResult(validateDni(raw as DniFields)),
  diditSupported: false,
  systemPrompt: `Eres un sistema experto en extracción y validación de documentos de identidad oficiales.

Analiza la imagen del documento y responde ÚNICAMENTE con un objeto JSON válido:
{
  "type": "dni",
  "valid": boolean,
  "fields": {
    "nombres": string | null,
    "apellidos": string | null,
    "numero_documento": string | null,
    "fecha_nacimiento": string | null,
    "fecha_vencimiento": string | null,
    "pais": string | null
  },
  "issues": string[]
}

Reglas:
- Las fechas deben estar en formato YYYY-MM-DD.
- Si un campo no es legible o no existe en el documento, usa null.
- En "issues" incluye cualquier anomalía detectada: texto borroso, datos inconsistentes, posible alteración, documento vencido, etc.
- El campo "valid" debe ser true solo si todos los campos obligatorios son legibles y no hay anomalías graves.`,
};
