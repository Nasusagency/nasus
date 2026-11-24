import type { Metadata } from "next";
import GuiaFrame from "@/app/guia/GuiaFrame";
import { listarArticulos } from "@/lib/articulos/store";

export const metadata: Metadata = {
  title: "Artículos",
  description: "Artículos de Nasus sobre IA, automatización, WhatsApp y software a la medida para empresas.",
  alternates: { canonical: "/articulos" },
};

export default function ArticulosPage() {
  const articulos = listarArticulos();
  return <GuiaFrame>
    <p className="font-mono text-[11px] tracking-[.2em] text-[#c4a882] uppercase">Artículos</p>
    <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Artículos de Nasus</h1>
    <p className="mt-3 text-zinc-400">IA, automatización y software a la medida, explicado para quien dirige una empresa.</p>
    {articulos.length === 0
      ? <p className="mt-10 text-zinc-500">Pronto publicaremos los primeros artículos.</p>
      : <ul className="mt-10 space-y-8">
        {articulos.map((a) => <li key={a.slug}>
          <a href={`/articulos/${a.slug}`} className="group block">
            <span className="text-lg text-zinc-100 underline-offset-4 group-hover:text-[#c4a882] group-hover:underline">{a.titulo}</span>
            <span className="mt-1 block text-sm text-zinc-500">{a.descripcion}</span>
            <time dateTime={a.fecha} className="mt-2 block font-mono text-xs text-zinc-600">{a.fecha}</time>
          </a>
        </li>)}
      </ul>}
  </GuiaFrame>;
}
