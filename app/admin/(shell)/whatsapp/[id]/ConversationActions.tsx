"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ConversationMode } from "@/lib/whatsapp/conversation-policy";

export default function ConversationActions({ conversationId, initialMode }: { conversationId: string; initialMode: ConversationMode }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function changeMode(next: ConversationMode, status?: "open" | "resolved") {
    setBusy(true); setError("");
    const response = await fetch(`/api/admin/whatsapp/conversations/${conversationId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: next, status }) });
    if (response.ok) { setMode(next); router.refresh(); } else setError("No se pudo actualizar la conversación.");
    setBusy(false);
  }
  async function send(event: React.FormEvent) {
    event.preventDefault(); if (!text.trim() || busy) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/admin/whatsapp/conversations/${conversationId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: text.trim(), requestId: crypto.randomUUID() }) });
    if (response.ok) { setText(""); setMode("human"); router.refresh(); } else setError("No se pudo enviar el mensaje.");
    setBusy(false);
  }
  return <div className="space-y-4">
    <div className="flex gap-2 flex-wrap text-[10px]"><button disabled={busy} onClick={() => changeMode("human", "open")} className={`border rounded-lg px-3 py-2 ${mode === "human" ? "border-yellow-700 text-yellow-400" : "border-zinc-800 text-zinc-500"}`}>Tomar conversación</button><button disabled={busy} onClick={() => changeMode("ai", "open")} className={`border rounded-lg px-3 py-2 ${mode === "ai" ? "border-emerald-700 text-emerald-400" : "border-zinc-800 text-zinc-500"}`}>Devolver a IA</button><button disabled={busy} onClick={() => changeMode("paused")} className={`border rounded-lg px-3 py-2 ${mode === "paused" ? "border-zinc-500 text-zinc-300" : "border-zinc-800 text-zinc-500"}`}>Pausar</button><button disabled={busy} onClick={() => changeMode(mode, "resolved")} className="border border-zinc-800 rounded-lg px-3 py-2 text-zinc-500">Resolver</button></div>
    <form onSubmit={send} className="flex gap-2"><textarea value={text} onChange={event => setText(event.target.value)} maxLength={4096} rows={2} placeholder="Responder por WhatsApp…" className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-[#c4a882]"/><button disabled={busy || !text.trim()} className="self-stretch bg-[#c4a882] text-black rounded-lg px-5 text-xs disabled:opacity-40">{busy ? "Enviando…" : "Enviar"}</button></form>
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>;
}
