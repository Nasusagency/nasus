"use client";

import { useState, useEffect, useRef } from "react";

type Phase = "idle" | "uploading" | "processing" | "result";

const RULES = [
  { label: "Fondo blanco uniforme", pass: true },
  { label: "Rostro de frente", pass: true },
  { label: "Ojos abiertos y visibles", pass: true },
  { label: "Sin lentes", pass: true },
  { label: "Expresión neutral", pass: true },
  { label: "Foto nítida y bien iluminada", pass: true },
  { label: "Sin accesorios en cabeza", pass: false },
];

export default function FotosDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const t1 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2 = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startDemo() {
    setPhase("uploading");
    t1.current = setTimeout(() => {
      setPhase("processing");
      t2.current = setTimeout(() => setPhase("result"), 1800);
    }, 900);
  }

  function reset() {
    if (t1.current) clearTimeout(t1.current);
    if (t2.current) clearTimeout(t2.current);
    setPhase("idle");
  }

  useEffect(() => {
    return () => {
      if (t1.current) clearTimeout(t1.current);
      if (t2.current) clearTimeout(t2.current);
    };
  }, []);

  if (phase === "idle") {
    return (
      <button
        onClick={startDemo}
        className="inline-block border border-[#c4a882] text-[#c4a882] px-4 py-2 rounded-lg text-sm hover:bg-[#c4a882] hover:text-[#050508] transition-colors font-mono"
      >
        Ver demo →
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-[#c4a882]/30 bg-zinc-900/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#c4a882]/10 border-b border-[#c4a882]/20">
        <span className="text-[10px] font-mono text-[#c4a882] font-bold tracking-[0.2em]">
          DEMO — DATOS DE EJEMPLO
        </span>
        <button onClick={reset} className="text-[10px] text-zinc-600 hover:text-zinc-400 font-mono transition-colors">
          cerrar ×
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Photo placeholder + type */}
        <div className="flex items-center gap-3">
          <div className="w-16 h-20 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-7 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Tipo</p>
            <p className="text-xs font-mono text-zinc-300">Pasaporte MX</p>
            <p className="text-[10px] font-mono text-zinc-600 mt-0.5">foto_pasaporte.jpg · 1.2 MB</p>
          </div>
        </div>

        {phase === "uploading" && (
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#c4a882] animate-pulse flex-shrink-0" />
            <span className="text-xs text-zinc-400 font-mono">Subiendo fotografía…</span>
          </div>
        )}

        {phase === "processing" && (
          <div className="flex items-center gap-2.5">
            <svg className="animate-spin h-3.5 w-3.5 text-[#c4a882] flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.84 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs text-zinc-400 font-mono">Analizando fotografía con IA…</span>
          </div>
        )}

        {phase === "result" && (
          <div className="space-y-3">
            {/* Verdict */}
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-700/50 bg-amber-950/30 px-3 py-2.5">
              <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-xs font-mono text-amber-300 font-semibold">Revisar</p>
                <p className="text-[9px] font-mono text-amber-500/80">6 de 7 criterios aprobados</p>
              </div>
            </div>

            {/* Rules */}
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              {RULES.map((r, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2 border-b border-zinc-800/50 last:border-0">
                  {r.pass ? (
                    <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className={`text-[10px] font-mono ${r.pass ? "text-zinc-400" : "text-amber-400"}`}>
                    {r.label}
                  </span>
                </div>
              ))}
            </div>

            <a
              href="https://wa.me/523329142391"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-9 rounded-xl bg-[#c4a882] text-[#050508] text-xs font-mono font-bold hover:bg-[#d4b892] transition-colors"
            >
              Pedir acceso →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
