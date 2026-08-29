import type { ReactNode } from "react";

/**
 * Estado vacío único para todo el admin: mensaje + acción opcional, nunca una
 * tabla/lista en blanco sin explicación. Mismo componente en listas de nivel
 * superior (cotizaciones, propuestas, leads, inbox) y en las secciones de la
 * ficha del contacto.
 */
export function EmptyState({ title, description, action, compact = false }: { title: string; description?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-center ${compact ? "px-4 py-8" : "px-6 py-12"}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="3" strokeDasharray="3 3" />
        </svg>
      </span>
      <div>
        <p className="text-sm font-medium text-zinc-700">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
