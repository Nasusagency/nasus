import Link from "next/link";
import { getAcquisitionDashboard } from "@/lib/admin/acquisition-data";
import { maskPhone } from "@/lib/acquisition/attribution";
import { calculateCampaignEfficiency } from "@/lib/acquisition/costs";
import CampaignMetricsForm from "./CampaignMetricsForm";
import GoogleAdsSyncButton from "./GoogleAdsSyncButton";
import { ADS_SYNC_LABELS, formatMexicoCityTimestamp } from "@/lib/acquisition/sync-status";
import { CampaignPerformance, FunnelVisual, KpiCard, type CampaignView } from "./DashboardVisuals";

const SOURCES = ["chatgpt", "google", "organic", "direct", "otros"];
const show = (value: number | null, suffix = "") => value === null ? "—" : `${value.toLocaleString("es-MX", { maximumFractionDigits: 2 })}${suffix}`;
const money = (value: number | null, currency: string) => value === null ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(value);

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const days = [1, 7, 30].includes(Number(query.days)) ? Number(query.days) : 30;
  const source = typeof query.source === "string" ? query.source : undefined;
  const campaign = typeof query.campaign === "string" ? query.campaign : undefined;
  const data = await getAcquisitionDashboard({ days, source, campaign });
  const funnel = [["Visitas", data.visits], ["Clic WhatsApp", data.whatsappClicks], ["Conversaciones", data.conversations], ["Leads", data.leads], ["Qualified", data.qualified], ["High intent", data.highIntent]] as const;
  const totals = calculateCampaignEfficiency({ spend: data.spend, impressions: data.impressions, adClicks: data.adClicks, visits: data.visits, whatsappClicks: data.whatsappClicks, conversations: data.conversations, leads: data.leads, qualified: data.qualified, highIntent: data.highIntent });
  const currency = data.currency ?? "MXN";
  const priorityKpis = [
    { label: "Visitas", value: show(data.visits), hint: "Sesiones web observadas", featured: true },
    { label: "Clics en WhatsApp", value: show(data.whatsappClicks), hint: "CTA al número comercial 2391", featured: true },
    { label: "Leads", value: show(data.leads), hint: "Prospectos persistidos" },
    { label: "Gasto", value: data.currency ? money(data.spend, data.currency) : "—", hint: "Inversión conocida del periodo" },
    { label: "Gasto por visita", value: money(totals.costPerVisit, currency), hint: "Gasto / visitas" },
    { label: "Gasto por lead", value: money(totals.costPerLead, currency), hint: "Gasto / leads", featured: true },
  ];
  const campaignViews: CampaignView[] = data.campaignPerformance.map(performance => ({
    key: `${performance.platform}-${performance.campaign}-${performance.currency}`,
    title: `${performance.platform} — ${performance.campaign}`,
    sourceType: performance.rows.some((row: { source_type: string }) => row.source_type === "synced") ? "synced" : "manual",
    currency: performance.currency,
    spend: money(performance.spend, performance.currency),
    visits: show(performance.visits),
    leads: show(performance.leads),
    costPerLead: money(performance.costPerLead, performance.currency),
    primary: [["Impresiones", show(performance.impressions)], ["Clics anuncio", show(performance.adClicks)], ["Visitas", show(performance.visits)], ["WhatsApp", show(performance.whatsappClicks)], ["Conversaciones", show(performance.conversations)], ["Leads", show(performance.leads)], ["Qualified", show(performance.qualified)], ["High intent", show(performance.highIntent)]],
    costs: [["CPC", money(performance.cpc, performance.currency)], ["Costo / WhatsApp", money(performance.costPerWhatsappClick, performance.currency)], ["Costo / Lead", money(performance.costPerLead, performance.currency)], ["Costo / Qualified", money(performance.costPerQualified, performance.currency)], ["Costo / High intent", money(performance.costPerHighIntent, performance.currency)]],
  }));

  return <div className="p-3 sm:p-5 lg:p-8 max-w-7xl mx-auto font-mono space-y-6 sm:space-y-8">
    <header className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end justify-between gap-4"><div><p className="text-[10px] tracking-[.25em] text-[#76582f]">NASUS / ACQUISITION</p><h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 mt-1">Funnel comercial</h1><p className="text-xs text-zinc-500 mt-2">Lectura ejecutiva de adquisición y conversión · últimos {days} días</p></div><form className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 text-xs w-full sm:w-auto rounded-2xl border border-zinc-200 bg-white p-2"><select name="days" defaultValue={days} className="min-w-0 bg-white border border-zinc-200 rounded-lg px-3 py-2.5"><option value="1">Hoy</option><option value="7">7 días</option><option value="30">30 días</option></select><select name="source" defaultValue={source ?? ""} className="min-w-0 bg-white border border-zinc-200 rounded-lg px-3 py-2.5"><option value="">Toda fuente</option>{SOURCES.map(item => <option key={item}>{item}</option>)}</select><select name="campaign" defaultValue={campaign ?? ""} className="col-span-2 min-w-0 bg-white border border-zinc-200 rounded-lg px-3 py-2.5"><option value="">Toda campaña</option>{data.campaigns.map(item => <option key={item}>{item}</option>)}</select><button className="col-span-2 rounded-lg bg-[#76582f] text-white px-4 py-2.5 font-bold hover:bg-[#624824]">Aplicar</button></form></header>
    {!data.configured && <div className="border border-amber-300 bg-amber-50 text-amber-900 text-xs p-3 rounded-xl">Supabase o las migraciones de adquisición aún no están configurados. El dashboard degrada sin romper WhatsApp.</div>}
    <section aria-label="Métricas prioritarias"><div className="mb-3"><p className="text-[10px] uppercase tracking-[.2em] text-[#76582f]">Pulso del periodo</p><h2 className="mt-1 text-lg font-bold text-zinc-900">Indicadores clave</h2></div><div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">{priorityKpis.map(kpi => <KpiCard key={kpi.label} {...kpi}/>)}</div></section>
    <FunnelVisual steps={funnel}/>
    <section className="grid lg:grid-cols-[1.15fr_.85fr] gap-5"><div className="min-w-0"><div className="flex justify-between mb-3"><div><p className="text-[10px] uppercase tracking-[.2em] text-[#76582f]">Actividad</p><h2 className="mt-1 text-lg font-bold text-zinc-900">Leads recientes</h2></div><Link href="/admin/leads" className="self-end text-[10px] text-[#76582f] whitespace-nowrap">Ver todos →</Link></div><div className="overflow-x-auto border border-zinc-200 bg-white rounded-2xl"><table className="w-full min-w-[36rem] text-xs"><thead className="bg-[#f7f5f0] text-zinc-600"><tr>{["Contacto", "Empresa", "Fuente", "Stage", "Actividad"].map(label => <th key={label} className="text-left font-normal px-3 py-3">{label}</th>)}</tr></thead><tbody>{data.recentLeads.map(lead => <tr key={lead.id} className="border-t border-zinc-200"><td className="px-3 py-3"><Link href={`/admin/leads/${lead.id}`} className="font-medium text-zinc-900">{lead.nombre_contacto || maskPhone(lead.numero)}</Link></td><td className="px-3 py-3 text-zinc-600">{lead.nombre_empresa || "—"}</td><td className="px-3 py-3 text-zinc-600">{lead.source || "Sin atribución"}</td><td className="px-3 py-3 text-blue-800">{lead.stage}</td><td className="px-3 py-3 text-zinc-500">{new Date(lead.ultima_interaccion).toLocaleDateString("es-MX")}</td></tr>)}</tbody></table>{!data.recentLeads.length && <p className="p-6 text-center text-xs text-zinc-500">Sin leads en este rango.</p>}</div></div>
      <div><div className="mb-3"><p className="text-[10px] uppercase tracking-[.2em] text-[#76582f]">Fuentes externas</p><h2 className="mt-1 text-lg font-bold text-zinc-900">Sincronización</h2></div><div className="space-y-3">{data.adsSyncStatuses.map(item => { const name = item.platform === "google" ? "Google Ads" : "ChatGPT Ads"; const tone = item.status === "synced" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : item.status === "error" ? "text-red-700 bg-red-50 border-red-200" : "text-amber-800 bg-amber-50 border-amber-200"; return <article key={item.platform} className={`border rounded-2xl p-4 ${tone}`}><div className="flex items-center justify-between gap-3"><h3 className="text-xs font-bold">{name}</h3><span className="text-[9px] uppercase tracking-wider">{ADS_SYNC_LABELS[item.status]}</span></div><p className="text-[10px] mt-2">Actualizado: {formatMexicoCityTimestamp(item.lastSuccessAt)}</p>{item.platform === "chatgpt" && item.status === "pending" && <p className="text-[9px] mt-2 opacity-80">Captura manual disponible; API oficial pendiente.</p>}</article>; })}</div></div></section>
    <CampaignPerformance campaigns={campaignViews}/>
    <div className="rounded-2xl border border-zinc-200 bg-white p-4"><GoogleAdsSyncButton /></div>
    <CampaignMetricsForm rows={data.manualMetricRows}/>
  </div>;
}
