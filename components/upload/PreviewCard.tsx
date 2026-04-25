"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface Props {
  file: File;
  onClear: () => void;
}

export default function PreviewCard({ file, onClear }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!url) return null;

  return (
    <div className="relative w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900">
      <div className="relative w-full h-56">
        <Image
          src={url}
          alt="Vista previa del documento"
          fill
          className="object-contain p-2"
          unoptimized
        />
      </div>
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
