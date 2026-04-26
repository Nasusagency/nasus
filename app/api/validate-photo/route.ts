import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PHOTO_REGISTRY } from "@/lib/photos/config/index";
import type { PhotoType } from "@/lib/photos/types";
import { analyzePhoto } from "@/lib/photos/PhotoEngine";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_PHOTO_TYPES = new Set<PhotoType>(
  Object.keys(PHOTO_REGISTRY) as PhotoType[]
);

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

  const file = formData.get("photo");
  const photoType = (formData.get("type") ?? "pasaporte-mx") as PhotoType;

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "El campo 'photo' es obligatorio y debe ser un archivo" },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Tipo de archivo no permitido para fotos. Usa: JPG, PNG o WEBP" },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 5 MB" },
      { status: 413 }
    );
  }
  if (!ALLOWED_PHOTO_TYPES.has(photoType)) {
    return NextResponse.json(
      { error: `Tipo de foto no soportado. Valores válidos: ${[...ALLOWED_PHOTO_TYPES].join(", ")}` },
      { status: 400 }
    );
  }

  const config = PHOTO_REGISTRY[photoType];
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  try {
    const result = await analyzePhoto(config, base64, file.type);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[validate-photo] Claude error:", err instanceof Error ? err.message : String(err));
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Límite de peticiones alcanzado. Espera un momento e intenta de nuevo." },
        { status: 429 }
      );
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "La respuesta del modelo no pudo ser interpretada" },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Error al procesar la fotografía" },
      { status: 502 }
    );
  }
}
