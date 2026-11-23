import Link from "next/link";
import { getAdminLeads } from "@/lib/admin/acquisition-data";
import { CRM_LIFECYCLES, CRM_STAGES } from "@/lib/crm/domain";
import { EmptyState } from "../_ui/EmptyState";
import CreateLeadAction from "./CreateLeadAction";
import LeadsList from "./LeadsList";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const stage = typeof q.stage === "string" ? q.stage : undefined;
  const lifecycle = typeof q.lifecycle === "string" ? q.lifecycle : undefined;
  const human = q.human === "1";
  const archived = q.archived === "1";
  const leads = await getAdminLeads({ days: 365, stage, lifecycle, human, archived });
  return <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
    <div className="flex flex-wrap justify-between gap-4 mb-6"><div><p className="text-[10px] tracking-[.18em] text-[#8c6a3b]">CONTACTOS</p><h1 className="text-2xl font-semibold text-zinc-950">CRM / Leads</h1><p className="text-sm text-zinc-600">Una sola fuente para prospectos, clientes y antiguos clientes.</p></div><div className="flex flex-wrap items-start gap-2"><Link href={archived ? "/admin/leads" : "/admin/leads?archived=1"} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 h-fit">{archived ? "Ver activos" : "Ver archivados"}</Link>{!archived && <CreateLeadAction />}</div></div>
    {!archived && <form className="grid grid-cols-2 gap-2 text-xs mb-4 sm:flex sm:flex-wrap"><select name="lifecycle" defaultValue={lifecycle ?? ""} className="h-10 border border-zinc-300 bg-white text-zinc-800 rounded-lg px-3"><option value="">Todos los lifecycle</option>{CRM_LIFECYCLES.map(s => <option key={s}>{s}</option>)}</select><select name="stage" defaultValue={stage ?? ""} className="h-10 border border-zinc-300 bg-white text-zinc-800 rounded-lg px-3"><option value="">Todos los stages</option>{CRM_STAGES.map(s => <option key={s}>{s}</option>)}</select><label className="h-10 flex items-center gap-2 border border-zinc-300 bg-white text-zinc-700 rounded-lg px-3"><input type="checkbox" name="human" value="1" defaultChecked={human}/> Requiere humano</label><button className="h-10 bg-[#8c6a3b] text-white rounded-lg px-4">Filtrar</button></form>}
    {archived && <p className="text-xs text-zinc-500 mb-4">Contactos archivados: ocultos del listado normal, con su historial intacto. Restáuralos para que vuelvan a aparecer.</p>}
    {leads.length ? <LeadsList leads={leads} archived={archived} /> : <EmptyState title="No hay contactos para estos filtros" description={archived ? "No hay contactos archivados." : stage || lifecycle || human ? "Ajusta o quita los filtros para ver más contactos." : "Los contactos aparecen aquí en cuanto alguien escribe por WhatsApp o se registra manualmente."} action={(stage || lifecycle || human) ? <Link href="/admin/leads" className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">Quitar filtros</Link> : undefined} />}
  </div>;
}
