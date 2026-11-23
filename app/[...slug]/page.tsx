import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";
import GuiaNodePage, { nodeMetadata } from "@/app/guia/GuiaNodePage";
import { guiaNode } from "@/lib/guia/routes";
import { clientIp, logVisit, shouldLogPath } from "@/lib/guia/log";

type Params = { slug: string[] };

/** Zonas privadas o con slugs de clientes: sus 404 no son señal de intención. */
const SKIP = /^\/(admin|internal|cliente|propuesta|pagar|auth)(\/|$)/;

/**
 * Dinámica a propósito: para registrar un 404 hay que leer los headers de la
 * petición (user agent, IP), y eso no se puede en una página generada de forma
 * estática. Las páginas son ligeras, así que el costo es mínimo.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const key = slug.join("/");
  return guiaNode(key) ? nodeMetadata(key) : { title: "Página no encontrada", robots: { index: false } };
}

/**
 * Comodín de la raíz: solo recibe rutas que ninguna otra página del sitio
 * resuelve. Si está en el árbol de la guía, la muestra (el middleware ya
 * registró la visita). Si no, es una ruta inexistente: se registra el 404 en
 * laberinto_visitas (lo que un agente busca y no encuentra es la señal más
 * útil del estudio) y se muestra app/not-found.tsx.
 *
 * El registro NO puede vivir en not-found.tsx: Next renderiza ese componente
 * en cada página como frontera de error y anotaría visitas normales como 404.
 */
export default async function RootCatchAll({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const key = slug.join("/");
  if (guiaNode(key)) return <GuiaNodePage slug={key} />;

  const path = `/${key}`;
  if (!SKIP.test(path) && shouldLogPath(path)) {
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
