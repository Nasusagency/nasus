import { anthropic } from "@/lib/anthropic/client";
import type { FacturaExtraccion } from "./types";
import { GOOGLE_ADS_PROMPT, META_ADS_PROMPT } from "./prompts";

function extractJSON(raw: string): string {
  // Strip markdown fences first
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  if (stripped.startsWith("{")) return stripped;

  // Find outermost JSON object by braces
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) return raw.slice(start, end + 1);

  return stripped;
}

export async function extractFactura(
  pdfBase64: string,
  tipo: "google" | "meta"
): Promise<FacturaExtraccion> {
  const systemPrompt = tipo === "google" ? GOOGLE_ADS_PROMPT : META_ADS_PROMPT;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 16000,
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
            text: `Extrae todos los datos de esta factura de ${tipo === "google" ? "Google Ads" : "Meta Ads"} y responde ÚNICAMENTE con el JSON válido especificado.`,
          },
        ],
      },
    ],
  });

  const rawText =
    response.content.find((b) => b.type === "text") as { type: "text"; text: string } | undefined;
  const rawString = rawText?.text ?? "";

  let parsed: FacturaExtraccion;
  try {
    parsed = JSON.parse(extractJSON(rawString)) as FacturaExtraccion;
  } catch {
    console.error("[facturas/engine] JSON parse failed. stop_reason:", response.stop_reason);
    console.error("[facturas/engine] Raw response (first 500 chars):", rawString.slice(0, 500));
    throw new SyntaxError("La respuesta del modelo no pudo ser interpretada como JSON");
  }

  return {
    tipo,
    numero_documento: parsed.numero_documento ?? null,
    fecha: parsed.fecha ?? null,
    periodo: parsed.periodo ?? null,
    rfc_emisor: parsed.rfc_emisor ?? null,
    rfc_receptor: parsed.rfc_receptor ?? null,
    cuentas: (parsed.cuentas ?? []).map((c) => ({
      nombre: c.nombre ?? "Cuenta sin nombre",
      id_cuenta: c.id_cuenta ?? null,
      campanas: (c.campanas ?? []).map((camp) => ({
        nombre: camp.nombre ?? "Campaña sin nombre",
        cantidad: camp.cantidad ?? null,
        unidades: camp.unidades ?? null,
        importe: Number(camp.importe) || 0,
      })),
      subtotal: Number(c.subtotal) || 0,
      iva: c.iva != null ? Number(c.iva) : null,
      total: Number(c.total) || 0,
    })),
    subtotal: Number(parsed.subtotal) || 0,
    iva: Number(parsed.iva) || 0,
    total: Number(parsed.total) || 0,
  };
}
