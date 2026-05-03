import Link from "next/link";
import { getClientes, getCambios, getPropuestas } from "@/lib/admin/data";

const FASE_COLOR: Record<string, string> = {
  Prospecto: "text-zinc-400 bg-zinc-800",
  Propuesta: "text-yellow-400 bg-yellow-950/40",
  Activo: "text-emerald-400 bg-emerald-950/40",
  Pausa: "text-red-400 bg-red-950/40",
  Cerrado: "text-zinc-500 bg-zinc-900",
};

export default function AdminDashboard() {
  const clientes = getClientes();
  const cambios = getCambios();
  const propuestas = getPropuestas();

  const activos = clientes.filter((c) => c.fase === "Activo").length;
  const propuestasFase = clientes.filter((c) => c.fase === "Propuesta").length;
  const cambiosPendientes = cambios.filter((c) => c.estado === "Pendiente").length;

  const recentActivity = cambios.slice(0, 5);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-xl font-mono font-bold text-zinc-100">
          Hola, Luis Oscar
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5 font-mono">
          {new Date().toLocaleDateString("es-MX", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Clientes totales", value: clientes.length, color: "text-zinc-100" },
          { label: "En propuesta", value: propuestasFase, color: "text-yellow-400" },
          { label: "Activos", value: activos, color: "text-emerald-400" },
          { label: "Cambios pendientes", value: cambiosPendientes, color: "text-[#00f2ff]" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4"
          >
            <div className={`text-2xl font-mono font-bold ${color}`}>{value}</div>
            <div className="text-xs text-zinc-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Clientes recientes */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
              Clientes
            </h2>
            <Link
              href="/admin/clientes"
              className="text-[10px] text-[#c4a882] hover:underline font-mono"
            >
              Ver todos →
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {clientes.length === 0 ? (
              <p className="text-xs text-zinc-600">Sin clientes.</p>
            ) : (
              clientes.slice(0, 4).map((c) => (
                <Link
                  key={c.slug}
                  href={`/admin/clientes/${c.slug}`}
                  className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800 rounded-lg px-4 py-3 hover:border-zinc-700 transition-colors"
                >
                  <div>
                    <div className="text-sm text-zinc-200 font-medium">{c.nombre}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{c.contacto}</div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${FASE_COLOR[c.fase] ?? "text-zinc-400"}`}
                  >
                    {c.fase}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Actividad reciente */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
              Cambios recientes
            </h2>
            <Link
              href="/admin/cambios"
              className="text-[10px] text-[#c4a882] hover:underline font-mono"
            >
              Ver todos →
            </Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-xs text-zinc-600">Sin cambios registrados.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentActivity.map((c) => (
                <div
                  key={c.id}
                  className="bg-zinc-900/40 border border-zinc-800 rounded-lg px-4 py-3"
                >
                  <div className="text-xs text-zinc-300 leading-snug">{c.descripcion}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-zinc-500">{c.clienteSlug}</span>
                    <span className="text-[10px] text-zinc-600">·</span>
                    <span className="text-[10px] text-zinc-500">{c.estado}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Quick actions */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/admin/propuestas/nueva"
          className="text-xs font-mono border border-[#c4a882]/40 text-[#c4a882] px-4 py-2 rounded-lg hover:bg-[#c4a882]/10 transition-colors"
        >
          + Nueva propuesta
        </Link>
        <Link
          href="/admin/cambios"
          className="text-xs font-mono border border-zinc-700 text-zinc-400 px-4 py-2 rounded-lg hover:bg-zinc-900 transition-colors"
        >
          + Registrar cambio
        </Link>
        {propuestas.length > 0 && (
          <Link
            href={`/propuesta/${propuestas[0].slug}`}
            target="_blank"
            className="text-xs font-mono border border-zinc-700 text-zinc-400 px-4 py-2 rounded-lg hover:bg-zinc-900 transition-colors"
          >
            Ver última propuesta ↗
          </Link>
        )}
      </div>
    </div>
  );
}
