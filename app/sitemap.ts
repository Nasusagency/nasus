import type { MetadataRoute } from "next";
import { GUIA_NODES, guiaHref } from "@/lib/guia/routes";
import { PUBLICADA } from "@/lib/guia/investigacion";

const BASE = "https://nasus.mx";
const UPDATED = "2026-11-23";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, lastModified: UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/validador`, lastModified: UPDATED, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/facturas`, lastModified: UPDATED, changeFrequency: "monthly", priority: 0.8 },
    ...(PUBLICADA ? [
      { url: `${BASE}/investigacion`, lastModified: UPDATED, changeFrequency: "monthly" as const, priority: 0.5 },
      { url: `${BASE}/investigacion/laberinto-de-agentes`, lastModified: UPDATED, changeFrequency: "weekly" as const, priority: 0.6 },
    ] : []),
    ...GUIA_NODES.map((n) => ({
      url: `${BASE}${guiaHref(n.slug)}`,
      lastModified: UPDATED,
      changeFrequency: "monthly" as const,
      priority: n.slug === "" ? 0.7 : n.parent === "" ? 0.6 : 0.5,
    })),
  ];
}
