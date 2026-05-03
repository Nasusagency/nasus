import { notFound } from "next/navigation";
import Link from "next/link";
import { getCliente, getCambios } from "@/lib/admin/data";
import ClienteActions from "./ClienteActions";

const FASE_COLOR: Record<string, string> = {
  Prospecto: "text-zinc-400 bg-zinc-800",
  Propuesta: "text-yellow-400 bg-yellow-950/40",
  Activo: "text-emerald-400 bg-emerald-950/40",
  Pausa: "text-red-400 bg-red-950/40",
  Cerrado: "text-zinc-500 bg-zinc-900",
};

const ESTADO_COLOR: Record<string, string> = {
  Pendiente: "text-yellow-400 bg-yellow-950/30",
  "En revisión": "text-blue-400 bg-blue-950/30",
  Aprobado: "text-emerald-400 bg-emerald-950/30",
  Rechazado: "text-red-400 bg-red-950/30",
};

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cliente = getCliente(slug);
  if (!cliente) notFound();

  const cambios = getCambios(slug);

  const doneCount = cliente.milestones?.filter((m) => m.done).length ?? 0;
  const totalCount = cliente.milestones?.length ?? 0;

  return (
    <div className="p-8 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono mb-6">
        <Link href="/admin/clientes" className="hover:text-zinc-300 transition-colors">
          Clientes
        </Link>
        <span>→</span>
        <span className="text-zinc-300">{cliente.nombre}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-mono font-bold text-zinc-100">{cliente.nombre}</h1>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded-full ${FASE_COLOR[cliente.fase] ?? "text-zinc-400"}`}
            >
              {cliente.fase}
            </span>
          </div>
          <p className="text-sm text-zinc-500 mt-1">Contacto: {cliente.contacto}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/cliente/${slug}`}
            target="_blank"
            className="text-xs font-mono border border-zinc-700 text-zinc-400 px-3 py-1.5 rounded-lg hover:bg-zinc-900 transition-colors"
          >
            Panel cliente ↗
          </Link>
          <Link
            href={`/admin/propuestas/nueva?cliente=${slug}`}
            className="text-xs font-mono border border-[#c4a882]/40 text-[#c4a882] px-3 py-1.5 rounded-lg hover:bg-[#c4a882]/10 transition-colors"
          >
            Generar propuesta
          </Link>
        </div>
      </div>

      <div className="grid gap-4">
        {/* Meta */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-4">
            Información
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ["Sistema", cliente.sistema],
              ["Modalidad", cliente.modalidad],
              ["Modelo de cobro", cliente.modelo_cobro],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs text-zinc-500">{k}</dt>
                  <dd className="text-zinc-200 mt-0.5">{v}</dd>
                </div>
              ))}
          </dl>
          {cliente.siguiente_paso && (
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <dt className="text-xs text-zinc-500 mb-1">Siguiente paso</dt>
              <dd className="text-sm text-[#00f2ff]/80 leading-snug">
                {cliente.siguiente_paso}
              </dd>
            </div>
          )}
        </div>

        {/* Milestones */}
        {cliente.milestones && cliente.milestones.length > 0 && (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
                Progreso
              </h2>
              <span className="text-xs text-zinc-500 font-mono">
                {doneCount}/{totalCount}
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1 mb-4">
              <div
                className="bg-[#c4a882] h-1 rounded-full transition-all"
                style={{ width: totalCount ? `${(doneCount / totalCount) * 100}%` : "0%" }}
              />
            </div>
            <ul className="flex flex-col gap-2">
              {cliente.milestones.map((m, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className={`mt-0.5 ${m.done ? "text-emerald-400" : "text-zinc-600"}`}>
                    {m.done ? "✓" : "○"}
                  </span>
                  <span className={m.done ? "text-zinc-300" : "text-zinc-500"}>
                    {m.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Documents */}
        {cliente.documentos && cliente.documentos.length > 0 && (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-3">
              Documentos
            </h2>
            <div className="flex flex-wrap gap-2">
              {cliente.documentos.map((d) => (
                <span
                  key={d}
                  className="text-xs font-mono bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded-lg border border-zinc-700"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Endpoints */}
        {cliente.endpoints && cliente.endpoints.length > 0 && (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-3">
              Endpoints
            </h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left pb-2 font-normal">Ruta</th>
                  <th className="text-left pb-2 font-normal">Versión</th>
                  <th className="text-left pb-2 font-normal">Estado</th>
                  <th className="text-left pb-2 font-normal">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {cliente.endpoints.map((ep, i) => (
                  <tr key={i} className="border-b border-zinc-900">
                    <td className="py-2 font-mono text-[#00f2ff]/80">{ep.ruta}</td>
                    <td className="py-2 text-zinc-400">{ep.version}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono ${
                          ep.estado === "listo"
                            ? "text-emerald-400 bg-emerald-950/30"
                            : ep.estado === "en desarrollo"
                            ? "text-yellow-400 bg-yellow-950/30"
                            : "text-zinc-500 bg-zinc-900"
                        }`}
                      >
                        {ep.estado}
                      </span>
                    </td>
                    <td className="py-2 text-zinc-500">{ep.fecha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        {cliente.notas && (
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-2">
              Notas internas
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">{cliente.notas}</p>
          </div>
        )}

        {/* Cambios */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-4">
            Control de cambios
          </h2>
          {cambios.length > 0 ? (
            <div className="flex flex-col gap-2 mb-4">
              {cambios.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-2"
                >
                  <div>
                    <p className="text-sm text-zinc-300">{c.descripcion}</p>
                    {c.solicitadoPor && (
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Por: {c.solicitadoPor}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap ${ESTADO_COLOR[c.estado] ?? "text-zinc-400"}`}
                  >
                    {c.estado}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-600 mb-4">Sin cambios registrados.</p>
          )}

          <ClienteActions clienteSlug={slug} />
        </div>
      </div>
    </div>
  );
}
