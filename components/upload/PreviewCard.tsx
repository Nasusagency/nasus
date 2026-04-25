"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface Props {
  file: File;
  onClear: () => void;
}

export default function PreviewCard({ file, onClear }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const isPdf = file.type === "application/pdf";

  useEffect(() => {
    if (isPdf) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, isPdf]);

  return (
    <div className="relative w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900">
      {isPdf ? (
        <div className="flex items-center justify-center h-32 gap-3 text-zinc-400">
          <svg className="w-10 h-10 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="text-sm font-medium text-zinc-500">Documento PDF cargado</span>
        </div>
      ) : url ? (
        <div className="relative w-full h-56">
          <Image
            src={url}
            alt="Vista previa del documento"
            fill
            className="object-contain p-2"
            unoptimized
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-100 dark:border-zinc-800">
        <span className="text-xs text-zinc-500 truncate max-w-[80%]">
          {file.name}
        </span>
        <button
          onClick={onClear}
          type="button"
          className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
        >
          Quitar
        </button>
      </div>
    </div>
  );
}
