import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { extractFactura } from "@/lib/facturas/engine";

export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30;
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

  const file = formData.get("file");
  const tipoRaw = formData.get("tipo");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "El campo 'file' es obligatorio y debe ser un archivo PDF" },
      { status: 400 }
    );
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Solo se aceptan archivos PDF" },
      { status: 415 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 20 MB" },
      { status: 413 }
    );
  }

  const tipo = tipoRaw === "meta" ? "meta" : "google";

  const buffer = await file.arrayBuffer();
  const pdfBase64 = Buffer.from(buffer).toString("base64");

  try {
    const result = await extractFactura(pdfBase64, tipo);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[facturas/extract] error:", err instanceof Error ? err.message : String(err));

    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Límite de peticiones alcanzado. Espera un momento e intenta de nuevo." },
        { status: 429 }
      );
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "No se pudo interpretar la respuesta del modelo. Verifica que el PDF sea una factura de Google Ads o Meta Ads." },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Error al procesar la factura. Inténtalo de nuevo." },
      { status: 502 }
    );
  }
}
