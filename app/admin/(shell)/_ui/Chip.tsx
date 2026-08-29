import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ChipTone = "brand" | "success" | "warning" | "neutral";

const ACTIVE_STYLES: Record<ChipTone, string> = {
  brand: "border-[#c4a882] bg-[#c4a882]/10 text-[#76582f]",
  success: "border-emerald-600 bg-emerald-50 text-emerald-700",
  warning: "border-amber-500 bg-amber-50 text-amber-800",
  neutral: "border-zinc-500 bg-zinc-100 text-zinc-800",
};
const INACTIVE_STYLES = "border-zinc-300 bg-white text-zinc-500 hover:border-zinc-400 hover:text-zinc-700";

/**
 * Clases para un chip/tab seleccionable — exportado aparte de <Chip> para los
 * casos que navegan con <Link> (los filtros del inbox de WhatsApp, por ejemplo)
 * y no pueden usar un <button>, pero deben verse idénticos.
 */
export function chipClassName(active: boolean, tone: ChipTone = "brand"): string {
  return `inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${active ? ACTIVE_STYLES[tone] : INACTIVE_STYLES}`;
}

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  active: boolean;
  tone?: ChipTone;
  children: ReactNode;
}

/** Tab/toggle seleccionable: mismo componente para filtros, modos y segmented controls en todo el admin. */
export function Chip({ active, tone = "brand", className = "", children, ...props }: ChipProps) {
  return (
    <button type="button" aria-pressed={active} {...props} className={`${chipClassName(active, tone)} ${className}`}>
      {children}
    </button>
  );
}
