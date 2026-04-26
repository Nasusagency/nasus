"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  fields: Record<string, unknown>;
  onRevalidate?: (overrides: Record<string, string>) => void;
  revalidating?: boolean;
  humanOverriddenFields?: string[];
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

export const LABELS: Record<string, string> = {
  nombres: "Nombres",
  apellidos: "Apellidos",
  apellido_paterno: "Apellido paterno",
  apellido_materno: "Apellido materno",
  fecha_nacimiento: "Fecha de nacimiento",
  fecha_vencimiento: "Fecha de vencimiento",
  pais: "País",
  nacionalidad: "Nacionalidad",
  clave_elector: "Clave de elector",
  seccion: "Sección electoral",
  curp: "CURP",
  sexo: "Sexo",
  entidad_nacimiento: "Entidad de nacimiento",
  rfc: "RFC",
  nombre: "Nombre / Razón social",
  tipo_persona: "Tipo de persona",
  fecha: "Fecha",
  numero_pasaporte: "N.º de pasaporte",
  numero_documento: "N.º documento",
  tipo_acta: "Tipo de acta",
  numero_acta: "N.º acta",
  fecha_emision: "Fecha de emisión",
  entidad_emisora: "Entidad emisora",
  nombres_involucrados: "Personas involucradas",
};

export default function FieldsTable({
  fields,
  onRevalidate,
  revalidating,
  humanOverriddenFields,
}: Props) {
  const rows = Object.entries(fields);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingKey && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingKey]);

  if (rows.length === 0) return null;

  function startEdit(key: string) {
    const current = overrides[key] ?? formatValue(fields[key]);
    setEditingKey(key);
    setEditValue(current === "—" ? "" : current);
  }

  function commitEdit() {
    if (!editingKey) return;
    const original = formatValue(fields[editingKey]);
    const newVal = editValue.trim();
    setOverrides((prev) => {
      const next = { ...prev };
      if (!newVal || newVal === original) {
        delete next[editingKey!];
      } else {
        next[editingKey!] = newVal;
      }
      return next;
    });
    setEditingKey(null);
  }

  function cancelEdit() {
    setEditingKey(null);
  }

  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="w-full overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([key, value], i) => {
              const isEditing = editingKey === key;
              const isLocalOverride = key in overrides;
              const isHumanOverride = humanOverriddenFields?.includes(key) ?? false;
              const isOverridden = isLocalOverride || isHumanOverride;
              const displayValue = overrides[key] ?? formatValue(value);

              return (
                <tr
                  key={key}
                  className={[
                    "group",
                    i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-900/50",
                    isOverridden ? "ring-1 ring-inset ring-[#c4a882]/30" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-500 w-48 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      {LABELS[key] ?? key}
                      {isOverridden && (
                        <span className="text-[#c4a882]/70 text-[9px] leading-none select-none">
                          ✎
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sm">
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="w-full bg-zinc-800 border border-[#c4a882] rounded px-2 py-0.5 text-zinc-100 font-mono text-sm outline-none focus:ring-1 focus:ring-[#c4a882]/50"
                      />
                    ) : (
                      <span className="flex items-center justify-between gap-2">
                        <span className={isOverridden ? "text-[#c4a882]" : "text-zinc-200"}>
                          {displayValue}
                        </span>
                        {onRevalidate && (
                          <button
                            type="button"
                            onClick={() => startEdit(key)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 text-zinc-500 hover:text-[#c4a882]"
                            title={`Editar ${LABELS[key] ?? key}`}
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                              />
                            </svg>
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {onRevalidate && hasOverrides && (
        <button
          type="button"
          onClick={() => onRevalidate(overrides)}
          disabled={revalidating}
          className="w-full h-10 rounded-xl border border-[#c4a882] bg-[#c4a882]/10 text-[#c4a882] text-sm font-mono font-bold transition-colors hover:bg-[#c4a882]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {revalidating ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.84 3 7.938l3-2.647z"
                />
              </svg>
              Re-validando…
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              Re-validar con cambios
            </>
          )}
        </button>
      )}
    </div>
  );
}
