"use client";

import { useCallback, useState } from "react";
import type { DocumentType } from "@/lib/anthropic/prompts";
import { EDUCATION_DOC_TYPES } from "@/lib/documents/types";

interface Props {
  onFile: (file: File, type: DocumentType) => void;
  disabled?: boolean;
}

const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_ALL = [...ACCEPTED_IMAGES, "application/pdf"];
const ACCEPT_ATTR = [...ACCEPTED_IMAGES, ".pdf", "application/pdf"].join(",");

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  ine: "INE / IFE",
  curp: "CURP",
  rfc: "RFC",
  pasaporte: "Pasaporte",
  acta: "Acta oficial",
  dni: "DNI / Cédula",
  titulo_profesional: "Título / Cédula Prof.",
  certificado_bachillerato: "Cert. Bachillerato",
};

// CURP y RFC suelen venir como PDF oficial
const PDF_COMMON: DocumentType[] = ["curp", "rfc", "acta", "titulo_profesional", "certificado_bachillerato"];
const MX_TYPES: DocumentType[] = ["ine", "curp", "rfc", "pasaporte", "acta"];
const EDU_TYPES: DocumentType[] = ["titulo_profesional", "certificado_bachillerato"];

export default function DropZone({ onFile, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const [docType, setDocType] = useState<DocumentType>("ine");
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!ACCEPTED_ALL.includes(file.type)) {
        setError("Solo se admiten imágenes JPG, PNG, WEBP o archivos PDF.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("El archivo no puede superar 5 MB.");
        return;
      }
      onFile(file, docType);
    },
    [docType, onFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  const acceptsPdf = PDF_COMMON.includes(docType);

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {MX_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setDocType(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-mono border transition-colors ${
                docType === t
                  ? "bg-[#c4a882] text-[#050508] border-[#c4a882] font-bold"
                  : "border-zinc-700 text-zinc-500 hover:border-[#c4a882] hover:text-[#c4a882]"
              }`}
            >
              {DOC_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <div>
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-1.5">Documentos Educativos</p>
          <div className="flex flex-wrap gap-2">
            {EDU_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDocType(t)}
                className={`px-3 py-1.5 rounded-full text-sm font-mono border transition-colors ${
                  docType === t
                    ? "bg-amber-500 text-[#050508] border-amber-500 font-bold"
                    : "border-zinc-700 text-zinc-500 hover:border-amber-500 hover:text-amber-400"
                }`}
              >
                {DOC_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {EDUCATION_DOC_TYPES.has(docType) && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-xs text-amber-400 font-mono">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>Los documentos educativos se validan visualmente. No se realiza verificación contra bases de datos oficiales.</span>
        </div>
      )}

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-colors
          ${
            dragging
              ? "border-[#c4a882] bg-zinc-900"
              : "border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-zinc-700"
          }
          ${disabled ? "pointer-events-none opacity-50" : ""}
        `}
      >
        <input
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          onChange={onInputChange}
          disabled={disabled}
        />
        <svg
          className="w-10 h-10 text-zinc-600"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="text-sm text-zinc-500 text-center">
          <span className="font-medium text-zinc-300">Haz clic para seleccionar</span>{" "}
          o arrastra el archivo aquí
        </p>
        <p className="text-xs text-zinc-600 font-mono">
          JPG, PNG, WEBP{acceptsPdf ? ", PDF" : ""} · máx. 5 MB
          {acceptsPdf && (
            <span className="ml-1 text-[#c4a882]/70">
              · PDF recomendado para {DOC_TYPE_LABELS[docType]}
            </span>
          )}
        </p>
      </label>

      {error && (
        <p className="text-sm text-red-400 font-mono">{error}</p>
      )}
    </div>
  );
}
