"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GoogleAdsSyncButton() {
  const router = useRouter(); const [status, setStatus] = useState(""); const [loading, setLoading] = useState(false);
  async function sync() {
    setLoading(true); setStatus("");
    try {
      const response = await fetch("/api/internal/google-ads/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ days: 3 }) });
      const body = await response.json();
      setStatus(response.ok ? `Google Ads sincronizado · ${body.rows_upserted} filas` : body.error || "No se pudo sincronizar");
      if (response.ok) router.refresh();
    } catch { setStatus("No se pudo sincronizar"); } finally { setLoading(false); }
  }
  return <div className="flex items-center justify-end gap-3"><span className="text-[10px] text-zinc-500">{status}</span><button type="button" disabled={loading} onClick={() => void sync()} className="text-[10px] border border-zinc-700 text-zinc-400 rounded-lg px-3 py-2 hover:text-[#c4a882] hover:border-[#c4a882]/50 disabled:opacity-50">{loading ? "Sincronizando…" : "Sincronizar Google Ads"}</button></div>;
}
