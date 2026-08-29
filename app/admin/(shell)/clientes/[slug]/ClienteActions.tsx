"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../_ui/Button";
import { InlineMessage } from "../../_ui/InlineMessage";

export default function ClienteActions({ clienteSlug }: { clienteSlug: string }) {
  const router = useRouter();
  const [descripcion, setDescripcion] = useState("");
  const [solicitadoPor, setSolicitadoPor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descripcion.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/cambios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteSlug,
          descripcion: descripcion.trim(),
          solicitadoPor: solicitadoPor.trim() || undefined,
        }),
      });
      if (res.ok) {
        setDescripcion("");
        setSolicitadoPor("");
        router.refresh();
      } else {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Error al registrar.");
      }
    } catch {
      setError("Error de red.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="Describe el cambio solicitado…"
        rows={2}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#c4a882] transition-colors resize-none placeholder:text-zinc-600"
      />
      <div className="flex gap-2">
        <input
          value={solicitadoPor}
          onChange={(e) => setSolicitadoPor(e.target.value)}
          placeholder="Solicitado por (opcional)"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#c4a882] transition-colors placeholder:text-zinc-600"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!descripcion.trim()}
          loading={loading}
          loadingText="Registrando…"
        >
          Registrar
        </Button>
      </div>
      {error && <InlineMessage tone="error" compact>{error}</InlineMessage>}
    </form>
  );
}
