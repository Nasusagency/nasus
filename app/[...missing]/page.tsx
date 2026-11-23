import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { GUIA_BASE } from "@/lib/guia/routes";
import { clientIp, logVisit, shouldLogPath } from "@/lib/guia/log";

export const metadata: Metadata = { robots: { index: false } };

/** Zonas privadas o con slugs de clientes: sus 404 no son señal de intención. */
const SKIP = /^\/(admin|internal|cliente|propuesta|pagar|auth)(\/|$)/;

/**
 * Comodín: solo coincide con rutas que no existen en el sitio. Registra la
 * ruta en laberinto_visitas (lo que un agente busca y no encuentra es la señal
 * más útil del Laberinto) y muestra app/not-found.tsx con estado 404.
 *
 * El registro NO puede vivir en not-found.tsx: Next renderiza ese componente
 * en cada página como frontera de error, y anotaría visitas normales como 404.
 */
export default async function Missing({ params }: { params: Promise<{ missing: string[] }> }) {
  const { missing } = await params;
  const path = `/${missing.join("/")}`;
  if (!path.startsWith(GUIA_BASE) && !SKIP.test(path) && shouldLogPath(path)) {
    const h = await headers();
    after(() => logVisit({
      path,
      status: 404,
      origen: "404",
      userAgent: h.get("user-agent"),
      ip: clientIp(h),
      referer: h.get("referer"),
    }));
  }
  notFound();
}
