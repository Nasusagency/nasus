import type { ReactNode } from "react";

export type BadgeTone = "success" | "warning" | "info" | "danger" | "neutral";

const TONE_STYLES: Record<BadgeTone, string> = {
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-blue-100 text-blue-800",
  danger: "bg-red-100 text-red-700",
  neutral: "bg-zinc-100 text-zinc-700",
};

/**
 * Pill de estado para listas y fichas: mismo componente en todo el admin para
 * que "qué estado tiene este item" se lea de un vistazo, sin adivinar por texto.
 */
export function Badge({ tone = "neutral", children, className = "" }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${TONE_STYLES[tone]} ${className}`}>{children}</span>;
}
