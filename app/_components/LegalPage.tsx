import Link from "next/link";

export type LegalSection = { id: string; title: string; content: React.ReactNode };

export default function LegalPage({ eyebrow, title, intro, sections }: { eyebrow: string; title: string; intro: string; sections: LegalSection[] }) {
  return <div className="min-h-screen bg-[#050508] text-white">
    <header className="border-b border-zinc-900 px-5 py-5 sm:px-8"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4"><Link href="/" className="font-mono text-sm font-bold tracking-widest text-[#c4a882]">NASUS</Link><Link href="/" className="text-sm text-zinc-400 transition-colors hover:text-white">Volver al sitio</Link></div></header>
    <main className="mx-auto grid max-w-5xl gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[13rem_minmax(0,1fr)] lg:py-20">
      <aside className="lg:sticky lg:top-8 lg:self-start"><p className="font-mono text-[10px] tracking-[.24em] text-[#c4a882]">{eyebrow}</p><nav aria-label="Contenido de esta página" className="mt-5 hidden lg:block"><ol className="space-y-2.5 text-xs text-zinc-500">{sections.map((section,index)=><li key={section.id}><a href={`#${section.id}`} className="transition-colors hover:text-[#c4a882]"><span className="mr-2 text-zinc-700">{String(index+1).padStart(2,"0")}</span>{section.title}</a></li>)}</ol></nav></aside>
      <article className="min-w-0"><h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">{title}</h1><p className="mt-6 max-w-2xl text-base leading-7 text-zinc-400">{intro}</p><p className="mt-4 font-mono text-xs text-zinc-600">Última actualización: 29 de agosto de 2026</p><div className="mt-12 space-y-12">{sections.map((section,index)=><section key={section.id} id={section.id} className="scroll-mt-8 border-t border-zinc-900 pt-8"><p className="font-mono text-[10px] tracking-widest text-[#c4a882]">{String(index+1).padStart(2,"0")}</p><h2 className="mt-2 text-xl font-semibold text-zinc-100 sm:text-2xl">{section.title}</h2><div className="mt-4 space-y-4 text-sm leading-7 text-zinc-400 sm:text-base [&_a]:text-[#c4a882] [&_a]:underline-offset-4 [&_a:hover]:underline [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{section.content}</div></section>)}</div></article>
    </main>
    <footer className="border-t border-zinc-900 px-5 py-8 sm:px-8"><div className="mx-auto flex max-w-5xl flex-col gap-4 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between"><span>© Nasus · nasus.lat</span><div className="flex gap-5"><Link href="/privacidad" className="hover:text-zinc-300">Privacidad</Link><Link href="/terminos" className="hover:text-zinc-300">Términos</Link><a href="mailto:contacto@nasus.lat" className="hover:text-zinc-300">contacto@nasus.lat</a></div></div></footer>
  </div>;
}
