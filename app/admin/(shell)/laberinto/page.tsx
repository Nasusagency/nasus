import Link from "next/link";
import { getGuiaDashboard } from "@/lib/admin/guia-data";
import { chipClassName } from "../_ui/Chip";
import { EmptyState } from "../_ui/EmptyState";

const TIPOS: [string, string][] = [
  ["", "Todos"], ["agente_ia", "Agentes IA"], ["buscador", "Buscadores"], ["herramienta", "Herramientas"],
  ["navegador_automatizado", "Headless"], ["otro_bot", "Otros bots"], ["navegador", "Navegadores"], ["desconocido", "Desconocido"],
];
const DIAS = [7, 30, 90];
const fecha = (v: string) => new Date(v).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });

type Row = { key: string; total: number; ia: number; agentes: string[]; ultima: string };

function Tabla({ title, hint, rows, limit = 25 }: { title: string; hint?: string; rows: Row[]; limit?: number }) {
  return <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
    <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
    {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    {rows.length ? <ul className="mt-4 divide-y divide-zinc-100">{rows.slice(0, limit).map((r) => <li key={r.key} className="flex items-start justify-between gap-3 py-2.5 text-xs">
      <div className="min-w-0"><p className="break-all font-mono text-zinc-800">{r.key}</p>{r.agentes.length > 0 && <p className="mt-1 text-[11px] text-zinc-500">{r.agentes.join(" · ")}</p>}</div>
      <div className="shrink-0 text-right"><p className="font-semibold text-zinc-900">{r.total}</p>{r.ia > 0 && <p className="text-[10px] text-[#76582f]">{r.ia} IA</p>}<p className="text-[10px] text-zinc-400">{fecha(r.ultima)}</p></div>
    </li>)}</ul> : <p className="mt-4 text-xs text-zinc-400">Sin datos en este rango.</p>}
  </section>;
}

export default async function LaberintoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const tipo = typeof q.tipo === "string" && TIPOS.some(([v]) => v === q.tipo) ? q.tipo : "";
  const days = DIAS.includes(Number(q.dias)) ? Number(q.dias) : 30;
  const data = await getGuiaDashboard({ days, tipo: tipo || undefined });
  const href = (next: { tipo?: string; dias?: number }) => ({ pathname: "/admin/laberinto", query: { ...((next.tipo ?? tipo) ? { tipo: next.tipo ?? tipo } : {}), dias: next.dias ?? days } });

  return <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
    <div className="mb-6"><p className="text-[10px] tracking-[.18em] text-[#8c6a3b]">EXPERIMENTO</p><h1 className="text-2xl font-semibold text-zinc-950">Laberinto de Agentes</h1><p className="text-sm text-zinc-600">Qué piden los agentes en <a href="/guia" target="_blank" className="underline">/guia</a>, qué archivos leen y qué rutas buscan que no existen en todo el sitio.</p></div>
    <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">{TIPOS.map(([v, label]) => <Link key={v} href={href({ tipo: v })} className={`${chipClassName(tipo === v, "brand")} shrink-0 whitespace-nowrap`}>{label}</Link>)}</div>
    <div className="mb-6 flex gap-2">{DIAS.map((d) => <Link key={d} href={href({ dias: d })} className={chipClassName(days === d, "brand")}>{d} días</Link>)}</div>
    {!data ? <EmptyState title="Supabase no configurado" description="Faltan credenciales del servidor." /> : data.error ? <EmptyState title="No se pudo leer el registro" description="Revisa que la migración 0023_guia_visitas esté aplicada." /> : !data.total ? <EmptyState title="Todavía no hay visitas registradas" description="Los agentes llegan por enlaces, sitemaps y buscadores: pueden pasar días o semanas. El registro empieza en cuanto alguien pide /guia, llms.txt, robots.txt, el sitemap o una ruta que no existe." /> : <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Peticiones", data.total], ["Visitantes distintos (por día)", data.visitantes], ["Rutas inexistentes", data.noExisten.length], ["Agentes identificados", data.agentes.length]].map(([label, value]) => <div key={label as string} className="rounded-2xl border border-zinc-200 bg-white p-4"><p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-1 text-2xl font-semibold text-zinc-950">{value}</p></div>)}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Tabla title="Rutas que buscaron y no existen (404)" hint="La señal más valiosa: lo que esperaban encontrar." rows={data.noExisten} />
        <Tabla title="Ramas más visitadas de la guía" rows={data.ramas} />
        <Tabla title="Agentes y bots" hint="Clasificados por el user agent que declaran." rows={data.agentes} />
        <Tabla title="Tipo de visitante" rows={data.porTipo} />
        <Tabla title="Archivos para agentes" hint="llms.txt, robots.txt y sitemap.xml." rows={data.archivos} />
        <Tabla title="Caminos dentro de la guía" hint="Página de origen (ref) → página pedida." rows={data.caminos} />
        <Tabla title="Sitios que enviaron visitas" rows={data.referers} limit={15} />
      </div>
      <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Últimas peticiones</h2>
        <ul className="mt-4 divide-y divide-zinc-100">{data.recientes.map((r, i) => <li key={i} className="grid grid-cols-[auto_1fr] gap-x-3 py-2 text-xs sm:grid-cols-[8rem_9rem_1fr_3rem]">
          <time className="text-zinc-400">{fecha(r.ts)}</time>
          <span className="truncate text-right text-[#76582f] sm:text-left">{r.agente || r.tipo_visitante}</span>
          <span className="col-span-2 break-all font-mono text-zinc-800 sm:col-span-1">{r.ruta}{r.referencia ? <span className="text-zinc-400"> ← {r.referencia}</span> : null}</span>
          <span className={`hidden text-right sm:block ${r.estado === 404 ? "text-red-600" : "text-zinc-400"}`}>{r.estado}</span>
        </li>)}</ul>
      </section>
    </>}
  </div>;
}
