import Link from "next/link";
import { getClientes } from "@/lib/admin/data";

const FASE_COLOR: Record<string, string> = {
  Prospecto: "text-zinc-400 bg-zinc-800 border-zinc-700",
  Propuesta: "text-yellow-400 bg-yellow-950/40 border-yellow-900/30",
  Activo: "text-emerald-400 bg-emerald-950/40 border-emerald-900/30",
  Pausa: "text-red-400 bg-red-950/40 border-red-900/30",
  Cerrado: "text-zinc-500 bg-zinc-900 border-zinc-800",
};

export default function ClientesPage() {
  const clientes = getClientes();

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-mono font-bold text-zinc-100">Clientes</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{clientes.length} registros</p>
        </div>
      </div>

      {clientes.length === 0 ? (
        <p className="text-sm text-zinc-600">Sin clientes registrados.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {clientes.map((c) => (
            <Link
              key={c.slug}
              href={`/admin/clientes/${c.slug}`}
              className="flex items-start justify-between bg-zinc-900/40 border border-zinc-800 rounded-xl px-5 py-4 hover:border-zinc-700 hover:bg-zinc-900/60 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-zinc-100 group-hover:text-[#c4a882] transition-colors">
                    {c.nombre}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${FASE_COLOR[c.fase] ?? "text-zinc-400"}`}
                  >
                    {c.fase}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1.5">
                  <span className="text-xs text-zinc-500">{c.contacto}</span>
                  {c.sistema && (
                    <span className="text-xs text-zinc-600">{c.sistema}</span>
                  )}
                  {c.modalidad && (
                    <span className="text-xs text-zinc-600">{c.modalidad}</span>
                  )}
                </div>
                {c.siguiente_paso && (
                  <p className="text-xs text-zinc-500 mt-2 leading-snug line-clamp-2">
                    → {c.siguiente_paso}
                  </p>
                )}
              </div>
              <span className="text-zinc-600 ml-4 mt-0.5 group-hover:text-zinc-400 transition-colors">
                →
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-zinc-900/30 border border-zinc-800 rounded-xl">
        <p className="text-xs text-zinc-500 font-mono">
          Los clientes se gestionan por código en{" "}
          <code className="text-zinc-400">lib/admin/data.ts</code>. Próximamente:
          persistencia en Supabase.
        </p>
      </div>
    </div>
  );
}
