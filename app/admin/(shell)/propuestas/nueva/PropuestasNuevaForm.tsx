"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "../../_ui/Button";
import { Chip } from "../../_ui/Chip";
import { InlineMessage } from "../../_ui/InlineMessage";

interface ClienteOption {
  slug: string;
  nombre: string;
}

export default function PropuestasNuevaForm({
  clientes,
}: {
  clientes: ClienteOption[];
}) {
  const searchParams = useSearchParams();
  const defaultCliente = searchParams.get("cliente") ?? "";

  const [mode, setMode] = useState<"libre" | "cliente">(
    defaultCliente ? "cliente" : "libre"
  );
  const [clienteSlug, setClienteSlug] = useState(defaultCliente);
  const [contexto, setContexto] = useState("");
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedSlugFinal, setSavedSlugFinal] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [saveSlug, setSaveSlug] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current && generating) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, generating]);

  const generate = useCallback(async () => {
    setOutput("");
    setSaved(false);
    setSaveError("");
    setSavedSlugFinal("");
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/propuestas/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contexto,
          contactId: mode === "cliente" ? clienteSlug : undefined,
        }),
      });
      if (!res.ok || !res.body) {
        const d = (await res.json()) as { error?: string };
        setOutput(`Error: ${d.error ?? "No se pudo generar."}`);
        return;
      }
      const generatedSlug = res.headers.get("X-Proposal-Slug");
      if (generatedSlug) setSaveSlug(generatedSlug);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setOutput((prev) => prev + dec.decode(value));
      }
    } catch {
      setOutput("Error de red. Intenta de nuevo.");
    } finally {
      setGenerating(false);
    }
  }, [contexto, mode, clienteSlug]);

  async function save() {
    const finalSlug = saveSlug.trim() || `prop-${Date.now()}`;
    // Find first non-empty line for auto-title
    const firstLine = output
      .split("\n")
      .find((l) => l.trim().length > 0)
      ?.replace(/^#+\s*/, "")
      .trim();
    const t = titulo.trim() || firstLine || "Propuesta";
    setSaveError("");
    setSaving(true);
    const res = await fetch("/api/admin/propuestas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: finalSlug,
        titulo: t,
        contenido: output,
        contactId: mode === "cliente" ? clienteSlug : undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setSavedSlugFinal(finalSlug);
    } else {
      const d = (await res.json()) as { error?: string };
      setSaveError(d.error ?? "Error al guardar.");
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-mono font-bold text-zinc-100">Nueva propuesta</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Generada por Claude Sonnet</p>
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 mb-5">
        {/* Mode toggle */}
        <div className="flex gap-2 mb-4" role="group" aria-label="Origen del contexto">
          {(["libre", "cliente"] as const).map((m) => (
            <Chip key={m} active={mode === m} tone="brand" onClick={() => setMode(m)}>
              {m === "libre" ? "Contexto libre" : "Desde CRM"}
            </Chip>
          ))}
        </div>

        {mode === "cliente" && (
          <div className="mb-3">
            <label className="text-xs text-zinc-400 font-mono block mb-1.5">
              Contacto CRM
            </label>
            <select
              value={clienteSlug}
              onChange={(e) => setClienteSlug(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#c4a882] transition-colors"
            >
              <option value="">Selecciona un cliente…</option>
              {clientes.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs text-zinc-400 font-mono block mb-1.5">
            {mode === "libre" ? "Contexto" : "Contexto adicional (opcional)"}
          </label>
          <textarea
            value={contexto}
            onChange={(e) => setContexto(e.target.value)}
            rows={4}
            placeholder={
              mode === "libre"
                ? "Describe el cliente, su problema, lo que necesita, presupuesto, plazos…"
                : "Detalles adicionales no capturados en el CRM…"
            }
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#c4a882] transition-colors resize-none placeholder:text-zinc-600"
          />
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="mt-4"
          onClick={generate}
          disabled={
            (mode === "cliente" && !clienteSlug) ||
            (mode === "libre" && !contexto.trim())
          }
          loading={generating}
          loadingText="Generando…"
        >
          Generar propuesta
        </Button>
      </div>

      {output && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
            <span className="text-xs font-mono text-zinc-400">Propuesta generada</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigator.clipboard.writeText(output)}
            >
              Copiar
            </Button>
          </div>
          <div
            ref={outputRef}
            className="px-5 py-4 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono max-h-[60vh] overflow-y-auto"
          >
            {output}
            {generating && (
              <span className="inline-block w-1.5 h-4 bg-[#c4a882] animate-pulse ml-0.5 align-middle" />
            )}
          </div>

          {!generating && (
            <div className="px-5 py-4 border-t border-zinc-800 flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Título (auto-detectado si se deja vacío)"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#c4a882] transition-colors placeholder:text-zinc-600"
                />
                <input
                  value={saveSlug}
                  onChange={(e) => setSaveSlug(e.target.value)}
                  placeholder="URL slug (ej: uag-2026)"
                  className="w-40 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#c4a882] transition-colors placeholder:text-zinc-600"
                />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  variant="primary"
                  onClick={save}
                  disabled={saved}
                  loading={saving}
                  loadingText="Guardando…"
                >
                  {saved ? "✓ Guardada" : "Guardar propuesta"}
                </Button>
                {saved && savedSlugFinal && (
                  <a
                    href={`/propuesta/${savedSlugFinal}`}
                    target="_blank"
                    className="text-xs font-mono text-[#00f2ff]/70 hover:text-[#00f2ff] transition-colors"
                  >
                    Ver página pública ↗
                  </a>
                )}
                {saveError && <InlineMessage tone="error" compact>{saveError}</InlineMessage>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
