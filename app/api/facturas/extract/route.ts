import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GOOGLE_ADS_PROMPT, META_ADS_PROMPT } from "@/lib/facturas/prompts";
import { extractJSON, normalizeFactura, arrayBufferToBase64 } from "@/lib/facturas/engine";

export const runtime = "edge";
export const maxDuration = 30;

const MAX_BYTES = 20 * 1024 * 1024;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
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
    return errorResponse("Demasiadas solicitudes. Espera un momento e intenta de nuevo.", 429);
  }
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errorResponse("Cuerpo inválido", 400);
  }

  const file = formData.get("file");
  const tipoRaw = formData.get("tipo");

  if (!(file instanceof File)) {
    return errorResponse("El campo 'file' es obligatorio y debe ser un archivo PDF", 400);
  }
  if (file.type !== "application/pdf") {
    return errorResponse("Solo se aceptan archivos PDF", 415);
  }
  if (file.size > MAX_BYTES) {
    return errorResponse("El archivo supera el límite de 20 MB", 413);
  }

  const tipo = tipoRaw === "meta" ? "meta" : "google";
  const systemPrompt = tipo === "google" ? GOOGLE_ADS_PROMPT : META_ADS_PROMPT;

  const buffer = await file.arrayBuffer();
  const pdfBase64 = arrayBufferToBase64(buffer);

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const encoder = new TextEncoder();
  let accumulatedText = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          stream: true,
          system: [
            {
              type: "text",
              text: systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: pdfBase64,
                  },
                } as never,
                {
                  type: "text",
                  text: `Extrae todos los datos de esta factura de ${
                    tipo === "google" ? "Google Ads" : "Meta Ads"
                  } y responde ÚNICAMENTE con el JSON válido especificado.`,
                },
              ],
            },
          ],
        });

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            accumulatedText += event.delta.text;
            // Keepalive byte prevents Edge timeout
            controller.enqueue(encoder.encode("\n"));
          }
        }

        const jsonStr = extractJSON(accumulatedText);
        const parsed = JSON.parse(jsonStr);
        const result = normalizeFactura(parsed, tipo);
        controller.enqueue(encoder.encode(JSON.stringify(result)));
      } catch (err) {
        console.error("[facturas/extract]", err instanceof Error ? err.message : String(err));
        let msg = "Error al procesar la factura. Inténtalo de nuevo.";
        if (err instanceof Anthropic.RateLimitError) {
          msg = "Límite de peticiones alcanzado. Espera un momento e intenta de nuevo.";
        } else if (err instanceof SyntaxError) {
          msg = "No se pudo interpretar la factura. Verifica que el PDF sea de Google Ads o Meta Ads.";
        }
        controller.enqueue(encoder.encode(JSON.stringify({ error: msg })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
