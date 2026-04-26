import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic/client";
import { buildSystemPrompt, buildMessages, type DocumentType } from "@/lib/anthropic/prompts";
import { validateDni, type DniFields } from "@/lib/validators/dni";
import { validateActa, type ActaFields } from "@/lib/validators/acta";
import { validateIne, type IneFields } from "@/lib/validators/ine";
import { validateCurp, type CurpFields } from "@/lib/validators/curp";
import { validateRfc, type RfcFields } from "@/lib/validators/rfc";
import { validatePasaporte, type PasaporteFields } from "@/lib/validators/pasaporte";
import {
  validateCurpWithDidit,
  validateIneWithDidit,
  type DiditCheck,
} from "@/lib/didit/database-validation";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_DOC_TYPES = new Set<DocumentType>([
  "dni", "acta", "ine", "curp", "rfc", "pasaporte",
]);

// Rate limiting: 10 requests / 60 s por IP (best-effort en serverless)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  // Rate limit por IP antes de cualquier procesamiento costoso
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo." },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const file = formData.get("document");
  const docType = (formData.get("type") ?? "ine") as DocumentType;

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "El campo 'document' es obligatorio y debe ser un archivo" },
      { status: 400 }
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Tipo de archivo no permitido. Usa: JPG, PNG, WEBP o PDF" },
      { status: 415 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 5 MB" },
      { status: 413 }
    );
  }

  if (!ALLOWED_DOC_TYPES.has(docType)) {
    return NextResponse.json(
      { error: `Tipo de documento no soportado. Valores válidos: ${[...ALLOWED_DOC_TYPES].join(", ")}` },
      { status: 400 }
    );
  }

  // Procesamiento en memoria — el buffer nunca se persiste
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  let raw: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: buildSystemPrompt(docType),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: buildMessages(docType, base64, file.type),
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    raw = textBlock?.text ?? "";
  } catch (err) {
    // Log solo el mensaje del error, nunca el objeto completo (puede contener PII)
    console.error("[validate] Claude error:", err instanceof Error ? err.message : String(err));

    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Límite de peticiones alcanzado. Espera un momento e intenta de nuevo." },
        { status: 429 }
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Error de autenticación con el servicio de IA." },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Error al procesar el documento con el modelo de IA" },
      { status: 502 }
    );
  }

  let parsed: unknown;
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("[validate] JSON parse error: la respuesta del modelo no era JSON válido");
    return NextResponse.json(
      { error: "La respuesta del modelo no pudo ser interpretada" },
      { status: 502 }
    );
  }

  const claudePayload = parsed as {
    fields: DniFields | ActaFields | IneFields | CurpFields | RfcFields | PasaporteFields;
    issues?: string[];
  };
  const claudeIssues: string[] = Array.isArray(claudePayload.issues)
    ? claudePayload.issues
    : [];

  // Detección de baja calidad: si Claude reporta ilegibilidad y la mayoría de campos son null
  const fieldValues = Object.values(claudePayload.fields ?? {});
  const nullCount = fieldValues.filter((v) => v === null).length;
  const lowQualityKeywords = ["ilegible", "borroso", "desenfocad", "baja calidad", "poor quality", "blurry"];
  const hasLowQualityReport = claudeIssues.some((issue) =>
    lowQualityKeywords.some((kw) => issue.toLowerCase().includes(kw))
  );
  if (
    hasLowQualityReport ||
    (fieldValues.length > 0 && nullCount / fieldValues.length > 0.7)
  ) {
    const alreadyReported = claudeIssues.some((i) =>
      i.toLowerCase().includes("calidad")
    );
    if (!alreadyReported) {
      claudeIssues.unshift(
        "Calidad de imagen insuficiente — sube una foto con mejor iluminación y enfoque."
      );
    }
  }

  const validation = (() => {
    switch (docType) {
      case "ine":       return validateIne(claudePayload.fields as IneFields);
      case "curp":      return validateCurp(claudePayload.fields as CurpFields);
      case "rfc":       return validateRfc(claudePayload.fields as RfcFields);
      case "pasaporte": return validatePasaporte(claudePayload.fields as PasaporteFields);
      case "acta":      return validateActa(claudePayload.fields as ActaFields);
      default:          return validateDni(claudePayload.fields as DniFields);
    }
  })();

  const mergedIssues = [...claudeIssues, ...validation.issues];

  const DIDIT_SUPPORTED = docType === "curp" || docType === "ine";
  let diditCheck: DiditCheck = { status: "skipped" };

  if (DIDIT_SUPPORTED) {
    if (!process.env.DIDIT_API_KEY) {
      diditCheck = { status: "unavailable" };
    } else if (docType === "curp") {
      const f = validation.fields as CurpFields;
      diditCheck = f.curp
        ? await validateCurpWithDidit({
            curp: f.curp,
            nombres: f.nombres,
            apellido_paterno: f.apellido_paterno,
            apellido_materno: f.apellido_materno,
            fecha_nacimiento: f.fecha_nacimiento,
          })
        : { status: "unavailable" };
    } else {
      const f = validation.fields as IneFields;
      diditCheck = f.curp
        ? await validateIneWithDidit({
            curp: f.curp,
            nombres: f.nombres,
            apellido_paterno: f.apellido_paterno,
            apellido_materno: f.apellido_materno,
            fecha_nacimiento: f.fecha_nacimiento,
          })
        : { status: "unavailable" };
    }

    if (diditCheck.status === "no_match" || diditCheck.status === "not_found") {
      mergedIssues.push(
        "El documento no fue encontrado en la base de datos oficial (verificación Didit)"
      );
    }
  }

  // Persiste solo metadatos de resultado — sin campos PII (ver security.md hallazgo #3)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.from("validations").insert({
      user_id: user.id,
      doc_type: docType,
      valid: validation.valid,
      issues: mergedIssues,
      // fields omitidos: contienen PII (nombres, CURP, etc.)
      // Persistencia de fields requiere autorización explícita del cliente
    });
  }

  return NextResponse.json(
    { ...validation, issues: mergedIssues, docType, diditCheck },
    { status: 200 }
  );
}
