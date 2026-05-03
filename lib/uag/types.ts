export type UagDocumentoTipo =
  | "certificado_licenciatura"
  | "acta_nacimiento"
  | "constancia_certificado"
  | "fotografia"
  | "carta_compromiso"
  | "ine"
  | "curp"
  | "rfc";

export const UAG_DOCUMENTO_TIPOS = new Set<UagDocumentoTipo>([
  "certificado_licenciatura",
  "acta_nacimiento",
  "constancia_certificado",
  "fotografia",
  "carta_compromiso",
  "ine",
  "curp",
  "rfc",
]);

export type UagConfianza = "alta" | "media" | "baja";

export interface UagRequest {
  documento_tipo: UagDocumentoTipo;
  imagen?: string;        // base64 o data URI
  imagen_url?: string;    // URL pública HTTPS
  solicitud_id: string;
  alumno_nombre?: string; // opcional, para cruce de nombre
}

export interface UagResponse {
  solicitud_id: string;
  documento_tipo: UagDocumentoTipo;
  valido: boolean;
  confianza: UagConfianza;
  recomendacion: string;
  campos_extraidos: Record<string, unknown>;
  issues: string[];
  requiere_revision_humana: boolean;
  timestamp: string;
  version: "1.0";
}
