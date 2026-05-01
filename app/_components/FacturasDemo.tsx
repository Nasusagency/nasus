"use client";

import { useState, useEffect, useRef } from "react";

type Phase = "idle" | "uploading" | "processing" | "result";

function mxn(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

const DEMO_CUENTAS = [
  {
    nombre: "Branding UAG",
    id: "332-034-5197",
    campanas: [
      { nombre: "Adview | Branding | Lic. Presencial | Caliente", clics: "6,285", importe: 89829.51 },
      { nombre: "Adview | Top Keywords | Lic. Presencial | Fría", clics: "4,556", importe: 52089.43 },
      { nombre: "Adview | Youtube | Branding | Fría (Nuevo Formato)", clics: "1,543,992 imp.", importe: 13327.96 },
    ],
    subtotal: 155246.9,
    total: 180086.41,
  },
  {
    nombre: "UAG en Línea",
    id: "829-732-7813",
    campanas: [
      { nombre: "Licenciatura @Campus | Ing. Sistemas de Software", clics: "2,045", importe: 101505.46 },
      { nombre: "Posgrados @Campus | Big Data", clics: "2,639", importe: 83284.26 },
      { nombre: "Licenciaturas @Campus | Derecho", clics: "3,369", importe: 86572.24 },
    ],
    subtotal: 271362.0,
    total: 314779.92,
  },
];

export default function FacturasDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const t1 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2 = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startDemo() {
    setPhase("uploading");
    t1.current = setTimeout(() => {
      setPhase("processing");
      t2.current = setTimeout(() => setPhase("result"), 2200);
    }, 1000);
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
        {/* Fake PDF file */}
        <div className="flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
          <svg className="w-4 h-4 text-[#c4a882] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="text-[10px] font-mono text-zinc-400">Google_Ads_Dic2025.pdf</span>
          <span className="text-[10px] font-mono text-zinc-600 ml-auto">2.1 MB</span>
        </div>

        {phase === "uploading" && (
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#c4a882] animate-pulse flex-shrink-0" />
            <span className="text-xs text-zinc-400 font-mono">Subiendo factura PDF…</span>
          </div>
        )}

        {phase === "processing" && (
          <div className="flex items-center gap-2.5">
            <svg className="animate-spin h-3.5 w-3.5 text-[#c4a882] flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.84 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs text-zinc-400 font-mono">Leyendo campañas…</span>
          </div>
        )}

        {phase === "result" && (
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#c4a882]/20 bg-[#c4a882]/5 px-3 py-2.5">
              {[
                ["Período", "Dic 2025"],
                ["Doc", "5458689254"],
                ["RFC Emisor", "GOM0809114P5"],
                ["RFC Receptor", "UAG7806127I8"],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[8px] font-mono text-zinc-600 uppercase">{k}</p>
                  <p className="text-[9px] font-mono text-zinc-300">{v}</p>
                </div>
              ))}
            </div>

            {/* Accounts */}
            {DEMO_CUENTAS.map((cuenta) => (
              <div key={cuenta.id} className="rounded-lg border border-zinc-800 overflow-hidden">
                <div className="bg-zinc-900/70 px-3 py-1.5 flex items-center justify-between">
                  <p className="text-[10px] font-mono text-zinc-300 font-semibold">{cuenta.nombre}</p>
                  <p className="text-[10px] font-mono text-[#c4a882]">{mxn(cuenta.total)}</p>
                </div>
                {cuenta.campanas.map((c, i) => (
                  <div key={i} className="px-3 py-1.5 border-t border-zinc-800/50 flex items-start justify-between gap-2">
                    <p className="text-[9px] font-mono text-zinc-500 flex-1 leading-tight">{c.nombre}</p>
                    <p className="text-[9px] font-mono text-zinc-400 text-right flex-shrink-0">{mxn(c.importe)}</p>
                  </div>
                ))}
              </div>
            ))}

            {/* Totals */}
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              {[
                ["Subtotal", 2655234.85, false],
                ["IVA 16%", 424837.58, false],
                ["TOTAL", 3080072.43, true],
              ].map(([label, val, bold]) => (
                <div key={label as string} className={`flex justify-between px-3 py-1.5 border-b border-zinc-800/50 last:border-0 ${bold ? "bg-[#c4a882]/10" : ""}`}>
                  <span className={`text-[10px] font-mono ${bold ? "text-[#c4a882] font-bold" : "text-zinc-500"}`}>{label as string}</span>
                  <span className={`text-[10px] font-mono ${bold ? "text-[#c4a882] font-bold" : "text-zinc-300"}`}>{mxn(val as number)}</span>
                </div>
              ))}
            </div>

            <a
              href="mailto:nasusagency@gmail.com"
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
