import type { ReactNode } from "react";

export type MessageTone = "success" | "error" | "info";

const TEXT_STYLES: Record<MessageTone, string> = {
  success: "text-emerald-700",
  error: "text-red-700",
  info: "text-zinc-600",
};
const BOX_STYLES: Record<MessageTone, string> = {
  success: "bg-emerald-50 border-emerald-200",
  error: "bg-red-50 border-red-200",
  info: "bg-zinc-50 border-zinc-200",
};

function ToneIcon({ tone }: { tone: MessageTone }) {
  if (tone === "success") return <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (tone === "error") return <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" strokeLinecap="round" /></svg>;
  return <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" strokeLinecap="round" /></svg>;
}

/**
 * Mensaje de resultado de una acción: mismo componente para éxito/error/info
 * en todo el admin, en vez de <p> sueltos con colores distintos por pantalla
 * (o, peor, sin distinguir visualmente error de éxito). `compact` para junto
 * a un botón; sin `compact` para un banner de ancho completo.
 */
export function InlineMessage({ tone = "info", compact = false, children }: { tone?: MessageTone; compact?: boolean; children: ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`inline-flex items-center gap-1.5 text-xs ${TEXT_STYLES[tone]} ${compact ? "" : `rounded-lg border px-3 py-2 ${BOX_STYLES[tone]}`}`}>
      <ToneIcon tone={tone} />
      <span>{children}</span>
    </p>
  );
}
