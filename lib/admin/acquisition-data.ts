import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

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
  const empty = { configured: false, visits: 0, whatsappClicks: 0, conversations: 0, leads: 0, qualified: 0, highIntent: 0, campaigns: [] as string[], recentLeads: [] as AdminLead[], allLeads: [] as AdminLead[] };
  if (!supabase) return empty;
  const from = since(filters.days);
  const [eventsResult, leadsResult, messagesResult] = await Promise.all([
    supabase.from("acquisition_events").select("event_type,session_id,source,campaign").gte("created_at", from).limit(10000),
    supabase.from("whatsapp_leads").select("id,numero,nombre_contacto,nombre_empresa,sector,stage,problema_descrito,servicio_probable,resumen,requiere_humano,ultima_interaccion,acquisition_event_id,acquisition_events(source,medium,campaign)").gte("ultima_interaccion", from).order("ultima_interaccion", { ascending: false }).limit(1000),
    supabase.from("whatsapp_mensajes").select("conversation_id,numero").eq("direccion", "entrante").gte("created_at", from).limit(10000),
  ]);
  if (eventsResult.error || leadsResult.error || messagesResult.error) return empty;
  const allEvents = eventsResult.data ?? [];
  const events = allEvents.filter((e) => (!filters.source || e.source === filters.source) && (!filters.campaign || e.campaign === filters.campaign));
  const leads: AdminLead[] = (leadsResult.data ?? []).map((row: any) => {
    const attribution = Array.isArray(row.acquisition_events) ? row.acquisition_events[0] : row.acquisition_events;
    return { ...row, source: attribution?.source ?? null, medium: attribution?.medium ?? null, campaign: attribution?.campaign ?? null };
  }).filter((lead) => (!filters.source || lead.source === filters.source) && (!filters.campaign || lead.campaign === filters.campaign));
  const attributedNumbers = new Set(leads.map((lead) => lead.numero));
  const conversations = new Set((messagesResult.data ?? []).filter((m) => !filters.source && !filters.campaign || attributedNumbers.has(m.numero)).map((m) => m.conversation_id)).size;
  return {
    configured: true,
    visits: new Set(events.filter((e) => e.event_type === "page_view").map((e) => e.session_id)).size,
    whatsappClicks: events.filter((e) => e.event_type === "whatsapp_click").length,
    conversations,
    leads: leads.length,
    qualified: leads.filter((l) => l.stage === "qualified").length,
    highIntent: leads.filter((l) => l.stage === "high_intent").length,
    campaigns: [...new Set(allEvents.map((e) => e.campaign).filter(Boolean) as string[])].sort(),
    recentLeads: leads.slice(0, 8),
    allLeads: leads,
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
