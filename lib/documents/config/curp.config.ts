import { validateCurp, type CurpFields } from "@/lib/validators/curp";
import { adaptResult, type DocumentConfig, type FieldDef } from "../types";

const fieldDefs: FieldDef[] = [
  { key: "curp", label: "CURP", required: true, editable: true },
  { key: "nombres", label: "Nombres", required: true, editable: true },
  { key: "apellido_paterno", label: "Apellido paterno", required: true, editable: true },
  { key: "apellido_materno", label: "Apellido materno", required: false, editable: true },
  { key: "fecha_nacimiento", label: "Fecha de nacimiento", required: false, editable: true },
  { key: "sexo", label: "Sexo", required: false, editable: true },
  { key: "entidad_nacimiento", label: "Entidad de nacimiento", required: false, editable: false },
];

export const CURP_CONFIG: DocumentConfig = {
  id: "curp",
  name: "CURP — Clave Única de Registro de Población",
  description: "Documento emitido por RENAPO",
  countries: ["MX"],
  fieldDefs,
  validate: (raw) => adaptResult(validateCurp(raw as CurpFields)),
  diditSupported: true,
  getDiditArgs: (fields) => {
    const f = fields as CurpFields;
    if (!f.curp) return null;
    return {
      curp: f.curp,
      nombres: f.nombres,
      apellido_paterno: f.apellido_paterno,
      apellido_materno: f.apellido_materno,
      fecha_nacimiento: f.fecha_nacimiento,
    };
  },
  systemPrompt: `Eres un sistema experto en la Clave Única de Registro de Población (CURP) mexicana, emitida por RENAPO.

DOCUMENTO CURP OFICIAL:
• Encabezado: logotipo del Gobierno de México y RENAPO
• Contiene: clave CURP de 18 caracteres impresa en grande, nombre completo, fecha de nacimiento, sexo, entidad de nacimiento, número de acta, municipio de registro
• Puede ser en formato PDF oficial o en papel membretado

ESTRUCTURA EXACTA DE LA CURP (18 caracteres):
• Chars 1–4: iniciales — 1ª letra + 1ª vocal interna del apellido paterno, 1ª letra del apellido materno, 1ª letra del nombre
• Chars 5–10: AAMMDD de la fecha de nacimiento (p. ej. 560427 = 27 de abril de 1956)
• Char 11: H (hombre) o M (mujer)
• Chars 12–13: clave de entidad federativa de nacimiento
• Chars 14–16: 1ª consonante interna de apellido paterno, materno y nombre
• Char 17: dígito diferenciador alfanumérico
• Char 18: dígito verificador numérico

Analiza la imagen o documento y responde ÚNICAMENTE con un objeto JSON válido:
{
  "type": "curp",
  "valid": boolean,
  "fields": {
    "curp": string | null,
    "nombres": string | null,
    "apellido_paterno": string | null,
    "apellido_materno": string | null,
    "fecha_nacimiento": string | null,
    "sexo": string | null,
    "entidad_nacimiento": string | null
  },
  "issues": string[]
}

REGLAS:
• "curp": exactamente 18 caracteres alfanuméricos en MAYÚSCULAS. Transcribe con máxima precisión.
• "sexo": "H" para hombre, "M" para mujer.
• Fechas en formato YYYY-MM-DD.
• VALIDACIÓN CRUZADA: verifica coherencia entre char 11 de CURP y "sexo"; entre chars 5–10 y fecha de nacimiento.
• "valid": true solo si la CURP tiene 18 caracteres legibles y no hay anomalías.`,
};
