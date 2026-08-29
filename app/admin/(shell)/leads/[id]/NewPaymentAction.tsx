"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../../_ui/Button";
import { InlineMessage } from "../../_ui/InlineMessage";

export default function NewPaymentAction({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ error?: string; publicUrl?: string } | null>(null);

  async function create() {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !description.trim()) { setResult({ error: "Monto y descripción son requeridos." }); return; }
    setBusy(true); setResult(null);
    const response = await fetch("/api/admin/pagos", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contactId, amount: parsedAmount, currency: "MXN", description: description.trim() }),
    });
    const data = await response.json() as { ok?: boolean; error?: string; publicUrl?: string };
    setBusy(false);
    if (!response.ok || !data.ok) { setResult({ error: data.error || "No se pudo crear el pago." }); return; }
    setResult({ publicUrl: data.publicUrl });
    setAmount(""); setDescription("");
    router.refresh();
  }

  if (!open) return <Button variant="primary" size="sm" onClick={() => setOpen(true)}>+ Nuevo pago</Button>;
  return <div className="rounded-lg border border-zinc-300 bg-white p-3 text-xs">
    <div className="flex flex-wrap items-center gap-2">
      <input type="number" min="0" step="0.01" placeholder="Monto MXN" value={amount} onChange={e => setAmount(e.target.value)} className="w-32 rounded border px-2 py-1.5" />
      <input type="text" placeholder="Descripción (ej. Anticipo 50%)" value={description} onChange={e => setDescription(e.target.value)} className="min-w-48 flex-1 rounded border px-2 py-1.5" />
      <Button variant="primary" size="sm" onClick={create} loading={busy} loadingText="Creando…">Crear link</Button>
      <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setResult(null); }}>Cancelar</Button>
    </div>
    {result?.error && <InlineMessage tone="error" compact>{result.error}</InlineMessage>}
    {result?.publicUrl && <InlineMessage tone="success" compact><span className="break-all">Link: {result.publicUrl}</span></InlineMessage>}
  </div>;
}
