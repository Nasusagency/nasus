"use client";

import { useState, useCallback, useRef } from "react";
import type { PhotoType } from "@/lib/photos/types";
import type { PhotoAnalysisResult } from "@/lib/photos/types";
import type { PhotoConfig } from "@/lib/photos/types";
import { PHOTO_REGISTRY } from "@/lib/photos/config/index";
import type { PhotoPanelOptions } from "@/lib/photos/config/custom.photo";
import { buildCustomPhotoConfig, EDUCATIONAL_DEFAULT } from "@/lib/photos/config/custom.photo";
import PhotoResult from "./PhotoResult";
import PhotoConfigPanel from "./PhotoConfigPanel";

type Mode = PhotoType | "custom";

const PHOTO_TYPES: { id: PhotoType; label: string; hint: string }[] = [
  { id: "pasaporte-mx", label: "Pasaporte MX", hint: "Requisitos SRE oficiales" },
  { id: "visa-usa", label: "Visa USA", hint: "Requisitos USCIS" },
  { id: "escolar", label: "Escolar / Infantil", hint: "Estándar genérico" },
];

const ACCEPTED_MIME = "image/jpeg,image/png,image/webp";

export default function PhotoValidatorForm() {
  const [mode, setMode] = useState<Mode>("pasaporte-mx");
  const [customOpts, setCustomOpts] = useState<PhotoPanelOptions>(EDUCATIONAL_DEFAULT);
  const [panelOpen, setPanelOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PhotoAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeConfig: PhotoConfig | null =
    mode === "custom"
      ? buildCustomPhotoConfig(customOpts)
      : PHOTO_REGISTRY[mode as PhotoType];

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      setError("Solo se admiten imágenes JPG, PNG o WEBP.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("El archivo no puede superar 5 MB.");
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
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

  const handleValidate = useCallback(async () => {
    if (!file || !activeConfig) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      form.append("type", mode === "custom" ? "escolar" : mode);
      if (mode === "custom") {
        form.append("customConfig", JSON.stringify(activeConfig));
      }
      const res = await fetch("/api/validate-photo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Error desconocido del servidor");
        return;
      }
      setResult(data as PhotoAnalysisResult);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, [file, mode, activeConfig]);

  const handleClear = useCallback(() => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setResult(null);
    setError(null);
  }, [preview]);

  return (
    <div className="flex flex-col gap-4">
      {/* Mode selector */}
      <div className="flex flex-wrap gap-2">
        {PHOTO_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setMode(t.id); setResult(null); }}
            className={`px-3 py-1.5 rounded-full text-sm font-mono border transition-colors ${
              mode === t.id
                ? "bg-[#c4a882] text-[#050508] border-[#c4a882] font-bold"
                : "border-zinc-700 text-zinc-500 hover:border-[#c4a882] hover:text-[#c4a882]"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setMode("custom"); setResult(null); }}
          className={`px-3 py-1.5 rounded-full text-sm font-mono border transition-colors ${
            mode === "custom"
              ? "bg-[#c4a882] text-[#050508] border-[#c4a882] font-bold"
              : "border-zinc-700 text-zinc-500 hover:border-[#c4a882] hover:text-[#c4a882]"
          }`}
        >
          Personalizado
        </button>
      </div>

      {/* Hint / custom config bar */}
      {mode !== "custom" ? (
        <p className="text-xs font-mono text-zinc-600">
          {PHOTO_TYPES.find((t) => t.id === mode)?.hint} ·{" "}
          {PHOTO_REGISTRY[mode as PhotoType].institution}
        </p>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-[#c4a882]/30 bg-[#c4a882]/5 px-4 py-2.5">
          <div>
            <p className="text-xs font-mono text-[#c4a882] font-bold">Configuración institucional</p>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
              {activeConfig?.rules.filter((r) => r.required).length} reglas activas ·{" "}
              tolerancia {customOpts.tolerance === "strict" ? "estricta" : customOpts.tolerance === "medium" ? "media" : "flexible"}
            </p>
          </div>
          <button
            onClick={() => setPanelOpen(true)}
            className="text-xs font-mono text-[#c4a882] hover:text-[#d4b892] transition-colors border border-[#c4a882]/40 hover:border-[#c4a882] px-3 py-1 rounded-lg"
          >
            Configurar →
          </button>
        </div>
      )}

      {/* Open config button when not in custom mode */}
      {mode !== "custom" && (
        <button
          onClick={() => { setMode("custom"); setPanelOpen(true); setResult(null); }}
          className="text-left text-[10px] font-mono text-zinc-600 hover:text-[#c4a882] transition-colors"
        >
          + Configurar requisitos institucionales propios
        </button>
      )}

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
            accept={ACCEPTED_MIME}
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          <svg className="w-10 h-10 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
          <p className="text-sm text-zinc-500 text-center">
            <span className="font-medium text-zinc-300">Haz clic para seleccionar</span>{" "}
            o arrastra la foto aquí
          </p>
          <p className="text-xs text-zinc-600 font-mono">JPG, PNG, WEBP · máx. 5 MB</p>
        </label>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
            {preview && (
              <img src={preview} alt="Vista previa" className="w-full max-h-64 object-contain" />
            )}
            <div className="px-4 py-2.5 flex items-center justify-between border-t border-zinc-800">
              <span className="text-xs font-mono text-zinc-500 truncate max-w-[200px]">{file.name}</span>
              <button type="button" onClick={handleClear} className="text-xs font-mono text-zinc-600 hover:text-red-400 transition-colors">Quitar</button>
            </div>
          </div>

          <button
            onClick={handleValidate}
            disabled={loading}
            className="w-full h-11 rounded-xl bg-[#c4a882] text-[#050508] text-sm font-mono font-bold transition-colors hover:bg-[#d4b892] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.84 3 7.938l3-2.647z" />
                </svg>
                Analizando fotografía…
              </span>
            ) : "Validar fotografía"}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400 font-mono">
          {error}
        </div>
      )}

      {result && activeConfig && (
        <PhotoResult result={result} config={activeConfig} />
      )}

      <PhotoConfigPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onApply={(opts) => { setCustomOpts(opts); setResult(null); }}
        initialOptions={customOpts}
      />
    </div>
  );
}
