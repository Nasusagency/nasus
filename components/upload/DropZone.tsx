"use client";

import { useCallback, useState } from "react";
import type { DocumentType } from "@/lib/anthropic/prompts";

interface Props {
  onFile: (file: File, type: DocumentType) => void;
  disabled?: boolean;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  ine: "INE / IFE",
  curp: "CURP",
  rfc: "RFC",
  pasaporte: "Pasaporte",
  acta: "Acta oficial",
  dni: "DNI / Cédula",
};

const MX_TYPES: DocumentType[] = ["ine", "curp", "rfc", "pasaporte", "acta"];

export default function DropZone({ onFile, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const [docType, setDocType] = useState<DocumentType>("ine");
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!ACCEPTED.includes(file.type)) {
        setError("Solo se admiten imágenes JPG, PNG o WEBP.");
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

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Selector de tipo de documento */}
      <div className="flex flex-wrap gap-2">
        {MX_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setDocType(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              docType === t
                ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white"
                : "border-zinc-300 text-zinc-600 hover:border-zinc-500 dark:border-zinc-600 dark:text-zinc-400"
            }`}
          >
            {DOC_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Zona de arrastre */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-colors
          ${dragging
            ? "border-zinc-900 bg-zinc-100 dark:border-white dark:bg-zinc-800"
            : "border-zinc-300 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"}
          ${disabled ? "pointer-events-none opacity-50" : ""}
        `}
      >
        <input
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={onInputChange}
          disabled={disabled}
        />
        <svg
          className="w-10 h-10 text-zinc-400"
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
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
          <span className="font-medium text-zinc-700 dark:text-zinc-200">
            Haz clic para seleccionar
          </span>{" "}
          o arrastra la imagen aquí
        </p>
        <p className="text-xs text-zinc-400">JPG, PNG, WEBP · máx. 5 MB</p>
      </label>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
