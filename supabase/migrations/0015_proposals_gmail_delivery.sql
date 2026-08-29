-- Fases 6 y 7: propuestas desde snapshots aprobados y delivery Gmail trazable.

create table if not exists public.crm_proposal_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default false,
  validity_days integer not null default 15 check (validity_days between 1 and 365),
  payment_terms text not null,
  intellectual_property text not null,
  confidentiality text not null,
  support_maintenance text not null,
  cancellation text not null,
  scope_changes text not null,
  exclusions text not null,
  jurisdiction text,
  legal_approved boolean not null default false,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists crm_proposal_template_active_idx on public.crm_proposal_templates(is_active) where is_active=true;
alter table public.crm_proposal_templates enable row level security;

alter table public.crm_proposals
  add column if not exists quote_id uuid references public.crm_quotes(id),
  add column if not exists quote_version_id uuid references public.crm_quote_versions(id),
  add column if not exists proposal_version integer not null default 1,
  add column if not exists parent_proposal_id uuid references public.crm_proposals(id),
  add column if not exists structured_content jsonb not null default '{}'::jsonb,
  add column if not exists terms_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists ready_for_delivery boolean not null default false,
  add column if not exists recipient_email text,
  add column if not exists delivery_provider text,
  add column if not exists external_message_id text,
  add column if not exists external_thread_id text,
  add column if not exists last_sync_at timestamptz;
create unique index if not exists crm_proposal_quote_version_idx on public.crm_proposals(quote_version_id,proposal_version);

create table if not exists public.crm_proposal_deliveries (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.crm_proposals(id),
  proposal_version integer not null,
  idempotency_key text not null unique,
  provider text not null,
  recipient text not null,
  message_id text,
  thread_id text,
  status text not null check (status in ('pending','sent','failed')),
  error_code text,
  sent_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crm_proposal_deliveries enable row level security;

insert into public.crm_proposal_templates(name,is_active,payment_terms,intellectual_property,confidentiality,support_maintenance,cancellation,scope_changes,exclusions,jurisdiction,legal_approved)
select 'Términos comerciales neutrales',true,
  '[REQUIERE REVISIÓN HUMANA] Definir calendario y condiciones de pago.',
  '[REQUIERE REVISIÓN HUMANA] Definir titularidad y licencias de entregables.',
  '[REQUIERE REVISIÓN HUMANA] Definir obligaciones de confidencialidad.',
  '[REQUIERE REVISIÓN HUMANA] Definir soporte, mantenimiento y niveles de servicio.',
  '[REQUIERE REVISIÓN HUMANA] Definir condiciones de cancelación.',
  'Los cambios fuera del alcance aprobado requieren una nueva estimación y autorización.',
  'No se incluyen trabajos ni servicios que no estén descritos en el alcance aprobado.',
  null,false
where not exists(select 1 from public.crm_proposal_templates);
