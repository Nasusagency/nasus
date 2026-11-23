import Link from "next/link";
import { cache } from "react";
import { headers } from "next/headers";
import { after } from "next/server";
import Logo from "./_components/Logo";
import { GUIA_BASE } from "@/lib/guia/routes";
import { clientIp, logVisit, shouldLogPath } from "@/lib/guia/log";

/** Zonas privadas o con slugs de clientes: sus 404 no son señal de intención. */
const SKIP = /^\/(admin|internal|cliente|propuesta|pagar|auth)(\/|$)/;

/**
 * 404 de todo el sitio. Registra la ruta pedida en guia_visitas: lo que un
 * agente busca y no encuentra (/precios, /pricing, /api/servicios…) es la
 * señal más útil del Laberinto de Agentes. La ruta llega desde el middleware
 * en x-nasus-path; la guía registra sus propios 404 en el middleware.
 */
/** Next puede renderizar el not-found más de una vez por petición: cache() lo deja en un registro. */
const registrar404 = cache(async () => {
  const h = await headers();
  const path = h.get("x-nasus-path");
  if (!path || path.startsWith(GUIA_BASE) || SKIP.test(path) || !shouldLogPath(path)) return;
  after(() => logVisit({
    path,
    status: 404,
    origen: "404",
    userAgent: h.get("user-agent"),
    ip: clientIp(h),
    referer: h.get("referer"),
  }));
});

export default async function NotFound() {
  await registrar404();
  return <div className="flex min-h-screen flex-col items-center justify-center bg-[#050508] px-6 text-center text-white">
    <Logo height={34} tone="dark" />
    <p className="mt-10 font-mono text-xs tracking-[.2em] text-[#c4a882]">404</p>
    <h1 className="mt-3 font-display text-3xl font-bold">Esta página no existe</h1>
    <p className="mt-4 max-w-md text-zinc-400">Puede que el enlace haya cambiado. Desde aquí puedes volver al sitio o consultar la guía por temas.</p>
    <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
      <Link href="/" className="rounded-lg bg-[#c4a882] px-5 py-2.5 font-semibold text-black">Ir al inicio</Link>
      <a href={`${GUIA_BASE}?ref=404`} className="rounded-lg border border-zinc-800 px-5 py-2.5 text-zinc-300 hover:border-[#c4a882]">Guía de Nasus</a>
    </div>
  </div>;
}
