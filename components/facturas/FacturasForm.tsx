"use client";

import { useState, useCallback, useRef } from "react";
import type { FacturaExtraccion } from "@/lib/facturas/types";

type AdTipo = "google" | "meta";
type Phase = "idle" | "loading" | "result" | "error";

const RATE_LIMIT_KEY = "nasus_facturas_count";
const RATE_LIMIT_MAX = 3;

function getRateCount(): number {
  try {
    return parseInt(localStorage.getItem(RATE_LIMIT_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function incrementRateCount(): void {
  try {
    localStorage.setItem(RATE_LIMIT_KEY, String(getRateCount() + 1));
  } catch {}
}

function mxn(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export default function FacturasForm() {
  const [tipo, setTipo] = useState<AdTipo>("google");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FacturaExtraccion | null>(null);
  const [dragging, setDragging] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (f.type !== "application/pdf") {
      setError("Solo se aceptan archivos PDF.");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError("El archivo no puede superar 20 MB.");
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
    setPhase("idle");
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleExtract = useCallback(async () => {
    if (!file) return;

    const count = getRateCount();
    if (count >= RATE_LIMIT_MAX) {
      setError("RATE_LIMIT");
      return;
    }

    setPhase("loading");
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("tipo", tipo);

      const res = await fetch("/api/facturas/extract", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "Error desconocido del servidor");
        setPhase("error");
        return;
      }

      incrementRateCount();
      setResult(data as FacturaExtraccion);
      setPhase("result");
    } catch {
      setError("No se pudo conectar con el servidor.");
      setPhase("error");
    }
  }, [file, tipo]);

  const handleDownload = useCallback(async () => {
    if (!result) return;
    setDownloading(true);
    try {
      const { downloadExcel } = await import("@/lib/facturas/excel");
      downloadExcel(result);
    } finally {
      setDownloading(false);
    }
  }, [result]);

  const handleClear = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
    setPhase("idle");
  }, []);

  const isRateLimited = error === "RATE_LIMIT";
  const remaining = Math.max(0, RATE_LIMIT_MAX - getRateCount());

  return (
    <div className="flex flex-col gap-6">
      {/* Tipo selector */}
      <div className="flex gap-3">
        {(["google", "meta"] as AdTipo[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTipo(t); setResult(null); setError(null); setPhase("idle"); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-mono font-semibold transition-colors ${
              tipo === t
                ? "bg-[#c4a882] text-[#050508] border-[#c4a882]"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
            }`}
          >
            {t === "google" ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 10h6M12 7v6" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
              </svg>
            )}
            {t === "google" ? "Google Ads" : "Meta Ads"}
          </button>
        ))}
      </div>

      {/* Drop zone / file preview */}
      {!file ? (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
            dragging
              ? "border-[#c4a882] bg-zinc-900"
              : "border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-zinc-700"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          <svg className="w-10 h-10 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-sm text-zinc-500 text-center">
            <span className="font-medium text-zinc-300">Haz clic para seleccionar</span>{" "}
            o arrastra el PDF aquí
          </p>
          <p className="text-xs text-zinc-600 font-mono">Solo PDF · máx. 20 MB</p>
        </label>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <svg className="w-5 h-5 text-[#c4a882] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span className="text-sm font-mono text-zinc-300 truncate">{file.name}</span>
            <span className="text-xs font-mono text-zinc-600 flex-shrink-0">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
          <button type="button" onClick={handleClear} className="text-xs font-mono text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0">
            Quitar
          </button>
        </div>
      )}

      {/* Rate limit warning */}
      {remaining <= 1 && remaining > 0 && phase !== "result" && (
        <p className="text-xs font-mono text-amber-500">
          {remaining === 1 ? "Esta es tu última extracción gratuita." : ""}
        </p>
      )}

      {/* Extract button */}
      {file && phase !== "result" && (
        <button
          onClick={handleExtract}
          disabled={phase === "loading" || isRateLimited}
          className="w-full h-12 rounded-xl bg-[#c4a882] text-[#050508] text-sm font-mono font-bold transition-colors hover:bg-[#d4b892] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {phase === "loading" ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.84 3 7.938l3-2.647z" />
              </svg>
              Leyendo campañas…
            </span>
          ) : "Extraer a Excel"}
        </button>
      )}

      {/* Error */}
      {error && !isRateLimited && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400 font-mono">
          {error}
        </div>
      )}

      {/* Rate limit exceeded */}
      {isRateLimited && (
        <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 px-4 py-4 flex flex-col gap-2">
          <p className="text-sm text-amber-400 font-mono font-semibold">
            Límite de extracciones gratuitas alcanzado (3 de 3)
          </p>
          <p className="text-xs text-amber-500/80 font-mono">
            Para extracciones ilimitadas contacta a Nasus
          </p>
          <a
            href="mailto:nasusagency@gmail.com"
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-mono text-[#c4a882] hover:text-[#d4b892] transition-colors"
          >
            nasusagency@gmail.com →
          </a>
        </div>
      )}

      {/* Result preview */}
      {result && phase === "result" && (
        <div className="flex flex-col gap-4">
          {/* Summary header */}
          <div className="rounded-xl border border-[#c4a882]/30 bg-[#c4a882]/5 px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-2">
            {result.periodo && (
              <div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Período</p>
                <p className="text-sm text-white font-mono">{result.periodo}</p>
              </div>
            )}
            {result.numero_documento && (
              <div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Documento</p>
                <p className="text-sm text-white font-mono">{result.numero_documento}</p>
              </div>
            )}
            {result.rfc_emisor && (
              <div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">RFC Emisor</p>
                <p className="text-sm text-white font-mono">{result.rfc_emisor}</p>
              </div>
            )}
            {result.rfc_receptor && (
              <div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">RFC Receptor</p>
                <p className="text-sm text-white font-mono">{result.rfc_receptor}</p>
              </div>
            )}
          </div>

          {/* Per-account tables */}
          {result.cuentas.map((cuenta, ci) => (
            <div key={ci} className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="bg-zinc-900/70 px-4 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono text-zinc-300 font-semibold">{cuenta.nombre}</p>
                  {cuenta.id_cuenta && (
                    <p className="text-[10px] font-mono text-zinc-600">{cuenta.id_cuenta}</p>
                  )}
                </div>
                <p className="text-sm font-mono text-[#c4a882] font-bold">{mxn(cuenta.total)}</p>
              </div>
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-2 text-zinc-600 font-medium">Campaña</th>
                    <th className="text-right px-4 py-2 text-zinc-600 font-medium w-28">Cantidad</th>
                    <th className="text-right px-4 py-2 text-zinc-600 font-medium w-28">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {cuenta.campanas.map((c, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 last:border-0">
                      <td className="px-4 py-2 text-zinc-300">{c.nombre}</td>
                      <td className="px-4 py-2 text-right text-zinc-500">
                        {c.cantidad != null ? `${c.cantidad.toLocaleString("es-MX")} ${c.unidades ?? ""}` : "—"}
                      </td>
                      <td className={`px-4 py-2 text-right font-semibold ${c.importe < 0 ? "text-red-400" : "text-zinc-300"}`}>
                        {mxn(c.importe)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-900/50 border-t border-zinc-800">
                    <td colSpan={2} className="px-4 py-2 text-zinc-500 text-right">Subtotal</td>
                    <td className="px-4 py-2 text-right text-zinc-300 font-semibold">{mxn(cuenta.subtotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}

          {/* Global totals */}
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm font-mono">
              <tbody>
                <tr className="border-b border-zinc-800">
                  <td className="px-5 py-3 text-zinc-500">Subtotal</td>
                  <td className="px-5 py-3 text-right text-zinc-300">{mxn(result.subtotal)}</td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="px-5 py-3 text-zinc-500">IVA 16%</td>
                  <td className="px-5 py-3 text-right text-zinc-300">{mxn(result.iva)}</td>
                </tr>
                <tr className="bg-[#c4a882]/10">
                  <td className="px-5 py-3 text-[#c4a882] font-bold">TOTAL</td>
                  <td className="px-5 py-3 text-right text-[#c4a882] font-bold text-base">{mxn(result.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full h-12 rounded-xl border-2 border-[#c4a882] text-[#c4a882] text-sm font-mono font-bold transition-colors hover:bg-[#c4a882] hover:text-[#050508] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {downloading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.84 3 7.938l3-2.647z" />
                </svg>
                Generando Excel…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Descargar Excel
              </>
            )}
          </button>

          <button
            onClick={handleClear}
            className="text-xs font-mono text-zinc-600 hover:text-zinc-400 transition-colors text-center"
          >
            Procesar otra factura
          </button>
        </div>
      )}
    </div>
  );
}
