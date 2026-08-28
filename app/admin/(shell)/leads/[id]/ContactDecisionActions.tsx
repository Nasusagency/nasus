"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ContactDecisionActions({ contactId, proposalId, lifecycle }: { contactId: string; proposalId?: string; lifecycle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function convert() {
    if (!window.confirm("¿Confirmas convertir este contacto a cliente y marcar la oportunidad como ganada?")) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/admin/crm/contacts/${contactId}/convert`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposalId }),
    });
    setBusy(false);
    if (!response.ok) { setError("No se pudo convertir el contacto."); return; }
    router.refresh();
  }
  async function decide(decision: "lost" | "former_client" | "new_opportunity", prompt: string) {
    if (!window.confirm(prompt)) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/admin/crm/contacts/${contactId}/decision`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, requestId: crypto.randomUUID() }) });
    setBusy(false);
    if (!response.ok) { setError("No se pudo registrar la decisión."); return; }
    router.refresh();
  }
  return <div className="flex items-center gap-3">
    {lifecycle !== "client" && <button type="button" onClick={convert} disabled={busy} className="rounded-lg bg-[#8c6a3b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#76582f] disabled:opacity-50">
      {busy ? "Convirtiendo…" : "Convertir a cliente"}
    </button>}
    {lifecycle !== "client" && <button type="button" onClick={() => decide("lost", "¿Confirmas marcar esta oportunidad como perdida?")} disabled={busy} className="rounded-lg border border-red-300 px-3 py-2 text-xs text-red-700 disabled:opacity-50">Marcar perdida</button>}
    {lifecycle === "client" && <button type="button" onClick={() => decide("new_opportunity", "¿Abrir una nueva oportunidad comercial para este cliente?")} disabled={busy} className="rounded-lg border border-amber-300 px-3 py-2 text-xs text-amber-800 disabled:opacity-50">Nueva oportunidad</button>}
    {lifecycle === "client" && <button type="button" onClick={() => decide("former_client", "¿Confirmas cambiar el lifecycle a antiguo cliente?")} disabled={busy} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-700 disabled:opacity-50">Antiguo cliente</button>}
    {error && <span className="text-xs text-red-700">{error}</span>}
  </div>;
}
