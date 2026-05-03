"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CambioRequest, EstadoCambio } from "@/lib/admin/data";

const ESTADOS: EstadoCambio[] = ["Pendiente", "En revisión", "Aprobado", "Rechazado"];

const ESTADO_COLOR: Record<EstadoCambio, string> = {
  Pendiente: "text-yellow-400 bg-yellow-950/30 border-yellow-900/30",
  "En revisión": "text-blue-400 bg-blue-950/30 border-blue-900/30",
  Aprobado: "text-emerald-400 bg-emerald-950/30 border-emerald-900/30",
  Rechazado: "text-red-400 bg-red-950/30 border-red-900/30",
};

export default function CambiosClient({
  cambiosInit,
  clientes,
}: {
  cambiosInit: CambioRequest[];
  clientes: { slug: string; nombre: string }[];
}) {
  const router = useRouter();
  const [cambios, setCambios] = useState(cambiosInit);
  const [filterSlug, setFilterSlug] = useState("");

  // New cambio form
  const [clienteSlug, setClienteSlug] = useState(clientes[0]?.slug ?? "");
  const [descripcion, setDescripcion] = useState("");
  const [solicitadoPor, setSolicitadoPor] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const filtered = filterSlug
    ? cambios.filter((c) => c.clienteSlug === filterSlug)
    : cambios;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!descripcion.trim() || !clienteSlug) return;
    setCreating(true);
    setCreateError("");
    const res = await fetch("/api/admin/cambios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteSlug, descripcion, solicitadoPor: solicitadoPor || undefined }),
    });
    if (res.ok) {
      const nuevo = (await res.json()) as CambioRequest;
      setCambios((prev) => [nuevo, ...prev]);
      setDescripcion("");
      setSolicitadoPor("");
    } else {
      const d = (await res.json()) as { error?: string };
      setCreateError(d.error ?? "Error al crear.");
    }
    setCreating(false);
  }

  async function updateEstado(id: string, estado: EstadoCambio) {
    const res = await fetch(`/api/admin/cambios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    if (res.ok) {
      const updated = (await res.json()) as CambioRequest;
      setCambios((prev) => prev.map((c) => (c.id === id ? updated : c)));
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/cambios/${id}`, { method: "DELETE" });
    if (res.ok) setCambios((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      {/* New cambio form */}
      <form
        onSubmit={create}
        className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3"
      >
        <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
          Registrar cambio
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <select
            value={clienteSlug}
            onChange={(e) => setClienteSlug(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#c4a882]"
          >
            {clientes.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nombre}
              </option>
            ))}
          </select>
          <input
            value={solicitadoPor}
            onChange={(e) => setSolicitadoPor(e.target.value)}
            placeholder="Solicitado por (opcional)"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#c4a882] placeholder:text-zinc-600"
          />
        </div>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción del cambio…"
          rows={2}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#c4a882] resize-none placeholder:text-zinc-600"
        />
        {createError && <p className="text-xs text-red-400">{createError}</p>}
        <button
          type="submit"
          disabled={creating || !descripcion.trim() || !clienteSlug}
          className="self-start px-4 py-2 text-xs font-mono border border-[#c4a882]/40 text-[#c4a882] rounded-lg hover:bg-[#c4a882]/10 disabled:opacity-40 transition-colors"
        >
          {creating ? "Registrando…" : "Registrar cambio"}
        </button>
      </form>

      {/* Filter */}
      {clientes.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterSlug("")}
            className={`px-3 py-1 text-xs font-mono rounded-lg border transition-colors ${
              !filterSlug
                ? "border-[#c4a882]/30 text-[#c4a882] bg-[#c4a882]/10"
                : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Todos
          </button>
          {clientes.map((c) => (
            <button
              key={c.slug}
              onClick={() => setFilterSlug(c.slug)}
              className={`px-3 py-1 text-xs font-mono rounded-lg border transition-colors ${
                filterSlug === c.slug
                  ? "border-[#c4a882]/30 text-[#c4a882] bg-[#c4a882]/10"
                  : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-600">Sin cambios registrados.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 flex items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 leading-snug">{c.descripcion}</p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-xs text-zinc-500">{c.clienteSlug}</span>
                  {c.solicitadoPor && (
                    <>
                      <span className="text-zinc-700">·</span>
                      <span className="text-xs text-zinc-500">{c.solicitadoPor}</span>
                    </>
                  )}
                  <span className="text-zinc-700">·</span>
                  <span className="text-xs text-zinc-600">
                    {new Date(c.createdAt).toLocaleDateString("es-MX")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-none">
                <select
                  value={c.estado}
                  onChange={(e) => updateEstado(c.id, e.target.value as EstadoCambio)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border bg-transparent outline-none cursor-pointer ${ESTADO_COLOR[c.estado]}`}
                >
                  {ESTADOS.map((s) => (
                    <option key={s} value={s} className="bg-zinc-900 text-zinc-100">
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => remove(c.id)}
                  className="text-zinc-700 hover:text-red-400 transition-colors text-sm"
                  title="Eliminar"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
