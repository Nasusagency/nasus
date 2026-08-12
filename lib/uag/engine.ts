import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "@/lib/anthropic/client";
import { DOCUMENT_REGISTRY } from "@/lib/documents/config";
import { analyzePhoto } from "@/lib/photos/PhotoEngine";
import type { DocumentType } from "@/lib/documents/types";
import type { UagDocumentoTipo, UagConfianza, UagResponse } from "./types";
import {
  CERTIFICADO_LICENCIATURA_PROMPT,
  CONSTANCIA_CERTIFICADO_PROMPT,
  CARTA_COMPROMISO_PROMPT,
} from "./prompts";
import { UAG_FOTO_CONFIG } from "./photo-config";

const MODEL = "claude-sonnet-4-6";

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

// UAG tipos → clave en DOCUMENT_REGISTRY existente
const REGISTRY_MAP: Partial<Record<UagDocumentoTipo, DocumentType>> = {
  acta_nacimiento: "acta",
  ine: "ine",
  curp: "curp",
  rfc: "rfc",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nombresCoinciden(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = normalizeNombre(a);
  const nb = normalizeNombre(b);
  return na.includes(nb) || nb.includes(na);
}

function computeConfianza(
  valido: boolean,
  issues: string[],
  campos: Record<string, unknown>
): { confianza: UagConfianza; requiere_revision_humana: boolean } {
  const values = Object.values(campos);
  const nullRatio = values.length > 0
    ? values.filter((v) => v === null || v === undefined).length / values.length
    : 0;

  const hasQualityIssue = issues.some((i) =>
    /calidad|ilegible|borroso|desenfocad|poor quality/i.test(i)
  );

  if (nullRatio > 0.55 || hasQualityIssue) {
    return { confianza: "baja", requiere_revision_humana: true };
  }
  if (valido && issues.length === 0) {
    return { confianza: "alta", requiere_revision_humana: false };
  }
  return { confianza: "media", requiere_revision_humana: false };
}

function buildRecomendacion(
  tipo: UagDocumentoTipo,
  valido: boolean,
  issues: string[],
  campos: Record<string, unknown>,
  confianza: UagConfianza,
  alumnoNombre?: string
): string {
  const nombreDoc = campos.nombre_completo ?? campos.nombre_firmante ?? campos.nombre_alumno ?? null;
  const nombreCoincide = alumnoNombre && typeof nombreDoc === "string"
    ? nombresCoinciden(nombreDoc, alumnoNombre)
    : null;

  if (confianza === "baja") {
    return "El documento parece válido pero la calidad de imagen es baja o hay datos ilegibles. Se recomienda revisión manual antes de proceder.";
  }

  switch (tipo) {
    case "certificado_licenciatura": {
      if (!valido) {
        const tipoDetectado = campos.tipo_detectado as string | null;
        if (tipoDetectado === "kardex" || tipoDetectado === "historial") {
          return `El documento adjunto es un ${tipoDetectado === "kardex" ? "kardex" : "historial académico"}, no un certificado oficial. Solicitar el certificado de licenciatura con sello oficial.`;
        }
        return `Certificado rechazado. ${issues[0] ?? "El documento no cumple los requisitos de certificado oficial."}`;
      }
      const inst = campos.institucion ? ` Institución: ${campos.institucion}.` : "";
      const coincidencia = nombreCoincide === true
        ? " El nombre coincide con el expediente."
        : nombreCoincide === false
        ? " Advertencia: el nombre no coincide con el expediente, verificar manualmente."
        : "";
      return `Certificado de licenciatura válido.${inst}${coincidencia} Puede proceder.`;
    }

    case "acta_nacimiento":
    case "ine":
    case "curp":
    case "rfc": {
      const labels: Record<UagDocumentoTipo, string> = {
        acta_nacimiento: "Acta de nacimiento",
        ine: "INE",
        curp: "CURP",
        rfc: "RFC",
        certificado_licenciatura: "",
        constancia_certificado: "",
        fotografia: "",
        carta_compromiso: "",
      };
      const label = labels[tipo];
      if (valido) {
        const coincidencia = nombreCoincide === false
          ? " El nombre en el documento no coincide con el expediente — verificar manualmente."
          : "";
        return `${label} válido.${coincidencia} Puede proceder.`;
      }
      return `${label} inválido. ${issues.slice(0, 2).join(" ")} Solicitar documento correcto.`;
    }

    case "constancia_certificado": {
      if (valido) return "Constancia de validación oficial SEP válida. Folio registrado. Puede proceder.";
      return `Constancia rechazada. ${issues[0] ?? "El documento no es una constancia oficial SEP."} Solicitar documento emitido por la SEP.`;
    }

    case "fotografia": {
      if (valido) return "Fotografía aceptada. Cumple todos los requisitos UAG. Puede proceder.";
      const issuesSummary = issues.slice(0, 3).join(" ");
      return `La fotografía fue rechazada. ${issuesSummary} Solicitar nueva fotografía cumpliendo los requisitos UAG.`;
    }

    case "carta_compromiso": {
      if (!valido) {
        return `Carta de compromiso rechazada. ${issues[0] ?? "El documento no está firmado."} Solicitar al alumno que firme la carta antes de continuar.`;
      }
      const firmante = campos.nombre_firmante as string | null;
      const coincidencia = nombreCoincide === false
        ? " El firmante no coincide con el nombre del alumno — verificar manualmente."
        : "";
      return `Carta de compromiso válida.${firmante ? ` Firmante: ${firmante}.` : ""}${coincidencia} Puede proceder.`;
    }

    default:
      return valido ? "Documento válido. Puede proceder." : `Documento inválido. ${issues[0] ?? "Revisar el documento."} Solicitar corrección.`;
  }
}

// ─── Validadores específicos ─────────────────────────────────────────────────

async function validateWithRegistry(params: {
  tipo: UagDocumentoTipo;
  registryKey: DocumentType;
  base64: string;
  mimeType: string;
  solicitudId: string;
  alumnoNombre?: string;
  timestamp: string;
}): Promise<UagResponse> {
  const { tipo, registryKey, base64, mimeType, solicitudId, alumnoNombre, timestamp } = params;
  const config = DOCUMENT_REGISTRY[registryKey];

  const isPdf = mimeType === "application/pdf";
  const mediaBlock = isPdf
    ? ({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      } as never)
    : ({
        type: "image",
        source: { type: "base64", media_type: mimeType as ImageMediaType, data: base64 },
      } as Anthropic.ContentBlockParam);

  const userText = [
    `Analiza este documento de tipo ${config.id.toUpperCase()} y devuelve el JSON requerido.`,
    alumnoNombre ? `Nombre del alumno en el expediente: "${alumnoNombre}". Verifica si el nombre en el documento coincide.` : "",
    isPdf ? " Si el PDF tiene varias páginas, analiza la primera con información relevante." : "",
  ].filter(Boolean).join(" ");

  const response = await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: config.systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: [mediaBlock, { type: "text", text: userText }] }],
  });

  const rawText = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  const cleaned = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const parsed = JSON.parse(cleaned) as { fields?: Record<string, unknown>; issues?: string[] };

  const claudeFields = parsed.fields ?? {};
  const derivedFields = config.deriveFields ? config.deriveFields(claudeFields) : {};
  const allFields: Record<string, unknown> = { ...claudeFields };
  for (const [k, v] of Object.entries(derivedFields)) {
    if (allFields[k] == null) allFields[k] = v;
  }

  const claudeIssues: string[] = Array.isArray(parsed.issues) ? parsed.issues : [];
  const validation = config.validate(allFields);
  const issues = [...claudeIssues, ...validation.issues];
  const valido = issues.length === 0;

  const { confianza, requiere_revision_humana } = computeConfianza(valido, issues, allFields);

  return {
    solicitud_id: solicitudId,
    documento_tipo: tipo,
    valido,
    confianza,
    recomendacion: buildRecomendacion(tipo, valido, issues, allFields, confianza, alumnoNombre),
    campos_extraidos: allFields,
    issues,
    requiere_revision_humana,
    timestamp,
    version: "1.0",
  };
}

async function validateFoto(params: {
  base64: string;
  mimeType: string;
  solicitudId: string;
  alumnoNombre?: string;
  timestamp: string;
}): Promise<UagResponse> {
  const { base64, mimeType, solicitudId, timestamp } = params;

  const result = await analyzePhoto(UAG_FOTO_CONFIG, base64, mimeType);

  const valido = result.verdict === "APTA";
  const requiresRevision = result.verdict === "REVISAR";
  const issues = result.issues;

  const failedRules = Object.entries(result.ruleResults)
    .filter(([, r]) => !r.pass)
    .map(([id]) => UAG_FOTO_CONFIG.rules.find((r) => r.id === id)?.label ?? id);

  const campos: Record<string, unknown> = {
    veredicto: result.verdict,
    reglas_fallidas: failedRules.length > 0 ? failedRules : null,
  };

  const confianza: UagConfianza = requiresRevision ? "media" : valido ? "alta" : "media";

  return {
    solicitud_id: solicitudId,
    documento_tipo: "fotografia",
    valido,
    confianza,
    recomendacion: buildRecomendacion("fotografia", valido, issues, campos, confianza),
    campos_extraidos: campos,
    issues,
    requiere_revision_humana: requiresRevision,
    timestamp,
    version: "1.0",
  };
}

async function validateUagSpecific(params: {
  tipo: UagDocumentoTipo;
  base64: string;
  mimeType: string;
  solicitudId: string;
  alumnoNombre?: string;
  timestamp: string;
}): Promise<UagResponse> {
  const { tipo, base64, mimeType, solicitudId, alumnoNombre, timestamp } = params;

  const promptMap: Record<string, string> = {
    certificado_licenciatura: CERTIFICADO_LICENCIATURA_PROMPT,
    constancia_certificado: CONSTANCIA_CERTIFICADO_PROMPT,
    carta_compromiso: CARTA_COMPROMISO_PROMPT,
  };

  const systemPrompt = promptMap[tipo];
  if (!systemPrompt) throw new Error(`Tipo de documento no soportado: ${tipo}`);

  const isPdf = mimeType === "application/pdf";
  const mediaBlock = isPdf
    ? ({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      } as never)
    : ({
        type: "image",
        source: { type: "base64", media_type: mimeType as ImageMediaType, data: base64 },
      } as Anthropic.ContentBlockParam);

  const userText = [
    "Analiza este documento y devuelve el JSON requerido.",
    alumnoNombre ? `Nombre del alumno en el expediente: "${alumnoNombre}". Verifica si el nombre en el documento coincide.` : "",
  ].filter(Boolean).join(" ");

  const response = await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: [mediaBlock, { type: "text", text: userText }] }],
  });

  const rawText = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  const cleaned = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const fields = (parsed.fields ?? {}) as Record<string, unknown>;
  const issues: string[] = Array.isArray(parsed.issues) ? (parsed.issues as string[]) : [];

  let valido = false;
  switch (tipo) {
    case "certificado_licenciatura":
      valido = Boolean(parsed.es_certificado_oficial) && issues.length === 0;
      if (!valido && !issues.length) {
        issues.push("El documento no fue reconocido como un certificado oficial de licenciatura.");
      }
      fields.tipo_detectado = parsed.tipo_detectado ?? null;
      break;
    case "constancia_certificado":
      valido = Boolean(parsed.es_constancia_oficial) && issues.length === 0;
      if (!valido && !issues.length) {
        issues.push("El documento no fue reconocido como una constancia oficial SEP.");
      }
      break;
    case "carta_compromiso":
      valido = Boolean(parsed.esta_firmada) && issues.length === 0;
      if (!valido && !issues.some((i) => /firmada/i.test(i))) {
        issues.push("La carta de compromiso no está firmada.");
      }
      break;
  }

  const { confianza, requiere_revision_humana } = computeConfianza(valido, issues, fields);

  return {
    solicitud_id: solicitudId,
    documento_tipo: tipo,
    valido,
    confianza,
    recomendacion: buildRecomendacion(tipo, valido, issues, { ...fields, tipo_detectado: parsed.tipo_detectado }, confianza, alumnoNombre),
    campos_extraidos: fields,
    issues,
    requiere_revision_humana,
    timestamp,
    version: "1.0",
  };
}

// ─── Entrada pública ─────────────────────────────────────────────────────────

export async function validateUagDocument(params: {
  tipo: UagDocumentoTipo;
  base64: string;
  mimeType: string;
  solicitudId: string;
  alumnoNombre?: string;
}): Promise<UagResponse> {
  const { tipo, base64, mimeType, solicitudId, alumnoNombre } = params;
  const timestamp = new Date().toISOString();

  if (tipo === "fotografia") {
    return validateFoto({ base64, mimeType, solicitudId, alumnoNombre, timestamp });
  }

  const registryKey = REGISTRY_MAP[tipo];
  if (registryKey) {
    return validateWithRegistry({ tipo, registryKey, base64, mimeType, solicitudId, alumnoNombre, timestamp });
  }

  return validateUagSpecific({ tipo, base64, mimeType, solicitudId, alumnoNombre, timestamp });
}
