import Link from "next/link";
import Logo from "./_components/Logo";
import { GUIA_BASE } from "@/lib/guia/routes";

/** 404 de todo el sitio. El registro de la ruta pedida vive en app/[...slug]/page.tsx. */
export default function NotFound() {
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
