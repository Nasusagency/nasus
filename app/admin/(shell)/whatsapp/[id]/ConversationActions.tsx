"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ConversationMode } from "@/lib/whatsapp/conversation-policy";
import { Button, Spinner } from "../../_ui/Button";
import { Chip } from "../../_ui/Chip";
import { InlineMessage } from "../../_ui/InlineMessage";

type ModeAction = null | "human" | "ai" | "paused" | "resolved" | "send";

export default function ConversationActions({ conversationId, initialMode }: { conversationId: string; initialMode: ConversationMode }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [text, setText] = useState("");
  const [action, setAction] = useState<ModeAction>(null);
  const busy = action !== null;
  const [error, setError] = useState("");
  async function changeMode(next: ConversationMode, status: "open" | "resolved" | undefined, actionKey: ModeAction) {
    setAction(actionKey); setError("");
    const response = await fetch(`/api/admin/whatsapp/conversations/${conversationId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: next, status }) });
    if (response.ok) { setMode(next); router.refresh(); } else setError("No se pudo actualizar la conversación.");
    setAction(null);
  }
  async function send(event: React.FormEvent) {
    event.preventDefault(); if (!text.trim() || busy) return;
    setAction("send"); setError("");
    const response = await fetch(`/api/admin/whatsapp/conversations/${conversationId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: text.trim(), requestId: crypto.randomUUID() }) });
    if (response.ok) { setText(""); setMode("human"); router.refresh(); } else setError("No se pudo enviar el mensaje.");
    setAction(null);
  }
  return <div className="space-y-4">
    <div>
      <p className="mb-1.5 text-[10px] uppercase tracking-widest text-zinc-500">Modo de la conversación</p>
      <div className="flex gap-2 flex-wrap text-xs" role="group" aria-label="Modo de la conversación">
        <Chip active={mode === "human"} tone="warning" disabled={busy} onClick={() => changeMode("human", "open", "human")}>{action === "human" && <Spinner className="h-3 w-3" />}Tomar conversación</Chip>
        <Chip active={mode === "ai"} tone="success" disabled={busy} onClick={() => changeMode("ai", "open", "ai")}>{action === "ai" && <Spinner className="h-3 w-3" />}Devolver a IA</Chip>
        <Chip active={mode === "paused"} tone="neutral" disabled={busy} onClick={() => changeMode("paused", undefined, "paused")}>{action === "paused" && <Spinner className="h-3 w-3" />}Pausar</Chip>
      </div>
    </div>
    <Button variant="ghost" size="sm" disabled={busy} loading={action === "resolved"} loadingText="Resolviendo…" onClick={() => changeMode(mode, "resolved", "resolved")}>Marcar como resuelta</Button>
    <form onSubmit={send} className="flex gap-2"><textarea value={text} onChange={event => setText(event.target.value)} maxLength={4096} rows={2} placeholder="Responder por WhatsApp…" className="flex-1 bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-[#c4a882]"/><Button type="submit" variant="primary" className="self-stretch" disabled={!text.trim()} loading={action === "send"} loadingText="Enviando…">Enviar</Button></form>
    {error && <InlineMessage tone="error" compact>{error}</InlineMessage>}
  </div>;
}
