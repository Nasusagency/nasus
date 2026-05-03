import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { UAG_DOCUMENTO_TIPOS, type UagRequest } from "@/lib/uag/types";
import { validateUagDocument } from "@/lib/uag/engine";

export const maxDuration = 30;

// ─── Rate limiting (100 req/min per API key) ──────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 100;
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

// ─── Image helpers ────────────────────────────────────────────────────────────

function parseBase64Input(imagen: string): { base64: string; mimeType: string } {
  if (imagen.startsWith("data:")) {
    const [header, data] = imagen.split(",", 2);
    const mimeMatch = header.match(/data:([^;]+)/);
    return {
      base64: data ?? "",
      mimeType: mimeMatch?.[1] ?? "image/jpeg",
    };
  }
  return { base64: imagen, mimeType: "image/jpeg" };
}

function isUrlSafe(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") return false;
    const h = url.hostname;
    if (h === "localhost" || h === "127.0.0.1") return false;
    if (/^10\./.test(h)) return false;
    if (/^192\.168\./.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`fetch_failed:${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const mimeType = contentType.split(";")[0].trim();
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return { base64, mimeType };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Authentication
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.UAG_API_KEY) {
    return NextResponse.json({}, { status: 401 });
  }

  // Rate limiting per API key (masked for safety)
  const keyPrefix = apiKey.slice(0, 8);
  if (!checkRateLimit(keyPrefix)) {
    return NextResponse.json(
      { error: "Límite de solicitudes alcanzado. Máximo 100 por minuto." },
      { status: 429 }
    );
  }

  // Parse body
  let body: UagRequest;
  try {
    body = (await req.json()) as UagRequest;
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  const { documento_tipo, imagen, imagen_url, solicitud_id, alumno_nombre } = body;

  // Validate required fields
  if (!solicitud_id || typeof solicitud_id !== "string") {
    return NextResponse.json({ error: "El campo 'solicitud_id' es requerido." }, { status: 400 });
  }
  if (!documento_tipo || !UAG_DOCUMENTO_TIPOS.has(documento_tipo)) {
    return NextResponse.json(
      {
        error: `Tipo de documento no válido. Valores permitidos: ${[...UAG_DOCUMENTO_TIPOS].join(", ")}`,
      },
      { status: 400 }
    );
  }
  if (!imagen && !imagen_url) {
    return NextResponse.json(
      { error: "Se requiere 'imagen' (base64) o 'imagen_url' (URL pública HTTPS)." },
      { status: 400 }
    );
  }

  // Resolve image
  let base64: string;
  let mimeType: string;

  try {
    if (imagen_url) {
      if (!isUrlSafe(imagen_url)) {
        return NextResponse.json(
          { error: "URL no permitida. Solo se aceptan URLs HTTPS públicas." },
          { status: 400 }
        );
      }
      ({ base64, mimeType } = await fetchImageAsBase64(imagen_url));
    } else {
      ({ base64, mimeType } = parseBase64Input(imagen!));
    }
  } catch {
    return NextResponse.json(
      { error: "No se pudo obtener la imagen. Verifica la URL o el base64 proporcionado." },
      { status: 422 }
    );
  }

  // Validate MIME type
  const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!ALLOWED_MIMES.includes(mimeType)) {
    return NextResponse.json(
      { error: "Tipo de archivo no soportado. Usa JPEG, PNG, WEBP o PDF." },
      { status: 415 }
    );
  }

  // Validate base64 size (~15 MB limit)
  const estimatedBytes = (base64.length * 3) / 4;
  if (estimatedBytes > 15 * 1024 * 1024) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 15 MB." },
      { status: 413 }
    );
  }

  // Run validation
  try {
    const result = await validateUagDocument({
      tipo: documento_tipo,
      base64,
      mimeType,
      solicitudId: solicitud_id,
      alumnoNombre: typeof alumno_nombre === "string" ? alumno_nombre : undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    // Log without PII
    console.error("[uag/validate] error:", err instanceof Error ? err.message : String(err));

    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Límite de peticiones al servicio de IA alcanzado. Reintenta en unos segundos." },
        { status: 429 }
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Error de configuración del servicio. Contacta a soporte." },
        { status: 502 }
      );
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "El documento no pudo ser interpretado por el modelo de IA. Verifica la calidad de la imagen." },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: "Error interno al procesar el documento. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
