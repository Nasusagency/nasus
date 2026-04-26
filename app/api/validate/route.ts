import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/anthropic/client";
import { DOCUMENT_REGISTRY } from "@/lib/documents/config/index";
import type { DocumentType } from "@/lib/documents/types";
import { analyzeDocument } from "@/lib/documents/DocumentEngine";
import {
  validateCurpWithDidit,
  type DiditCheck,
} from "@/lib/didit/database-validation";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 5 * 1024 * 1024;

// ALLOWED_DOC_TYPES is derived from the registry — adding a new doc type only requires a new config
const ALLOWED_DOC_TYPES = new Set<DocumentType>(
  Object.keys(DOCUMENT_REGISTRY) as DocumentType[]
);

// Rate limiting: 10 requests / 60 s per IP (best-effort in serverless)
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

  const config = DOCUMENT_REGISTRY[docType];

  // Parse human overrides (field names only logged — no PII values, see security.md)
  let overrides: Record<string, unknown> | undefined;
  const overridesStr = formData.get("overrides");
  if (typeof overridesStr === "string" && overridesStr.trim()) {
    try {
      const parsed = JSON.parse(overridesStr) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        overrides = parsed as Record<string, unknown>;
      }
    } catch {
      // invalid JSON — ignore
    }
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  let result: Awaited<ReturnType<typeof analyzeDocument>>;
  try {
    result = await analyzeDocument(config, base64, file.type, overrides);
  } catch (err) {
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
    if (err instanceof SyntaxError) {
      console.error("[validate] JSON parse error: la respuesta del modelo no era JSON válido");
      return NextResponse.json(
        { error: "La respuesta del modelo no pudo ser interpretada" },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Error al procesar el documento con el modelo de IA" },
      { status: 502 }
    );
  }

  // Didit database verification (config-driven — no hardcoded doc type switch)
  let diditCheck: DiditCheck = { status: "skipped" };
  if (config.diditSupported) {
    if (!process.env.DIDIT_API_KEY) {
      diditCheck = { status: "unavailable" };
    } else if (config.getDiditArgs) {
      const diditArgs = config.getDiditArgs(result.fields);
      if (diditArgs) {
        diditCheck = await validateCurpWithDidit(diditArgs);
      } else {
        diditCheck = { status: "unavailable" };
      }
    }

    if (diditCheck.status === "no_match" || diditCheck.status === "not_found") {
      result.issues.push(
        "El documento no fue encontrado en la base de datos oficial (verificación Didit)"
      );
    }
  }

  // Persist result metadata — no PII fields (see security.md)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.from("validations").insert({
      user_id: user.id,
      doc_type: docType,
      valid: result.valid,
      issues: result.issues,
      // human_reviewed: requires migration → ALTER TABLE validations ADD COLUMN human_reviewed boolean DEFAULT false
      ...(result.humanOverriddenFields.length > 0 ? { human_reviewed: true } : {}),
    });
  }

  return NextResponse.json(
    {
      valid: result.valid,
      issues: result.issues,
      fields: result.fields,
      docType,
      diditCheck,
      humanOverriddenFields: result.humanOverriddenFields,
    },
    { status: 200 }
  );
}
