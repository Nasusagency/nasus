import Link from "next/link";
import { getAdminLeads } from "@/lib/admin/acquisition-data";
import { maskPhone } from "@/lib/acquisition/attribution";
import { CRM_LIFECYCLES, CRM_STAGES } from "@/lib/crm/domain";
import { Badge, type BadgeTone } from "../_ui/Badge";

const LIFECYCLE_TONE: Record<string, BadgeTone> = { lead: "neutral", client: "success", former_client: "warning" };
const STAGE_TONE: Record<string, BadgeTone> = { exploring: "neutral", opportunity: "info", qualified: "info", proposal: "warning", won: "success", lost: "danger" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const stage = typeof q.stage === "string" ? q.stage : undefined;
  const lifecycle = typeof q.lifecycle === "string" ? q.lifecycle : undefined;
  const human = q.human === "1";
  const leads = await getAdminLeads({ days: 365, stage, lifecycle, human });
  return <div className="p-6 lg:p-8 max-w-7xl mx-auto">
    <div className="flex flex-wrap justify-between gap-4 mb-6"><div><p className="text-[10px] tracking-[.18em] text-[#8c6a3b]">CONTACTOS</p><h1 className="text-2xl font-semibold text-zinc-950">CRM / Leads</h1><p className="text-sm text-zinc-600">Una sola fuente para prospectos, clientes y antiguos clientes.</p></div><form className="flex flex-wrap gap-2 text-xs"><select name="lifecycle" defaultValue={lifecycle ?? ""} className="border border-zinc-300 bg-white text-zinc-800 rounded-lg px-3"><option value="">Todos los lifecycle</option>{CRM_LIFECYCLES.map(s => <option key={s}>{s}</option>)}</select><select name="stage" defaultValue={stage ?? ""} className="border border-zinc-300 bg-white text-zinc-800 rounded-lg px-3"><option value="">Todos los stages</option>{CRM_STAGES.map(s => <option key={s}>{s}</option>)}</select><label className="flex items-center gap-2 border border-zinc-300 bg-white text-zinc-700 rounded-lg px-3"><input type="checkbox" name="human" value="1" defaultChecked={human}/> Requiere humano</label><button className="bg-[#8c6a3b] text-white rounded-lg px-4">Filtrar</button></form></div>
    <div className="overflow-x-auto border border-zinc-200 bg-white rounded-xl"><table className="w-full text-xs"><thead className="bg-zinc-50 text-zinc-600"><tr>{["Contacto", "Teléfono", "Empresa / sector", "Fuente / campaña", "Lifecycle", "Stage", "Señales", "Última interacción"].map(h => <th key={h} className="text-left font-medium px-3 py-3">{h}</th>)}</tr></thead><tbody>{leads.map(l => <tr key={l.id} className="border-t border-zinc-100 align-top hover:bg-amber-50/30"><td className="px-3 py-3"><Link href={`/admin/leads/${l.id}`} className="font-medium text-[#76582f]">{l.nombre_contacto || "Sin nombre"}</Link></td><td className="px-3 py-3 text-zinc-600">{maskPhone(l.numero)}</td><td className="px-3 py-3 text-zinc-700">{l.nombre_empresa || "—"}<br/><span className="text-zinc-500">{l.sector || "—"}</span></td><td className="px-3 py-3 text-zinc-700">{l.source || "Sin atribución"}<br/><span className="text-zinc-500">{l.campaign || "—"}</span></td><td className="px-3 py-3"><Badge tone={LIFECYCLE_TONE[l.lifecycle] ?? "neutral"}>{l.lifecycle}</Badge></td><td className="px-3 py-3"><Badge tone={STAGE_TONE[l.stage] ?? "neutral"}>{l.stage}</Badge></td><td className="px-3 py-3 space-y-1">{l.high_intent_detected_at && <Badge tone="warning">High intent</Badge>}{l.requiere_humano && <Badge tone="danger" className="block w-fit">Requiere humano</Badge>}</td><td className="px-3 py-3 text-zinc-500">{new Date(l.ultima_interaccion).toLocaleString("es-MX")}</td></tr>)}</tbody></table>{!leads.length && <p className="text-center text-zinc-500 text-sm p-8">No hay contactos para estos filtros.</p>}</div>
  </div>;
}
