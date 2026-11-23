/* eslint-disable @next/next/no-html-link-for-pages -- <a> normal a propósito: cada visita es una petición completa (sin prefetch), así el registro ve lo mismo para personas y agentes. */
import Logo from "@/app/_components/Logo";
import { GUIA_BASE } from "@/lib/guia/routes";

/**
 * Marco común de la guía. Enlaces con <a> normal (no next/link) a propósito:
 * cada página es una petición completa, igual para personas y agentes, y no
 * hay prefetch que infle el registro.
 */
export default function GuiaFrame({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#050508] text-white">
    <header className="border-b border-zinc-900 px-5 py-5 sm:px-8">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <a href="/" aria-label="Nasus, inicio"><Logo height={30} tone="dark" /></a>
        <nav aria-label="Guía" className="flex gap-5 text-sm text-zinc-400">
          <a href={GUIA_BASE} className="transition-colors hover:text-white">Guía</a>
          <a href="/contacto" className="transition-colors hover:text-white">Contacto</a>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">{children}</main>
    <footer className="border-t border-zinc-900 px-5 py-8 sm:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 text-xs text-zinc-600 sm:flex-row sm:justify-between">
        <span>© NASUS® Agency · nasus.mx</span>
        <nav aria-label="Información legal" className="flex gap-4"><a href="/" className="hover:text-zinc-400">Sitio principal</a><a href="/privacidad" className="hover:text-zinc-400">Privacidad</a><a href="/llms.txt" className="hover:text-zinc-400">llms.txt</a></nav>
      </div>
    </footer>
  </div>;
}
