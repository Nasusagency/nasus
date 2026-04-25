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
  docType?: string;
}

export default function ValidatorForm() {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>("ine");
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
      router.refresh();
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
            {status === "loading" ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
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
                Analizando…
              </span>
            ) : (
              "Validar documento"
            )}
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
          docType={result.docType}
        />
      )}
    </div>
  );
}
