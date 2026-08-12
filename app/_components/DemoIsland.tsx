"use client";

import { useState, useEffect, useRef } from "react";

const DEMO_FIELDS: Record<string, string> = {
  nombres: "CARLOS ALBERTO",
  apellido_paterno: "MENDOZA",
  apellido_materno: "LUNA",
  curp: "MELC850312HDFNRS05",
  clave_elector: "MNDLCR850312HDFNNS",
  fecha_nacimiento: "1985-03-12",
  fecha_vencimiento: "2030-01-01",
  seccion: "2847",
  generacion: "2020",
  domicilio: "CALLE MAGNOLIA 42, COL. JARDINES DEL SUR",
  entidad: "CIUDAD DE MÉXICO",
  folio: "DEF456789",
};

const LABELS: Record<string, string> = {
  nombres: "Nombres",
  apellido_paterno: "Apellido paterno",
  apellido_materno: "Apellido materno",
  curp: "CURP",
  clave_elector: "Clave de elector",
  fecha_nacimiento: "Fecha de nacimiento",
  fecha_vencimiento: "Fecha de vencimiento",
  seccion: "Sección electoral",
  generacion: "Generación",
  domicilio: "Domicilio",
  entidad: "Entidad",
  folio: "Folio",
};

type Phase = "idle" | "uploading" | "processing" | "result";

function IneCard() {
  return (
    <div className="relative rounded-xl overflow-hidden border border-zinc-700 select-none">
      <div className="h-2 bg-gradient-to-r from-[#c4a882] via-zinc-600 to-[#c4a882]" />
      <div className="bg-zinc-800/80 p-4">
        <div className="text-[9px] font-mono text-zinc-500 tracking-widest mb-3 uppercase">
          Instituto Nacional Electoral
        </div>
        <div className="flex gap-3">
          <div className="w-14 h-18 rounded-lg bg-zinc-700 border border-zinc-600 flex items-center justify-center flex-shrink-0 aspect-[3/4]">
            <svg className="w-7 h-7 text-zinc-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="text-white font-bold text-sm leading-tight">
              {DEMO_FIELDS.apellido_paterno} {DEMO_FIELDS.apellido_materno}
            </div>
            <div className="text-zinc-300 text-xs">{DEMO_FIELDS.nombres}</div>
            <div className="pt-1 space-y-0.5">
              <div className="text-[9px] text-zinc-500 font-mono">
                CURP <span className="text-zinc-300">{DEMO_FIELDS.curp}</span>
              </div>
              <div className="text-[9px] text-zinc-500 font-mono">
                CLAVE <span className="text-zinc-300">{DEMO_FIELDS.clave_elector}</span>
              </div>
              <div className="text-[9px] text-zinc-500 font-mono">
                VIG <span className="text-zinc-300">2030</span>{" "}
                <span className="ml-2">SECCIÓN <span className="text-zinc-300">2847</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="h-1.5 bg-gradient-to-r from-transparent via-[#c4a882]/40 to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-[#c4a882]/15 text-3xl font-black uppercase tracking-[0.3em] font-mono -rotate-12">
          EJEMPLO
        </div>
      </div>
    </div>
  );
}

export default function DemoIsland() {
  const [phase, setPhase] = useState<Phase>("idle");
  const t1 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2 = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startDemo() {
    setPhase("uploading");
    t1.current = setTimeout(() => {
      setPhase("processing");
      t2.current = setTimeout(() => setPhase("result"), 2000);
    }, 1200);
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
        className="inline-block border border-[#c4a882] text-[#c4a882] px-4 py-2 rounded-lg text-sm text-center hover:bg-[#c4a882] hover:text-[#050508] transition-colors font-mono"
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
        <button
          onClick={reset}
          className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors font-mono"
        >
          cerrar ×
        </button>
      </div>

      <div className="p-4 space-y-4">
        <IneCard />

        {phase === "uploading" && (
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#c4a882] animate-pulse flex-shrink-0" />
            <span className="text-xs text-zinc-400 font-mono">Subiendo documento…</span>
          </div>
        )}

        {phase === "processing" && (
          <div className="flex items-center gap-2.5">
            <svg className="animate-spin h-3.5 w-3.5 text-[#c4a882] flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.84 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs text-zinc-400 font-mono">Analizando con IA…</span>
          </div>
        )}

        {phase === "result" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-green-950/60 border border-green-800/60 text-green-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Documento válido
              </span>
            </div>
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full">
                <tbody>
                  {Object.entries(DEMO_FIELDS).map(([key, value]) => (
                    <tr key={key} className="border-b border-zinc-800/60 last:border-0">
                      <td className="px-3 py-2 text-zinc-500 font-mono text-[10px] whitespace-nowrap w-1/3">
                        {LABELS[key]}
                      </td>
                      <td className="px-3 py-2 text-zinc-200 font-mono text-[10px]">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <a
              href="https://wa.me/523329142391"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-[#c4a882] text-[#050508] text-xs font-mono font-bold hover:bg-[#d4b892] transition-colors"
            >
              Pedir acceso →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
