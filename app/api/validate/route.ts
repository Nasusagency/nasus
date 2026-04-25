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

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_DOC_TYPES = new Set<DocumentType>([
  "dni", "acta", "ine", "curp", "rfc", "pasaporte",
]);

export async function POST(req: NextRequest) {
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
      { error: `Tipo de archivo no permitido. Usa: ${ALLOWED_MIME_TYPES.join(", ")}` },
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
          // El system prompt es estático por tipo: se cachea para ahorrar tokens
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
    console.error("[validate] Claude error:", err);

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
    console.error("[validate] JSON parse error: respuesta del modelo no era JSON válido");
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

  // Verificación contra base de datos oficial vía Didit (CURP e INE)
  // Solo se ejecuta si DIDIT_API_KEY está configurada; degrada graciosamente si no.
  let diditCheck: DiditCheck = { status: "skipped" };

  if (process.env.DIDIT_API_KEY) {
    if (docType === "curp") {
      const f = validation.fields as CurpFields;
      if (f.curp) {
        diditCheck = await validateCurpWithDidit({
          curp: f.curp,
          nombres: f.nombres,
          apellido_paterno: f.apellido_paterno,
          apellido_materno: f.apellido_materno,
          fecha_nacimiento: f.fecha_nacimiento,
        });
      }
    } else if (docType === "ine") {
      const f = validation.fields as IneFields;
      if (f.clave_elector) {
        diditCheck = await validateIneWithDidit({ clave_elector: f.clave_elector });
      }
    }

    if (diditCheck.status === "no_match" || diditCheck.status === "not_found") {
      mergedIssues.push(
        "El documento no fue encontrado en la base de datos oficial (verificación Didit)"
      );
    }
  }

  // Persiste el resultado (no el documento) si hay sesión activa
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
      fields: validation.fields,
    });
  }

  return NextResponse.json(
    { ...validation, issues: mergedIssues, docType, diditCheck },
    { status: 200 }
  );
}
