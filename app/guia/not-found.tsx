import { guiaChildren, guiaHref } from "@/lib/guia/routes";
import GuiaFrame from "./GuiaFrame";

/** 404 dentro de la guía. El middleware ya registró la ruta pedida. */
export default function GuiaNotFound() {
  return <GuiaFrame>
    <p className="font-mono text-xs tracking-[.2em] text-[#c4a882]">404</p>
    <h1 className="mt-3 font-display text-3xl font-bold">Esta página de la guía no existe</h1>
    <p className="mt-4 text-zinc-400">Estos son los temas disponibles:</p>
    <ul className="mt-6 space-y-4">{guiaChildren("").map((item) => <li key={item.slug}><a href={`${guiaHref(item.slug)}?ref=404`} className="text-zinc-100 hover:text-[#c4a882]">{item.title}</a><span className="block text-sm text-zinc-500">{item.summary}</span></li>)}</ul>
  </GuiaFrame>;
}
