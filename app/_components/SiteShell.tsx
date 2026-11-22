"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { hayAsistente } from "./assistant-support";
import Logo from "./Logo";

export type ModuleDef = { id: string; label: string; hint: string };

type Props = {
  modules: ModuleDef[];
  /** Contenido de cada módulo, ya renderizado en el servidor. */
  panels: Record<string, ReactNode>;
  /**
   * Ids de secciones internas → módulo que las contiene. Permite que un enlace
   * como #construimos abra el módulo correcto y haga scroll hasta ahí.
   */
  aliases: Record<string, string>;
  whatsappUrl: string;
  whatsappDisplay: string;
  mundoUrl: string;
  footer: ReactNode;
};

// ─── Estado externo: hash de la URL y soporte del navegador ────────────────────
// Se leen con useSyncExternalStore para que no haya desajuste de hidratación ni
// setState dentro de un efecto. En servidor: sin hash (módulo inicial).
const suscribirHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const leerHash = () => window.location.hash;
const hashEnServidor = () => "";

const noSuscribir = () => () => {};
const asistenteEnServidor = () => true;

export default function SiteShell({
  modules,
  panels,
  aliases,
  whatsappUrl,
  whatsappDisplay,
  mundoUrl,
  footer,
}: Props) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const hash = useSyncExternalStore(suscribirHash, leerHash, hashEnServidor);
  const asistente = useSyncExternalStore(noSuscribir, hayAsistente, asistenteEnServidor);

  const objetivo = decodeURIComponent(hash.replace(/^#/, ""));
  const inicial = modules[0].id;
  const activo =
    modules.find((m) => m.id === objetivo)?.id ?? aliases[objetivo] ?? inicial;

  // Al cambiar de módulo: arriba del todo, o hasta la sección interna pedida.
  useEffect(() => {
    const esModulo = modules.some((m) => m.id === objetivo);
    const el = objetivo && !esModulo ? document.getElementById(objetivo) : null;
    if (el) el.scrollIntoView({ block: "start" });
    else window.scrollTo({ top: 0 });
  }, [objetivo, modules]);

  // Menú abierto: Escape lo cierra y el fondo no se desplaza.
  useEffect(() => {
    if (!menuAbierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAbierto(false);
    };
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuAbierto]);

  const cerrarMenu = useCallback(() => {
    setMenuAbierto(false);
    // Si ya estás en ese módulo el hash no cambia: sube igual.
    window.scrollTo({ top: 0 });
  }, []);

  // El botón "Agentes de IA" lleva a la tarjeta de voz de Inicio y arranca la
  // conversación. Se dispara dentro del clic para conservar el permiso de micrófono.
  const abrirAsistente = useCallback(() => {
    setMenuAbierto(false);
    window.dispatchEvent(new Event("nasus:voice"));
    window.location.hash = "agentes";
    requestAnimationFrame(() =>
      document.getElementById("agentes")?.scrollIntoView({ block: "center" }),
    );
  }, []);

  return (
    <div>
      {/* ── Barra fija ───────────────────────────────────────────────────── */}
      {/* id="site-nav": SiteChrome le pone data-scrolled al pasar de 30px. */}
      <header
        id="site-nav"
        data-scrolled="false"
        className="group sticky top-0 z-50 border-b border-transparent transition-[background-color,backdrop-filter,border-color] duration-500 data-[scrolled=true]:border-[#c4a882]/15 data-[scrolled=true]:bg-[#050508]/85 data-[scrolled=true]:backdrop-blur-xl"
      >
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 max-md:h-14 md:px-6">
          <a href={`#${inicial}`} aria-label="Nasus, inicio" className="justify-self-start">
            <Logo height={36} tone="dark" />
          </a>

          {/* Botón central: el asistente de voz. */}
          {asistente ? (
            <button
              type="button"
              onClick={abrirAsistente}
              className="group/ia inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-[#00f2ff]/50 bg-[#00f2ff]/[0.06] px-4 py-2 font-mono text-[12px] tracking-wide text-[#00f2ff] transition-colors hover:bg-[#00f2ff] hover:text-[#050508] max-sm:gap-1.5 max-sm:px-2.5 max-sm:text-[10.5px]"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]"
              />
              Agentes de IA
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center justify-self-end gap-5">
            <a
              href={mundoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden font-mono text-xs text-zinc-400 transition-colors hover:text-[#00f2ff] lg:inline"
            >
              Mundo Nasus ↗
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden font-mono text-xs text-zinc-300 transition-colors hover:text-[#c4a882] md:inline"
            >
              {whatsappDisplay}
            </a>
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-expanded={menuAbierto}
              aria-controls="menu-principal"
              aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 font-mono text-xs text-zinc-300 transition-colors hover:border-[#c4a882] hover:text-[#c4a882]"
            >
              <span className="max-sm:hidden">Menú</span>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="M2 5h14M2 9h14M2 13h14"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── Menú desplegable ─────────────────────────────────────────────── */}
      {menuAbierto && (
        <div
          id="menu-principal"
          role="dialog"
          aria-modal="true"
          aria-label="Menú principal"
          className="fixed inset-0 z-[60] flex justify-end bg-[#050508]/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMenuAbierto(false);
          }}
        >
          <div className="flex h-full w-full flex-col overflow-y-auto border-l border-zinc-900 bg-[#07070c] px-6 py-5 md:w-[26rem]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-600">
                Menú
              </span>
              <button
                type="button"
                onClick={() => setMenuAbierto(false)}
                aria-label="Cerrar menú"
                className="rounded-lg border border-zinc-800 p-2 text-zinc-300 transition-colors hover:border-[#c4a882] hover:text-[#c4a882]"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <nav aria-label="Secciones" className="mt-5 flex flex-col">
              {modules.map((m) => {
                const esActivo = m.id === activo;
                return (
                  <a
                    key={m.id}
                    href={`#${m.id}`}
                    onClick={cerrarMenu}
                    aria-current={esActivo ? "page" : undefined}
                    className="group/item border-b border-zinc-900 py-2.5 transition-colors"
                  >
                    <span
                      className={`font-display text-xl font-bold transition-colors ${
                        esActivo ? "text-[#c4a882]" : "text-white group-hover/item:text-[#c4a882]"
                      }`}
                    >
                      {m.label}
                    </span>
                    <span className="mt-1 block font-mono text-[11px] text-zinc-600">{m.hint}</span>
                  </a>
                );
              })}
            </nav>

            {asistente && (
              <button
                type="button"
                onClick={abrirAsistente}
                className="mt-6 flex items-center justify-between rounded-xl border border-[#00f2ff]/40 bg-[#00f2ff]/[0.05] px-4 py-3 text-left transition-colors hover:bg-[#00f2ff]/10"
              >
                <span>
                  <span className="block font-display text-lg font-bold text-[#00f2ff]">Agentes de IA</span>
                  <span className="block font-mono text-[11px] text-zinc-500">Habla con el asistente</span>
                </span>
                <span aria-hidden="true" className="text-[#00f2ff]">●</span>
              </button>
            )}

            <a
              href={mundoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-between rounded-xl border border-zinc-800 px-4 py-3 transition-colors hover:border-[#00f2ff]/60"
            >
              <span>
                <span className="block font-display text-lg font-bold text-white">Mundo Nasus</span>
                <span className="block font-mono text-[11px] text-zinc-500">Nasus Intelligence · mundo.nasus.lat</span>
              </span>
              <span aria-hidden="true" className="text-[#00f2ff]">↗</span>
            </a>

            <div className="mt-auto pt-6 pb-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-600">
                WhatsApp · atiende una persona
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block font-display text-2xl font-bold text-white transition-colors hover:text-[#c4a882]"
              >
                {whatsappDisplay}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Módulos: todos en el HTML, uno visible a la vez ──────────────── */}
      {/* `hidden` deja el contenido en el documento (indexable y con anclas
          funcionales) sin alargar la página con scroll. */}
      <main className="relative z-10">
        {modules.map((m) => (
          <div key={m.id} data-module={m.id} hidden={m.id !== activo}>
            {panels[m.id]}
          </div>
        ))}
      </main>

      {/* Elemento creado en el servidor: lleva key para que React no lo trate
          como hijo de lista sin identificar. */}
      <div key="footer" className="relative z-10">{footer}</div>
    </div>
  );
}
