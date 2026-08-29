"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../../_ui/Button";
import { InlineMessage } from "../../_ui/InlineMessage";

type Action = null | "convert" | "lost" | "former_client" | "new_opportunity";

export default function ContactDecisionActions({ contactId, proposalId, lifecycle }: { contactId: string; proposalId?: string; lifecycle: string }) {
  const router = useRouter();
  const [action, setAction] = useState<Action>(null);
  const busy = action !== null;
  const [error, setError] = useState("");
  async function convert() {
    if (!window.confirm("¿Confirmas convertir este contacto a cliente y marcar la oportunidad como ganada?")) return;
    setAction("convert"); setError("");
    const response = await fetch(`/api/admin/crm/contacts/${contactId}/convert`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposalId }),
    });
    setAction(null);
    if (!response.ok) { setError("No se pudo convertir el contacto."); return; }
    router.refresh();
  }
  async function decide(decision: "lost" | "former_client" | "new_opportunity", prompt: string) {
    if (!window.confirm(prompt)) return;
    setAction(decision); setError("");
    const response = await fetch(`/api/admin/crm/contacts/${contactId}/decision`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, requestId: crypto.randomUUID() }) });
    setAction(null);
    if (!response.ok) { setError("No se pudo registrar la decisión."); return; }
    router.refresh();
  }
  return <div className="flex flex-wrap items-center gap-3">
    {lifecycle !== "client" && <Button variant="primary" disabled={busy} loading={action === "convert"} loadingText="Convirtiendo…" onClick={convert}>Convertir a cliente</Button>}
    {lifecycle !== "client" && <Button variant="destructive" disabled={busy} loading={action === "lost"} loadingText="Marcando…" onClick={() => decide("lost", "¿Confirmas marcar esta oportunidad como perdida?")}>Marcar perdida</Button>}
    {lifecycle === "client" && <Button variant="secondary" disabled={busy} loading={action === "new_opportunity"} loadingText="Abriendo…" onClick={() => decide("new_opportunity", "¿Abrir una nueva oportunidad comercial para este cliente?")}>Nueva oportunidad</Button>}
    {lifecycle === "client" && <Button variant="secondary" disabled={busy} loading={action === "former_client"} loadingText="Actualizando…" onClick={() => decide("former_client", "¿Confirmas cambiar el lifecycle a antiguo cliente?")}>Antiguo cliente</Button>}
    {error && <InlineMessage tone="error" compact>{error}</InlineMessage>}
  </div>;
}
