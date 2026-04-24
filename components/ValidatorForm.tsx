"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import DropZone from "@/components/upload/DropZone";
import PreviewCard from "@/components/upload/PreviewCard";
import ValidationResult from "@/components/results/ValidationResult";
import type { DocumentType } from "@/lib/anthropic/prompts";

type Status = "idle" | "loading" | "done" | "error";

interface Result {
  valid: boolean;
  issues: string[];
  fields: Record<string, unknown>;
}

export default function ValidatorForm() {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>("dni");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const router = useRouter();

  const handleFile = useCallback((f: File, type: DocumentType) => {
    setFile(f);
    setDocType(type);
    setResult(null);
    setApiError(null);
    setStatus("idle");
  }, []);

  const handleClear = useCallback(() => {
    setFile(null);
    setResult(null);
    setApiError(null);
    setStatus("idle");
  }, []);

  const handleValidate = useCallback(async () => {
    if (!file) return;
    setStatus("loading");
    setResult(null);
    setApiError(null);

    try {
      const form = new FormData();
      form.append("document", file);
      form.append("type", docType);

      const res = await fetch("/api/validate", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setApiError(data?.error ?? "Error desconocido del servidor");
        setStatus("error");
        return;
      }

      setResult(data as Result);
      setStatus("done");
      router.refresh(); // actualiza el historial del servidor
    } catch {
      setApiError("No se pudo conectar con el servidor. Verifica tu conexión.");
      setStatus("error");
    }
  }, [file, docType, router]);

  return (
    <div className="flex flex-col gap-4">
      {!file ? (
        <DropZone onFile={handleFile} disabled={status === "loading"} />
      ) : (
        <div className="flex flex-col gap-4">
          <PreviewCard file={file} onClear={handleClear} />
          <button
            onClick={handleValidate}
            disabled={status === "loading"}
            className="w-full h-11 rounded-xl bg-zinc-900 text-white text-sm font-medium transition-colors hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {status === "loading" ? "Analizando…" : "Validar documento"}
          </button>
        </div>
      )}

      {status === "error" && apiError && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {apiError}
        </div>
      )}

      {status === "done" && result && (
        <ValidationResult
          valid={result.valid}
          issues={result.issues}
          fields={result.fields}
        />
      )}
    </div>
  );
}
