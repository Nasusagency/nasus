"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./_ui/Button";
import { InlineMessage } from "./_ui/InlineMessage";

export default function GoogleAdsSyncButton() {
  const router = useRouter(); const [status, setStatus] = useState<{ text: string; tone: "success" | "error" } | null>(null); const [loading, setLoading] = useState(false);
  async function sync() {
    setLoading(true); setStatus(null);
    try {
      const response = await fetch("/api/internal/google-ads/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ days: 3 }) });
      const body = await response.json();
      setStatus(response.ok ? { text: `Google Ads sincronizado · ${body.rows_upserted} filas`, tone: "success" } : { text: body.error || "No se pudo sincronizar", tone: "error" });
      router.refresh();
    } catch { setStatus({ text: "No se pudo sincronizar", tone: "error" }); } finally { setLoading(false); }
  }
  return <div className="flex items-center justify-end gap-3">{status && <InlineMessage tone={status.tone} compact>{status.text}</InlineMessage>}<Button variant="secondary" size="sm" loading={loading} loadingText="Sincronizando…" onClick={() => void sync()}>Sincronizar Google Ads</Button></div>;
}
