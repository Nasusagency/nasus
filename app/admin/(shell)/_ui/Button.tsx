"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-[#8c6a3b] text-white border border-transparent hover:bg-[#76582f] active:bg-[#6a4f29] disabled:bg-[#c8b190] disabled:text-white/80",
  secondary: "bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400 active:bg-zinc-100 disabled:bg-zinc-50 disabled:text-zinc-400 disabled:border-zinc-200",
  destructive: "bg-white text-red-700 border border-red-300 hover:bg-red-50 hover:border-red-400 active:bg-red-100 disabled:bg-white disabled:text-red-300 disabled:border-red-200",
  ghost: "bg-transparent text-zinc-600 border border-transparent hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 disabled:text-zinc-300",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[11px]",
  md: "px-4 py-2 text-xs",
  lg: "px-4 py-2.5 text-sm",
};

/** Spinner inline consistente: úsalo en cualquier estado de carga fuera de un <Button> (skeletons, secciones). */
export function Spinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Texto a mostrar mientras loading=true. Si se omite, se mantiene el texto normal (solo aparece el spinner). */
  loadingText?: ReactNode;
  fullWidth?: boolean;
  children: ReactNode;
}

/**
 * Botón único para todo el admin: jerarquía primary/secondary/destructive/ghost,
 * spinner de carga consistente, y disabled automático mientras loading=true (evita
 * doble submit sin que cada pantalla reimplemente su propio `disabled={busy}`).
 */
export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  loadingText,
  fullWidth = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {loading && <Spinner className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} />}
      {loading && loadingText !== undefined ? loadingText : children}
    </button>
  );
}
