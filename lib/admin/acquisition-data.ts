import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { calculateCampaignEfficiency, sumKnown, type NullableNumber } from "@/lib/acquisition/costs";

export type DashboardFilters = { days: number; source?: string; campaign?: string; stage?: string; human?: boolean };
export type AdminLead = {
  id: string; numero: string; nombre_contacto: string | null; nombre_empresa: string | null; sector: string | null;
  stage: string; problema_descrito: string | null; servicio_probable: string | null; resumen: string | null;
  requiere_humano: boolean; ultima_interaccion: string; acquisition_event_id: string | null;
  source: string | null; campaign: string | null; medium: string | null;
};

const since = (days: number) => new Date(Date.now() - Math.max(1, Math.min(days, 365)) * 86400000).toISOString();

export async function getAcquisitionDashboard(filters: DashboardFilters) {
  const supabase = createServiceClient();
  const empty = { configured: false, visits: 0, whatsappClicks: 0, conversations: 0, leads: 0, qualified: 0, highIntent: 0, campaigns: [] as string[], recentLeads: [] as AdminLead[], allLeads: [] as AdminLead[], impressions: null as NullableNumber, adClicks: null as NullableNumber, spend: null as NullableNumber, currency: null as string | null, campaignPerformance: [] as any[] };
  if (!supabase) return empty;
  const from = since(filters.days);
  const [eventsResult, leadsResult, messagesResult, metricsResult] = await Promise.all([
    supabase.from("acquisition_events").select("event_type,session_id,source,campaign").gte("created_at", from).limit(10000),
    supabase.from("whatsapp_leads").select("id,numero,nombre_contacto,nombre_empresa,sector,stage,problema_descrito,servicio_probable,resumen,requiere_humano,ultima_interaccion,acquisition_event_id,acquisition_events(source,medium,campaign)").gte("ultima_interaccion", from).order("ultima_interaccion", { ascending: false }).limit(1000),
    supabase.from("whatsapp_mensajes").select("conversation_id,numero").eq("direccion", "entrante").gte("created_at", from).limit(10000),
    supabase.from("acquisition_campaign_metrics").select("id,platform,campaign,metric_date,impressions,ad_clicks,spend,currency,daily_budget,total_budget,source_type").gte("metric_date", from.slice(0, 10)).order("metric_date", { ascending: false }).limit(5000),
  ]);
  if (eventsResult.error || leadsResult.error || messagesResult.error || metricsResult.error) return empty;
  const allEvents = eventsResult.data ?? [];
  const events = allEvents.filter((e) => (!filters.source || e.source === filters.source) && (!filters.campaign || e.campaign === filters.campaign));
  const leads: AdminLead[] = (leadsResult.data ?? []).map((row: any) => {
    const attribution = Array.isArray(row.acquisition_events) ? row.acquisition_events[0] : row.acquisition_events;
    return { ...row, source: attribution?.source ?? null, medium: attribution?.medium ?? null, campaign: attribution?.campaign ?? null };
  }).filter((lead) => (!filters.source || lead.source === filters.source) && (!filters.campaign || lead.campaign === filters.campaign));
  const attributedNumbers = new Set(leads.map((lead) => lead.numero));
  const conversations = new Set((messagesResult.data ?? []).filter((m) => !filters.source && !filters.campaign || attributedNumbers.has(m.numero)).map((m) => m.conversation_id)).size;
  const metricRows = (metricsResult.data ?? []).filter((row) => (!filters.source || row.platform === filters.source) && (!filters.campaign || row.campaign === filters.campaign));
  const keys = new Set<string>();
  metricRows.forEach(row => keys.add(`${row.platform}::${row.campaign}::${row.currency}`));
  events.filter(e => e.campaign).forEach(e => keys.add(`${e.source ?? "otros"}::${e.campaign}::${metricRows.find(r => r.platform === e.source && r.campaign === e.campaign)?.currency ?? "MXN"}`));
  const campaignPerformance = [...keys].map(key => {
    const [platform, campaignName, currency] = key.split("::");
    const rows = metricRows.filter(r => r.platform === platform && r.campaign === campaignName && r.currency === currency);
    const ownedEvents = events.filter(e => e.source === platform && e.campaign === campaignName);
    const campaignLeads = leads.filter(l => l.source === platform && l.campaign === campaignName);
    const numbers = new Set(campaignLeads.map(l => l.numero));
    const owned = {
      visits: new Set(ownedEvents.filter(e => e.event_type === "page_view").map(e => e.session_id)).size,
      whatsappClicks: ownedEvents.filter(e => e.event_type === "whatsapp_click").length,
      conversations: new Set((messagesResult.data ?? []).filter(m => numbers.has(m.numero)).map(m => m.conversation_id)).size,
      leads: campaignLeads.length, qualified: campaignLeads.filter(l => l.stage === "qualified").length, highIntent: campaignLeads.filter(l => l.stage === "high_intent").length,
    };
    const external = { impressions: sumKnown(rows.map(r => r.impressions === null ? null : Number(r.impressions))), adClicks: sumKnown(rows.map(r => r.ad_clicks === null ? null : Number(r.ad_clicks))), spend: sumKnown(rows.map(r => r.spend === null ? null : Number(r.spend))) };
    return { platform, campaign: campaignName, currency, rows, ...owned, ...external, ...calculateCampaignEfficiency({ ...external, ...owned }) };
  }).sort((a, b) => (b.spend ?? -1) - (a.spend ?? -1));
  const currencies = new Set(metricRows.filter(r => r.spend !== null).map(r => r.currency));
  return {
    configured: true,
    visits: new Set(events.filter((e) => e.event_type === "page_view").map((e) => e.session_id)).size,
    whatsappClicks: events.filter((e) => e.event_type === "whatsapp_click").length,
    conversations,
    leads: leads.length,
    qualified: leads.filter((l) => l.stage === "qualified").length,
    highIntent: leads.filter((l) => l.stage === "high_intent").length,
    campaigns: [...new Set([...(allEvents.map((e) => e.campaign).filter(Boolean) as string[]), ...((metricsResult.data ?? []).map(row => row.campaign))])].sort(),
    recentLeads: leads.slice(0, 8),
    allLeads: leads,
    impressions: sumKnown(metricRows.map(r => r.impressions === null ? null : Number(r.impressions))),
    adClicks: sumKnown(metricRows.map(r => r.ad_clicks === null ? null : Number(r.ad_clicks))),
    spend: currencies.size <= 1 ? sumKnown(metricRows.map(r => r.spend === null ? null : Number(r.spend))) : null,
    currency: currencies.size === 1 ? [...currencies][0] : null,
    campaignPerformance,
  };
}

export async function getAdminLeads(filters: DashboardFilters): Promise<AdminLead[]> {
  const data = await getAcquisitionDashboard(filters);
  return data.allLeads.filter((lead) => (!filters.stage || lead.stage === filters.stage) && (!filters.human || lead.requiere_humano));
}

export async function getAdminLead(id: string) {
  const supabase = createServiceClient();
  if (!supabase) return null;
  const { data: lead } = await supabase.from("whatsapp_leads")
    .select("id,numero,nombre_contacto,nombre_empresa,sector,stage,problema_descrito,servicio_probable,resumen,requiere_humano,razon_handoff,ultima_interaccion,created_at,acquisition_event_id,acquisition_events(attribution_id,source,medium,campaign,content,term,landing_path,created_at)")
    .eq("id", id).maybeSingle();
  if (!lead) return null;
  const [messages, requirements] = await Promise.all([
    supabase.from("whatsapp_mensajes").select("id,direccion,contenido,created_at").eq("numero", lead.numero).order("created_at", { ascending: false }).limit(20),
    supabase.from("whatsapp_requerimientos").select("id,tipo,resumen,prioridad,estado,created_at").eq("numero_contacto", lead.numero).order("created_at", { ascending: false }).limit(20),
  ]);
  return { lead, messages: messages.data ?? [], requirements: requirements.data ?? [] };
}
