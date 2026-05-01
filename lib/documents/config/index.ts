import { INE_CONFIG } from "./ine.config";
import { CURP_CONFIG } from "./curp.config";
import { RFC_CONFIG } from "./rfc.config";
import { PASAPORTE_CONFIG } from "./pasaporte.config";
import { ACTA_CONFIG } from "./acta.config";
import { DNI_CONFIG } from "./dni.config";
import { TITULO_PROFESIONAL_CONFIG } from "./titulo_profesional.config";
import { CERTIFICADO_BACHILLERATO_CONFIG } from "./certificado_bachillerato.config";
import type { DocumentConfig, DocumentType } from "../types";

export const DOCUMENT_REGISTRY: Record<DocumentType, DocumentConfig> = {
  ine: INE_CONFIG,
  curp: CURP_CONFIG,
  rfc: RFC_CONFIG,
  pasaporte: PASAPORTE_CONFIG,
  acta: ACTA_CONFIG,
  dni: DNI_CONFIG,
  titulo_profesional: TITULO_PROFESIONAL_CONFIG,
  certificado_bachillerato: CERTIFICADO_BACHILLERATO_CONFIG,
};

export function getDocumentConfig(id: DocumentType): DocumentConfig {
  return DOCUMENT_REGISTRY[id];
}

export type { DocumentType, DocumentConfig };
