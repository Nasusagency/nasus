-- Master Agent administrativo. Reutiliza whatsapp_leads como contacto canónico.

alter table public.whatsapp_conversations
  add column if not exists master_state jsonb;

alter table public.whatsapp_leads
  add column if not exists origin_source text;

alter table public.crm_activities
  add column if not exists source text;

create index if not exists whatsapp_leads_name_lookup_idx
  on public.whatsapp_leads using gin (
    (to_tsvector('simple', coalesce(nombre_contacto, '') || ' ' || coalesce(nombre_empresa, '')))
  );

comment on column public.whatsapp_conversations.master_state is
  'Estado efímero del Master Agent: aclaración o acción sensible pendiente de confirmación.';
comment on column public.whatsapp_leads.origin_source is
  'Fuente operativa de creación cuando no existe first-touch atribuible.';
comment on column public.crm_activities.source is
  'Canal donde se observó o registró el evento (manual_whatsapp, admin, web, etc.).';
