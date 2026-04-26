import { validateIne, type IneFields } from "@/lib/validators/ine";
import { adaptResult, type DocumentConfig, type FieldDef } from "../types";

const fieldDefs: FieldDef[] = [
  { key: "nombres", label: "Nombres", required: true, editable: true },
  { key: "apellido_paterno", label: "Apellido paterno", required: true, editable: true },
  { key: "apellido_materno", label: "Apellido materno", required: false, editable: true },
  { key: "clave_elector", label: "Clave de elector", required: true, editable: true },
  { key: "curp", label: "CURP", required: false, editable: true },
  { key: "fecha_nacimiento", label: "Fecha de nacimiento", required: false, editable: true },
  { key: "fecha_vencimiento", label: "Fecha de vencimiento", required: false, editable: false },
  { key: "seccion", label: "Sección electoral", required: false, editable: false },
  { key: "generacion", label: "Generación", required: false, editable: false },
  { key: "domicilio", label: "Domicilio", required: false, editable: false },
  { key: "entidad", label: "Entidad", required: false, editable: false },
  { key: "folio", label: "Folio", required: false, editable: false },
];

export const INE_CONFIG: DocumentConfig = {
  id: "ine",
  name: "INE / IFE — Credencial para Votar",
  description: "Credencial emitida por el Instituto Nacional Electoral",
  countries: ["MX"],
  fieldDefs,
  validate: (raw) => adaptResult(validateIne(raw as IneFields)),
  diditSupported: true,
  getDiditArgs: (fields) => {
    const f = fields as IneFields;
    if (!f.curp) return null;
    return {
      curp: f.curp,
      nombres: f.nombres,
      apellido_paterno: f.apellido_paterno,
      apellido_materno: f.apellido_materno,
      fecha_nacimiento: f.fecha_nacimiento,
    };
  },
  systemPrompt: `Eres un sistema experto en la Credencial para Votar (INE/IFE) de México.

REGLA CRÍTICA — NOMBRE vs DOMICILIO (error frecuente de OCR):
• "nombres" contiene ÚNICAMENTE el nombre(s) de pila (ej. "MARIA JOSE", "CARLOS ALBERTO"). Aparece bajo la etiqueta impresa "NOMBRE(S)" en la sección central del frente.
• "domicilio" es la dirección completa: calle, número exterior/interior, colonia, municipio, estado. Siempre contiene palabras como "CALLE", "COL.", "C.P.", números de vía o nombres de colonia.
• Si el texto que identificas como "nombres" contiene: número de calle, colonia, municipio o "C.P." → es domicilio, NO nombre. Colócalo en "domicilio".
• "apellido_paterno" y "apellido_materno" son SOLO los apellidos. No los mezcles con el nombre de pila.
• Cada campo del frente tiene una etiqueta impresa. Extrae SOLO el valor que sigue a esa etiqueta específica.

GENERACIONES Y SUS CARACTERÍSTICAS VISUALES:
• 2008 (IFE 5ª generación): fondo negro predominante con franjas de colores, foto en esquina superior izquierda, NO incluye CURP impresa al frente, hologramas dorados
• 2014 (INE 1ª generación): acento dorado/café en bordes, CURP impresa al frente, hologramas triangulares, fondo crema/beige
• 2020 (INE 2ª generación): diseño más moderno, domicilio impreso al frente, código QR 2D en reverso, tipografía actualizada, CURP al frente

CAMPOS DEL FRENTE (según generación):
• APELLIDO PATERNO / APELLIDO MATERNO / NOMBRE(S) — en ese orden, en mayúsculas
• DOMICILIO: calle, número exterior/interior, colonia, municipio, estado (gen 2020)
• CLAVE DE ELECTOR: 18 caracteres alfanuméricos
• CURP: 18 caracteres (solo en generaciones 2014 y 2020; null si es 2008)
• FECHA DE NACIMIENTO: aparece como DD/MM/AAAA
• VIGENCIA: año de vencimiento
• SECCIÓN: número electoral de 1–4 dígitos
• FOLIO: número de folio de la credencial (gen 2014 y 2020)

Analiza la imagen y responde ÚNICAMENTE con un objeto JSON válido:
{
  "type": "ine",
  "valid": boolean,
  "fields": {
    "nombres": string | null,
    "apellido_paterno": string | null,
    "apellido_materno": string | null,
    "clave_elector": string | null,
    "curp": string | null,
    "fecha_nacimiento": string | null,
    "fecha_vencimiento": string | null,
    "seccion": string | null,
    "generacion": "2008" | "2014" | "2020" | null,
    "domicilio": string | null,
    "entidad": string | null,
    "folio": string | null
  },
  "issues": string[]
}

REGLAS CRÍTICAS:
• "clave_elector": exactamente 18 caracteres, MAYÚSCULAS. Es el campo más importante.
• "curp": 18 caracteres si está impresa; null si la generación es 2008.
• "generacion": identifica por el diseño visual ("2008", "2014" o "2020").
• Todas las fechas en formato YYYY-MM-DD (convierte de DD/MM/AAAA).
• "valid": true solo si clave_elector, nombres y apellido_paterno son legibles y sin anomalías graves.`,
};
