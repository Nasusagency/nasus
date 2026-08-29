-- Observación pasiva event-driven durante handoff humano.

alter table public.whatsapp_requerimientos
  add column if not exists source text,
  add column if not exists source_message_id text;

create unique index if not exists whatsapp_requerimientos_source_message_key
  on public.whatsapp_requerimientos (source_message_id)
  where source_message_id is not null;

comment on column public.whatsapp_requerimientos.source_message_id is
  'Identificador durable del mensaje que originó el requerimiento; evita duplicados en retries.';
