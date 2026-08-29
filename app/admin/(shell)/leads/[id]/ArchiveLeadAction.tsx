"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../../_ui/Button";
import { InlineMessage } from "../../_ui/InlineMessage";

export default function ArchiveLeadAction({ contactId, relations }: { contactId: string; relations: { quotes: number; proposals: number; payments: number } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function archive() {
    const hasRelations = relations.quotes > 0 || relations.proposals > 0 || relations.payments > 0;
    const warning = hasRelations
      ? `Este contacto tiene ${relations.quotes} cotización(es), ${relations.proposals} propuesta(s) y ${relations.payments} pago(s) registrados. No se borran ni se pierden: se archiva el contacto y deja de aparecer en el listado normal, pero conserva todo su historial. ¿Confirmas archivar?`
      : "¿Confirmas archivar este contacto? Deja de aparecer en el listado normal pero conserva todo su historial y puede restaurarse después.";
    if (!window.confirm(warning)) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/admin/leads/${contactId}/archive`, { method: "POST" });
    setBusy(false);
    if (!response.ok) { setError("No se pudo archivar el contacto."); return; }
    router.refresh();
  }

  return <div className="flex flex-col items-end gap-1">
    <Button variant="destructive" size="sm" onClick={archive} loading={busy} loadingText="Archivando…">Archivar contacto</Button>
    {error && <InlineMessage tone="error" compact>{error}</InlineMessage>}
  </div>;
}
