import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

export async function getCrmContactOptions() {
  const client = createServiceClient();
  if (!client) return [];
  const { data } = await client.from("whatsapp_leads")
    .select("id,nombre_contacto,nombre_empresa,numero,lifecycle,stage,resumen,sector")
    .order("ultima_interaccion", { ascending: false }).limit(2000);
  return (data ?? []).map(contact => ({ ...contact, nombre: contact.nombre_empresa || contact.nombre_contacto || contact.numero }));
}

export async function getCrmProposals() {
  const client = createServiceClient();
  if (!client) return [];
  const { data } = await client.from("crm_proposals")
    .select("id,contact_id,slug,title,status,value,currency,generated_at,sent_at,updated_at,whatsapp_leads(nombre_contacto,nombre_empresa,numero,lifecycle,stage)")
    .order("updated_at", { ascending: false }).limit(1000);
  return data ?? [];
}

export async function getCrmProposalBySlug(slug: string) {
  const client = createServiceClient();
  if (!client) return null;
  const { data } = await client.from("crm_proposals")
    .select("id,contact_id,slug,title,content,status,created_at,whatsapp_leads(nombre_contacto,nombre_empresa)")
    .eq("slug", slug).maybeSingle();
  return data;
}
