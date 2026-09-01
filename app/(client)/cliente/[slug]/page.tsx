import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCliente } from "@/lib/admin/data";

export const metadata: Metadata = {
  robots: "noindex, nofollow",
};

// Lee de un store en memoria mutado por el admin en tiempo real; sin marca
// explícita Next lo renderizaría una sola vez en build y quedaría obsoleto.
export const dynamic = "force-dynamic";

export default async function ClientePanelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cliente = getCliente(slug);
  if (!cliente) notFound();

  const doneCount = cliente.milestones?.filter((m) => m.done).length ?? 0;
  const totalCount = cliente.milestones?.length ?? 0;
  const progressPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  const FASE_LABEL: Record<string, string> = {
    Prospecto: "En contacto inicial",
    Propuesta: "Propuesta en revisión",
    Activo: "Proyecto activo",
    Pausa: "En pausa",
    Cerrado: "Proyecto cerrado",
  };

  return (
    <div className="min-h-screen bg-[#050508] text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-900 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="text-[#c4a882] font-mono font-bold text-sm tracking-widest">
            NASUS
          </span>
          <span className="text-xs text-zinc-500 font-mono">Panel de proyecto</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Client identity */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-zinc-100">{cliente.nombre}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {FASE_LABEL[cliente.fase] ?? cliente.fase}
          </p>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400 font-mono">Progreso del proyecto</span>
              <span className="text-xs text-zinc-400 font-mono">{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#c4a882] rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Milestones */}
        {cliente.milestones && cliente.milestones.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-5">
              Hitos
            </h2>
            <ol className="relative border-l border-zinc-800 pl-6 flex flex-col gap-6">
              {cliente.milestones.map((m, i) => (
                <li key={i} className="relative">
                  <div
                    className={`absolute -left-[25px] w-3 h-3 rounded-full border-2 ${
                      m.done
                        ? "bg-[#c4a882] border-[#c4a882]"
                        : "bg-[#050508] border-zinc-700"
                    }`}
                  />
                  <p
                    className={`text-sm leading-snug ${
                      m.done ? "text-zinc-300" : "text-zinc-500"
                    }`}
                  >
                    {m.label}
                  </p>
                  {m.done && (
                    <span className="text-[10px] text-[#c4a882]/60 font-mono mt-0.5 block">
                      Completado
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Next step */}
        {cliente.siguiente_paso && (
          <section className="mb-10">
            <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-3">
              Siguiente paso
            </h2>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <p className="text-sm text-zinc-300 leading-relaxed">
                {cliente.siguiente_paso}
              </p>
            </div>
          </section>
        )}

        {/* Endpoint info (if active) */}
        {cliente.endpoints && cliente.endpoints.some((e) => e.estado === "listo") && (
          <section className="mb-10">
            <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-3">
              Servicio disponible
            </h2>
            <div className="flex flex-col gap-2">
              {cliente.endpoints
                .filter((e) => e.estado === "listo")
                .map((ep, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-none" />
                    <code className="text-sm text-[#00f2ff]/80 font-mono">{ep.ruta}</code>
                    <span className="text-xs text-zinc-500 ml-auto">v{ep.version}</span>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Contact */}
        <section className="border-t border-zinc-900 pt-8 mt-8">
          <p className="text-xs text-zinc-500 leading-relaxed">
            ¿Tienes preguntas sobre el estado de tu proyecto?{" "}
            <a
              href="mailto:nasusagency@gmail.com"
              className="text-[#c4a882] hover:underline"
            >
              Contacta a Nasus Agency
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
