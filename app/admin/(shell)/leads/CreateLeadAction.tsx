"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../_ui/Button";
import { InlineMessage } from "../_ui/InlineMessage";

const STAGES = [
  { value: "exploring", label: "Exploring" },
  { value: "opportunity", label: "Opportunity" },
  { value: "qualified", label: "Qualified" },
] as const;

const ERROR_LABEL: Record<string, string> = {
  numero_requerido: "El teléfono es obligatorio.",
  invalid_phone: "El teléfono debe tener entre 10 y 15 dígitos (con código de país, ej. 523312345678).",
  duplicate: "Ya existe un lead con ese número.",
  duplicate_archived: "Ya existe un lead con ese número, pero está archivado. Restáuralo desde \"Ver archivados\" en vez de crear uno nuevo.",
  database_unavailable: "El servicio de base de datos no está disponible.",
};

export default function CreateLeadAction() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [numero, setNumero] = useState("");
  const [nombreContacto, setNombreContacto] = useState("");
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [necesidad, setNecesidad] = useState("");
  const [stage, setStage] = useState<(typeof STAGES)[number]["value"]>("exploring");

  function reset() {
    setNumero(""); setNombreContacto(""); setNombreEmpresa(""); setNecesidad(""); setStage("exploring"); setError("");
  }

  async function create() {
    if (!numero.trim()) { setError("El teléfono es obligatorio."); return; }
    setBusy(true); setError("");
    const response = await fetch("/api/admin/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ numero: numero.trim(), nombreContacto: nombreContacto.trim() || undefined, nombreEmpresa: nombreEmpresa.trim() || undefined, necesidad: necesidad.trim() || undefined, stage }),
    });
    const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
    setBusy(false);
    if (!response.ok || !data.ok) { setError(ERROR_LABEL[data.error ?? ""] ?? "No se pudo crear el lead."); return; }
    reset();
    setOpen(false);
    router.refresh();
  }

  if (!open) return <Button variant="primary" size="sm" onClick={() => setOpen(true)}>+ Crear lead</Button>;

  return <div className="w-full rounded-xl border border-zinc-300 bg-white p-4 text-xs mb-4">
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="flex flex-col gap-1"><span className="text-zinc-600">Teléfono *</span><input type="text" placeholder="523312345678" value={numero} onChange={e => setNumero(e.target.value)} className="rounded border border-zinc-300 px-2 py-1.5" /></label>
      <label className="flex flex-col gap-1"><span className="text-zinc-600">Stage inicial</span><select value={stage} onChange={e => setStage(e.target.value as typeof stage)} className="rounded border border-zinc-300 px-2 py-1.5">{STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
      <label className="flex flex-col gap-1"><span className="text-zinc-600">Nombre de contacto</span><input type="text" value={nombreContacto} onChange={e => setNombreContacto(e.target.value)} className="rounded border border-zinc-300 px-2 py-1.5" /></label>
      <label className="flex flex-col gap-1"><span className="text-zinc-600">Empresa</span><input type="text" value={nombreEmpresa} onChange={e => setNombreEmpresa(e.target.value)} className="rounded border border-zinc-300 px-2 py-1.5" /></label>
      <label className="flex flex-col gap-1 sm:col-span-2"><span className="text-zinc-600">Necesidad / contexto</span><textarea value={necesidad} onChange={e => setNecesidad(e.target.value)} rows={2} className="rounded border border-zinc-300 px-2 py-1.5" /></label>
    </div>
    <p className="mt-2 text-[10px] text-zinc-500">Se registra con source “admin” — igual que el resto del CRM distingue el canal real de cada evento.</p>
    <div className="flex items-center gap-2 mt-3">
      <Button variant="primary" size="sm" onClick={create} loading={busy} loadingText="Creando…">Crear lead</Button>
      <Button variant="ghost" size="sm" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
    </div>
    {error && <InlineMessage tone="error" compact>{error}</InlineMessage>}
  </div>;
}
