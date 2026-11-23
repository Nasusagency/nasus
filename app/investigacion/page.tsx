import type { Metadata } from "next";
import GuiaFrame from "@/app/guia/GuiaFrame";
import { INVESTIGACION, PUBLICADA } from "@/lib/guia/investigacion";

export const metadata: Metadata = {
  title: "Investigación",
  description: "Estudios de Nasus Agency sobre IA, agentes y automatización.",
  alternates: { canonical: "/investigacion" },
  robots: PUBLICADA ? undefined : { index: false, follow: false },
};

export default function InvestigacionPage() {
  return <GuiaFrame>
    <p className="font-mono text-[11px] tracking-[.2em] text-[#c4a882] uppercase">Investigación</p>
    <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Investigación de Nasus</h1>
    <p className="mt-3 text-zinc-400">Estudios propios de Nasus Agency, con metodología, fecha y datos anonimizados.</p>
    <ul className="mt-10 space-y-6">
      <li>
        <a href={`/investigacion/${INVESTIGACION.slug}`} className="group block">
          <span className="text-lg text-zinc-100 underline-offset-4 group-hover:text-[#c4a882] group-hover:underline">{INVESTIGACION.titulo}</span>
          <span className="mt-1 block text-sm text-zinc-500">{INVESTIGACION.definicion}</span>
          <span className="mt-2 block font-mono text-xs text-zinc-600">En curso desde {INVESTIGACION.inicio} · versión {INVESTIGACION.version}</span>
        </a>
      </li>
    </ul>
  </GuiaFrame>;
}
