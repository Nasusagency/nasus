import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { calculateCampaignEfficiency, campaignMetricRange, sumKnown, type NullableNumber } from "@/lib/acquisition/costs";
import { selectPreferredMetricRows } from "@/lib/acquisition/campaign-metrics";
import { defaultAdsSyncStatuses, type AdsPlatform, type AdsSyncState } from "@/lib/acquisition/sync-status";

export type DashboardFilters = { days: number; source?: string; campaign?: string; stage?: string; lifecycle?: string; human?: boolean };
export type AdminLead = {
  id: string; numero: string; nombre_contacto: string | null; nombre_empresa: string | null; sector: string | null;
  lifecycle: string; stage: string; high_intent_detected_at: string | null; problema_descrito: string | null; servicio_probable: string | null; resumen: string | null;
  requiere_humano: boolean; ultima_interaccion: string; acquisition_event_id: string | null;
  source: string | null; campaign: string | null; medium: string | null;
};

const since = (days: number) => new Date(Date.now() - Math.max(1, Math.min(days, 365)) * 86400000).toISOString();

export async function getAcquisitionDashboard(filters: DashboardFilters) {
  const supabase = createServiceClient();
  const empty = { configured: false, visits: 0, whatsappClicks: 0, conversations: 0, leads: 0, qualified: 0, highIntent: 0, campaigns: [] as string[], recentLeads: [] as AdminLead[], allLeads: [] as AdminLead[], impressions: null as NullableNumber, adClicks: null as NullableNumber, spend: null as NullableNumber, currency: null as string | null, campaignPerformance: [] as any[], manualMetricRows: [] as any[], adsSyncStatuses: defaultAdsSyncStatuses() };
  if (!supabase) return empty;
  const from = since(filters.days);
  const [eventsResult, leadsResult, messagesResult, metricsResult, syncStatusesResult] = await Promise.all([
    supabase.from("acquisition_events").select("event_type,session_id,source,campaign").gte("created_at", from).limit(10000),
    supabase.from("whatsapp_leads").select("id,numero,nombre_contacto,nombre_empresa,sector,lifecycle,stage,high_intent_detected_at,problema_descrito,servicio_probable,resumen,requiere_humano,ultima_interaccion,acquisition_event_id,acquisition_events(source,medium,campaign)").gte("ultima_interaccion", from).order("ultima_interaccion", { ascending: false }).limit(1000),
    supabase.from("whatsapp_mensajes").select("conversation_id,numero").eq("direccion", "entrante").gte("created_at", from).limit(10000),
    supabase.from("acquisition_campaign_metrics").select("id,platform,campaign,metric_date,impressions,ad_clicks,spend,currency,daily_budget,total_budget,source_type").gte("metric_date", from.slice(0, 10)).order("metric_date", { ascending: false }).limit(5000),
    supabase.from("acquisition_ads_sync_status").select("platform,status,last_success_at,last_attempt_at,last_error_code").in("platform", ["google", "chatgpt"]),
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
  const allMetricRows = (metricsResult.data ?? []).filter((row) => (!filters.source || row.platform === filters.source) && (!filters.campaign || row.campaign === filters.campaign));
  const metricRows = selectPreferredMetricRows(allMetricRows);
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
      leads: campaignLeads.length, qualified: campaignLeads.filter(l => l.stage === "qualified").length, highIntent: campaignLeads.filter(l => Boolean(l.high_intent_detected_at)).length,
    };
    const external = { impressions: sumKnown(rows.map(r => r.impressions === null ? null : Number(r.impressions))), adClicks: sumKnown(rows.map(r => r.ad_clicks === null ? null : Number(r.ad_clicks))), spend: sumKnown(rows.map(r => r.spend === null ? null : Number(r.spend))) };
    return { platform, campaign: campaignName, currency, rows, ...owned, ...external, ...calculateCampaignEfficiency({ ...external, ...owned }) };
  }).sort((a, b) => (b.spend ?? -1) - (a.spend ?? -1));
  const currencies = new Set(metricRows.filter(r => r.spend !== null).map(r => r.currency));
  const statusRows = syncStatusesResult.data ?? [];
  const adsSyncStatuses = defaultAdsSyncStatuses().map(fallback => {
    const row = statusRows.find(item => item.platform === fallback.platform);
    return row ? { platform: row.platform as AdsPlatform, status: row.status as AdsSyncState, lastSuccessAt: row.last_success_at, lastAttemptAt: row.last_attempt_at, lastErrorCode: row.last_error_code } : fallback;
  });
  return {
    configured: true,
    visits: new Set(events.filter((e) => e.event_type === "page_view").map((e) => e.session_id)).size,
    whatsappClicks: events.filter((e) => e.event_type === "whatsapp_click").length,
    conversations,
    leads: leads.length,
    qualified: leads.filter((l) => l.stage === "qualified").length,
    highIntent: leads.filter((l) => Boolean(l.high_intent_detected_at)).length,
    campaigns: [...new Set([...(allEvents.map((e) => e.campaign).filter(Boolean) as string[]), ...((metricsResult.data ?? []).map(row => row.campaign))])].sort(),
    recentLeads: leads.slice(0, 8),
    allLeads: leads,
    manualMetricRows: allMetricRows.filter(row => row.source_type === "manual"),
    impressions: sumKnown(metricRows.map(r => r.impressions === null ? null : Number(r.impressions))),
    adClicks: sumKnown(metricRows.map(r => r.ad_clicks === null ? null : Number(r.ad_clicks))),
    spend: currencies.size <= 1 ? sumKnown(metricRows.map(r => r.spend === null ? null : Number(r.spend))) : null,
    currency: currencies.size === 1 ? [...currencies][0] : null,
    campaignPerformance,
    adsSyncStatuses,
  };
}

export async function getAdminLeads(filters: DashboardFilters): Promise<AdminLead[]> {
  const data = await getAcquisitionDashboard(filters);
  return data.allLeads.filter((lead) => (!filters.stage || lead.stage === filters.stage) && (!filters.lifecycle || lead.lifecycle === filters.lifecycle) && (!filters.human || lead.requiere_humano));
}

export async function getAdminLead(id: string) {
  const supabase = createServiceClient();
  if (!supabase) return null;
  const { data: lead } = await supabase.from("whatsapp_leads")
    .select("id,numero,nombre_contacto,nombre_empresa,sector,lifecycle,stage,high_intent_detected_at,responsible,converted_at,converted_by,problema_descrito,servicio_probable,resumen,requiere_humano,razon_handoff,ultima_interaccion,created_at,acquisition_event_id,acquisition_events(attribution_id,session_id,source,medium,campaign,content,term,landing_path,created_at)")
    .eq("id", id).maybeSingle();
  if (!lead) return null;
  const attribution: any = Array.isArray(lead.acquisition_events) ? lead.acquisition_events[0] : lead.acquisition_events;
  const [messages, requirements, proposals, activities, suggestions, conversations, firstMessage, sessionEvents, metricRows] = await Promise.all([
    supabase.from("whatsapp_mensajes").select("id,direccion,contenido,created_at").eq("numero", lead.numero).order("created_at", { ascending: false }).limit(20),
    supabase.from("whatsapp_requerimientos").select("id,tipo,resumen,prioridad,estado,created_at").eq("numero_contacto", lead.numero).order("created_at", { ascending: false }).limit(20),
    supabase.from("crm_proposals").select("id,slug,title,status,value,currency,generated_at,sent_at,updated_at").eq("contact_id", lead.id).order("updated_at", { ascending: false }).limit(20),
    supabase.from("crm_activities").select("id,event_type,actor,actor_user_id,old_value,new_value,metadata,created_at").eq("contact_id", lead.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("crm_suggestions").select("id,suggestion_type,status,reason,proposal_id,created_at").eq("contact_id", lead.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("whatsapp_conversations").select("conversation_id,mode,status,updated_at").eq("numero", lead.numero).order("updated_at", { ascending: false }).limit(100),
    supabase.from("whatsapp_mensajes").select("created_at").eq("numero", lead.numero).eq("direccion", "entrante").order("created_at", { ascending: true }).limit(1).maybeSingle(),
    attribution?.session_id ? supabase.from("acquisition_events").select("event_type,session_id,created_at").eq("session_id", attribution.session_id).order("created_at", { ascending: true }).limit(10000) : Promise.resolve({ data: [] }),
    attribution?.source && attribution?.campaign ? supabase.from("acquisition_campaign_metrics").select("platform,campaign,metric_date,impressions,ad_clicks,spend,currency,source_type").eq("platform", attribution.source).eq("campaign", attribution.campaign).order("metric_date", { ascending: true }).limit(5000) : Promise.resolve({ data: [] }),
  ]);
  const rows: any[] = selectPreferredMetricRows(metricRows.data ?? []);
  let campaignPerformance = null;
  if (rows.length > 0 && attribution?.source && attribution?.campaign) {
    const metricRange = campaignMetricRange(rows)!;
    const rangeStart = `${metricRange.start}T00:00:00.000Z`;
    const rangeEnd = new Date(`${metricRange.end}T00:00:00.000Z`); rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
    const [campaignEventsResult, campaignLeadsResult] = await Promise.all([
      supabase.from("acquisition_events").select("event_type,session_id").eq("source", attribution.source).eq("campaign", attribution.campaign).gte("created_at", rangeStart).lt("created_at", rangeEnd.toISOString()).limit(10000),
      supabase.from("whatsapp_leads").select("numero,stage,high_intent_detected_at,acquisition_events!inner(source,campaign)").eq("acquisition_events.source", attribution.source).eq("acquisition_events.campaign", attribution.campaign).gte("created_at", rangeStart).lt("created_at", rangeEnd.toISOString()).limit(5000),
    ]);
    const campaignLeads: any[] = campaignLeadsResult.data ?? []; const numbers = campaignLeads.map(item => item.numero);
    const campaignMessages = numbers.length ? await supabase.from("whatsapp_mensajes").select("conversation_id").in("numero", numbers).eq("direccion", "entrante").gte("created_at", rangeStart).lt("created_at", rangeEnd.toISOString()).limit(10000) : { data: [] };
    const campaignEvents = campaignEventsResult.data ?? [];
    const currencies = new Set(rows.filter(row => row.spend !== null).map(row => row.currency));
    const external = { impressions: sumKnown(rows.map(row => row.impressions === null ? null : Number(row.impressions))), adClicks: sumKnown(rows.map(row => row.ad_clicks === null ? null : Number(row.ad_clicks))), spend: currencies.size <= 1 ? sumKnown(rows.map(row => row.spend === null ? null : Number(row.spend))) : null };
    const owned = { visits: new Set(campaignEvents.filter(event => event.event_type === "page_view").map(event => event.session_id)).size, whatsappClicks: campaignEvents.filter(event => event.event_type === "whatsapp_click").length, conversations: new Set((campaignMessages.data ?? []).map(message => message.conversation_id)).size, leads: campaignLeads.length, qualified: campaignLeads.filter(item => item.stage === "qualified").length, highIntent: campaignLeads.filter(item => Boolean(item.high_intent_detected_at)).length };
    campaignPerformance = { ...external, ...owned, currency: rows[0].currency, sourceTypes: [...new Set(rows.map(row => row.source_type))], rangeStart: metricRange.start, rangeEnd: metricRange.end, ...calculateCampaignEfficiency({ ...external, ...owned }) };
  }
  const exactEvents: any[] = sessionEvents.data ?? [];
  return { lead, messages: messages.data ?? [], requirements: requirements.data ?? [], proposals: proposals.data ?? [], activities: activities.data ?? [], suggestions: suggestions.data ?? [], conversations: conversations.data ?? [], acquisition: { attribution, firstInteractionAt: firstMessage.data?.created_at ?? null, sessions: exactEvents.some(event => event.event_type === "page_view") ? new Set(exactEvents.map(event => event.session_id)).size : null, pageViews: exactEvents.filter(event => event.event_type === "page_view").length, whatsappClicks: exactEvents.filter(event => event.event_type === "whatsapp_click").length, conversationStarted: Boolean(firstMessage.data), campaignPerformance } };
}
