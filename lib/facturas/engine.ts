import type { FacturaExtraccion } from "./types";

export function extractJSON(raw: string): string {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  if (stripped.startsWith("{")) return stripped;

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) return raw.slice(start, end + 1);

  return stripped;
}

export function normalizeFactura(
  raw: unknown,
  tipo: "google" | "meta"
): FacturaExtraccion {
  const p = raw as FacturaExtraccion;
  return {
    tipo,
    numero_documento: p.numero_documento ?? null,
    fecha: p.fecha ?? null,
    periodo: p.periodo ?? null,
    rfc_emisor: p.rfc_emisor ?? null,
    rfc_receptor: p.rfc_receptor ?? null,
    cuentas: (p.cuentas ?? []).map((c) => ({
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
    subtotal: Number(p.subtotal) || 0,
    iva: Number(p.iva) || 0,
    total: Number(p.total) || 0,
  };
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    );
  }
  return btoa(binary);
}
