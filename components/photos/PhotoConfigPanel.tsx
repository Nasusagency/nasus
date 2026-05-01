"use client";

import { useState, useEffect } from "react";
import type { PhotoPanelOptions } from "@/lib/photos/config/custom.photo";
import { EDUCATIONAL_DEFAULT } from "@/lib/photos/config/custom.photo";

const STORAGE_KEY = "nasus_photo_presets";

interface Preset {
  name: string;
  options: PhotoPanelOptions;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (opts: PhotoPanelOptions) => void;
  initialOptions?: PhotoPanelOptions;
}

type BoolKey = "grayscale" | "faceFrontal" | "foreheadVisible" | "noGlasses" | "noHeadAccessories";

const BOOL_OPTIONS: [BoolKey, string][] = [
  ["grayscale", "Escala de grises"],
  ["faceFrontal", "Rostro de frente (requerido)"],
  ["foreheadVisible", "Frente descubierta"],
  ["noGlasses", "Sin lentes"],
  ["noHeadAccessories", "Sin accesorios en cabeza"],
];

export default function PhotoConfigPanel({ open, onClose, onApply, initialOptions }: Props) {
  const [opts, setOpts] = useState<PhotoPanelOptions>(initialOptions ?? EDUCATIONAL_DEFAULT);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");

  useEffect(() => {
    if (!open) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setPresets(JSON.parse(stored) as Preset[]);
    } catch { /* ignore */ }
  }, [open]);

  function set<K extends keyof PhotoPanelOptions>(key: K, value: PhotoPanelOptions[K]) {
    setOpts((prev) => ({ ...prev, [key]: value }));
  }

  function toggleBool(key: BoolKey) {
    setOpts((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    const updated = [...presets.filter((p) => p.name !== name), { name, options: opts }];
    setPresets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setPresetName("");
  }

  function deletePreset(name: string) {
    const updated = presets.filter((p) => p.name !== name);
    setPresets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  if (!open) return null;

  const toggle = (on: boolean) => (
    <div className={`relative h-5 w-9 rounded-full transition-colors duration-150 ${on ? "bg-[#c4a882]" : "bg-zinc-700"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-150 ${on ? "left-[18px]" : "left-0.5"}`} />
    </div>
  );

  const segmented = <T extends string>(
    values: { value: T; label: string }[],
    current: T,
    onChange: (v: T) => void
  ) => (
    <div className="flex gap-2">
      {values.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
            current === value
              ? "bg-[#c4a882] text-[#050508] border-[#c4a882] font-bold"
              : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="w-full max-w-sm bg-[#08080e] border-l border-zinc-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold text-sm">Configuración institucional</h2>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5 tracking-widest uppercase">Requisitos de fotografía</p>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors text-xl leading-none">×</button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Saved presets */}
          {presets.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Presets guardados</p>
              <div className="space-y-1.5">
                {presets.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2">
                    <span className="text-xs text-zinc-300 font-mono flex-1 truncate">{p.name}</span>
                    <button onClick={() => setOpts(p.options)} className="text-[10px] text-[#c4a882] hover:text-[#d4b892] font-mono transition-colors">Cargar</button>
                    <button onClick={() => deletePreset(p.name)} className="text-[10px] text-zinc-600 hover:text-red-400 font-mono transition-colors">✕</button>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-zinc-800/60" />
            </div>
          )}

          {/* Background */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Fondo</label>
            {segmented(
              [{ value: "white", label: "Blanco" }, { value: "gray", label: "Gris" }, { value: "free", label: "Libre" }],
              opts.background,
              (v) => set("background", v)
            )}
          </div>

          {/* Boolean toggles */}
          <div className="space-y-3">
            {BOOL_OPTIONS.map(([key, label]) => (
              <button key={key} onClick={() => toggleBool(key)} className="w-full flex items-center justify-between gap-3 text-left">
                <span className="text-sm text-zinc-300">{label}</span>
                {toggle(opts[key] as boolean)}
              </button>
            ))}
          </div>

          {/* Expression */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Expresión</label>
            {segmented(
              [{ value: "neutral", label: "Neutral" }, { value: "free", label: "Libre" }],
              opts.expression,
              (v) => set("expression", v)
            )}
          </div>

          {/* Clothing */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Ropa</label>
            {segmented(
              [{ value: "no_uniform", label: "Sin uniforme" }, { value: "no_collar", label: "Sin cuello" }, { value: "free", label: "Libre" }],
              opts.clothing,
              (v) => set("clothing", v)
            )}
          </div>

          {/* Dimensions */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Dimensiones</label>
            <input
              type="text"
              value={opts.dimensions}
              onChange={(e) => set("dimensions", e.target.value)}
              placeholder="ej. 4×4 cm, 35×45 mm"
              className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#c4a882] transition-colors placeholder:text-zinc-600"
            />
          </div>

          {/* Tolerance */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Tolerancia</label>
            {segmented(
              [{ value: "strict", label: "Estricta" }, { value: "medium", label: "Media" }, { value: "flexible", label: "Flexible" }],
              opts.tolerance,
              (v) => set("tolerance", v)
            )}
          </div>

          {/* Save preset */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Guardar como preset</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && savePreset()}
                placeholder="ej. Inscripción 2026"
                className="flex-1 bg-zinc-900 border border-zinc-800 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#c4a882] transition-colors placeholder:text-zinc-600"
              />
              <button
                onClick={savePreset}
                disabled={!presetName.trim()}
                className="px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:border-[#c4a882] hover:text-[#c4a882] text-xs font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-xs font-mono hover:border-zinc-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => { onApply(opts); onClose(); }}
            className="flex-1 py-2.5 rounded-xl bg-[#c4a882] text-[#050508] text-xs font-mono font-bold hover:bg-[#d4b892] transition-colors"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
