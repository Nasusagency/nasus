-- Métricas propias y correlación web -> WhatsApp -> lead. Sin PII del navegador.
create table if not exists public.acquisition_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('page_view', 'whatsapp_click', 'assistant_demo_click')),
  attribution_id text unique,
  session_id text not null,
  source text,
  medium text,
  campaign text,
  content text,
  term text,
  landing_path text not null,
  referrer text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists acquisition_events_created_idx on public.acquisition_events (created_at desc);
create index if not exists acquisition_events_funnel_idx on public.acquisition_events (event_type, source, campaign, created_at desc);
alter table public.acquisition_events enable row level security;
-- Sin políticas: lectura/escritura sólo mediante service role server-side.

alter table if exists public.whatsapp_leads
  add column if not exists acquisition_event_id uuid references public.acquisition_events(id) on delete set null;
create index if not exists whatsapp_leads_acquisition_idx on public.whatsapp_leads (acquisition_event_id)
  where acquisition_event_id is not null;
