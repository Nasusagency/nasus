import { listarArticulos, leerCola } from "@/lib/articulos/store";
import { EmptyState } from "../_ui/EmptyState";

const PRS_ABIERTOS = "https://github.com/Nasusagency/nasus/pulls";

// Se lee el disco en cada visita: un artículo recién fusionado aparece sin reconstruir nada a mano.
export const dynamic = "force-dynamic";

const fecha = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { dateStyle: "medium" });

export default function ArticulosAdminPage() {
  const publicados = listarArticulos();
  const pendientes = leerCola().filter((e) => !e.hecho);

  return <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    <div className="mb-6">
      <p className="text-[10px] tracking-[.18em] text-[#8c6a3b]">BLOG</p>
      <h1 className="text-2xl font-semibold text-zinc-950">Artículos</h1>
      <p className="text-sm text-zinc-600">Cada madrugada (2 a. m., hora de CDMX) se abre un pull request con un artículo nuevo. Al aprobarlo en GitHub se publica.</p>
    </div>

    <div className="mb-8 flex flex-wrap gap-2 text-xs">
      <a href={PRS_ABIERTOS} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-zinc-950 px-4 py-2.5 font-medium text-white hover:bg-zinc-800">Revisar y aprobar en GitHub ↗</a>
      <a href="/articulos" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 font-medium text-zinc-700 hover:border-zinc-400">Ver el blog público ↗</a>
    </div>

    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900">Publicados ({publicados.length})</h2>
      {publicados.length === 0
        ? <EmptyState title="Todavía no hay artículos publicados" description="El primero llega como pull request en GitHub; al hacer merge aparece aquí y en /articulos." />
        : <ul className="space-y-3">{publicados.map((a) => <li key={a.slug} className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
          <a href={`/articulos/${a.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline">{a.titulo}</a>
          <p className="mt-1 text-xs text-zinc-500">{a.descripcion}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
            <span>{fecha(a.fecha)}</span>
            {a.modelo && <span className="rounded-md bg-[#f7f5f0] px-2 py-0.5 uppercase tracking-wider text-[#76582f]">{a.modelo}</span>}
            {a.palabraClave && <span>«{a.palabraClave}»</span>}
          </p>
        </li>)}</ul>}
    </section>

    <section>
      <h2 className="mb-1 text-sm font-semibold text-zinc-900">Siguientes en la cola ({pendientes.length})</h2>
      <p className="mb-3 text-xs text-zinc-500">Se escriben en este orden, uno por noche. Para cambiarlo, edita content/articulos/cola.json.</p>
      {pendientes.length === 0
        ? <EmptyState title="La cola está vacía" description="Agrega palabras clave nuevas en content/articulos/cola.json o la tarea nocturna no tendrá qué escribir." compact />
        : <ol className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">{pendientes.map((e, i) => <li key={e.palabraClave} className="flex gap-3 px-4 py-3 text-xs text-zinc-700"><span className="w-5 shrink-0 font-mono text-zinc-400">{i + 1}</span><span>{e.palabraClave}</span></li>)}</ol>}
    </section>
  </div>;
}
