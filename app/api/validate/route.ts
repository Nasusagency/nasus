import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic/client";
import { buildSystemPrompt, buildMessages, type DocumentType } from "@/lib/anthropic/prompts";
import { validateDni, type DniFields } from "@/lib/validators/dni";
import { validateActa, type ActaFields } from "@/lib/validators/acta";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const file = formData.get("document");
  const docType = (formData.get("type") ?? "dni") as DocumentType;

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "El campo 'document' es obligatorio y debe ser un archivo" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Tipo de archivo no permitido. Usa: ${ALLOWED_TYPES.join(", ")}` },
      { status: 415 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 5 MB" },
      { status: 413 }
    );
  }

  if (!["dni", "acta"].includes(docType)) {
    return NextResponse.json(
      { error: "El campo 'type' debe ser 'dni' o 'acta'" },
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
        { error: "ANTHROPIC_API_KEY inválida o sin permisos." },
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
    console.error("[validate] JSON parse error. Raw response:", raw);
    return NextResponse.json(
      { error: "La respuesta del modelo no pudo ser interpretada" },
      { status: 502 }
    );
  }

  // Validación estructural post-OCR
  const claudePayload = parsed as { fields: DniFields | ActaFields; issues?: string[] };
  const claudeIssues: string[] = Array.isArray(claudePayload.issues)
    ? claudePayload.issues
    : [];

  const validation =
    docType === "dni"
      ? validateDni(claudePayload.fields as DniFields)
      : validateActa(claudePayload.fields as ActaFields);

  const mergedIssues = [...claudeIssues, ...validation.issues];

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
      fields: claudePayload.fields,
    });
  }

  return NextResponse.json(
    { ...validation, issues: mergedIssues },
    { status: 200 }
  );
}
