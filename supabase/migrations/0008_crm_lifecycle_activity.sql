-- CRM unificado: whatsapp_leads sigue siendo el contacto canónico.
-- RLS queda activo y sin políticas; todas las operaciones pasan por service role.

do $$ begin
  create type public.crm_commercial_stage as enum ('exploring', 'opportunity', 'qualified', 'proposal', 'won', 'lost');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.crm_contact_lifecycle as enum ('lead', 'client', 'former_client');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.crm_actor as enum ('groq', 'human', 'system');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.crm_proposal_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.crm_suggestion_status as enum ('pending', 'accepted', 'dismissed');
exception when duplicate_object then null;
end $$;

alter table public.whatsapp_leads
  add column if not exists lifecycle public.crm_contact_lifecycle not null default 'lead',
  add column if not exists high_intent_detected_at timestamptz,
  add column if not exists responsible text,
  add column if not exists converted_at timestamptz,
  add column if not exists converted_by text;

-- high_intent era una etapa; ahora es una señal y la etapa comercial es qualified.
update public.whatsapp_leads
set high_intent_detected_at = coalesce(high_intent_detected_at, updated_at, now()),
    requiere_humano = true
where stage::text = 'high_intent';

alter table public.whatsapp_leads alter column stage drop default;
alter table public.whatsapp_leads alter column stage type public.crm_commercial_stage
using (case when stage::text = 'high_intent' then 'qualified' else stage::text end)::public.crm_commercial_stage;
alter table public.whatsapp_leads alter column stage set default 'exploring'::public.crm_commercial_stage;

-- Reconciliar la tabla histórica de clientes sin duplicar contactos ni first-touch.
insert into public.whatsapp_leads (numero, nombre_empresa, resumen, lifecycle, stage, created_at, updated_at, ultima_interaccion)
select c.numero_whatsapp, c.nombre_negocio, c.contexto_negocio, 'client', 'won', c.created_at, now(), now()
from public.whatsapp_clientes c
where c.activo = true
on conflict (numero) do update
set lifecycle = 'client',
    stage = case when whatsapp_leads.stage::text = 'lost' then whatsapp_leads.stage else 'won'::public.crm_commercial_stage end,
    nombre_empresa = coalesce(whatsapp_leads.nombre_empresa, excluded.nombre_empresa),
    resumen = coalesce(whatsapp_leads.resumen, excluded.resumen),
    updated_at = now();

create index if not exists whatsapp_leads_lifecycle_stage_idx
  on public.whatsapp_leads (lifecycle, stage, ultima_interaccion desc);

create table if not exists public.crm_proposals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.whatsapp_leads(id) on delete cascade,
  external_key text not null unique,
  slug text not null unique,
  title text not null,
  content text not null,
  status public.crm_proposal_status not null default 'draft',
  value numeric(14,2),
  currency text,
  generated_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_proposals_contact_idx on public.crm_proposals (contact_id, updated_at desc);
alter table public.crm_proposals enable row level security;

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.whatsapp_leads(id) on delete cascade,
  event_type text not null,
  actor public.crm_actor not null,
  actor_user_id text,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);
create index if not exists crm_activities_contact_idx on public.crm_activities (contact_id, created_at desc);
alter table public.crm_activities enable row level security;

create table if not exists public.crm_suggestions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.whatsapp_leads(id) on delete cascade,
  suggestion_type text not null,
  status public.crm_suggestion_status not null default 'pending',
  reason text not null,
  proposal_id uuid references public.crm_proposals(id) on delete set null,
  created_by public.crm_actor not null default 'groq',
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists crm_suggestions_one_pending_idx
  on public.crm_suggestions (contact_id, suggestion_type) where status = 'pending';
alter table public.crm_suggestions enable row level security;

alter table public.whatsapp_requerimientos
  add column if not exists contact_id uuid references public.whatsapp_leads(id) on delete set null;
update public.whatsapp_requerimientos r
set contact_id = l.id
from public.whatsapp_leads l
where r.contact_id is null and r.numero_contacto = l.numero;
create index if not exists whatsapp_requerimientos_contact_idx
  on public.whatsapp_requerimientos (contact_id, created_at desc);

create or replace function public.crm_convert_contact(
  p_contact_id uuid,
  p_actor_user_id text,
  p_proposal_id uuid default null
) returns public.whatsapp_leads
language plpgsql security definer set search_path = public
as $$
declare
  previous public.whatsapp_leads;
  converted public.whatsapp_leads;
  event_key text;
begin
  select * into previous from public.whatsapp_leads where id = p_contact_id for update;
  if previous.id is null then raise exception 'contact_not_found'; end if;
  event_key := 'client-converted:' || p_contact_id::text;
  update public.whatsapp_leads
  set lifecycle = 'client', stage = 'won', converted_at = coalesce(converted_at, now()),
      converted_by = coalesce(converted_by, p_actor_user_id), updated_at = now()
  where id = p_contact_id returning * into converted;
  if p_proposal_id is not null then
    update public.crm_proposals set status = 'accepted', accepted_at = coalesce(accepted_at, now()), updated_at = now()
    where id = p_proposal_id and contact_id = p_contact_id;
    insert into public.crm_activities(contact_id,event_type,actor,actor_user_id,metadata,idempotency_key)
    values (p_contact_id,'proposal_accepted','human',p_actor_user_id,jsonb_build_object('proposal_id',p_proposal_id),'proposal-accepted:' || p_proposal_id::text)
    on conflict (idempotency_key) do nothing;
  end if;
  insert into public.crm_activities(contact_id,event_type,actor,actor_user_id,old_value,new_value,metadata,idempotency_key)
  values (p_contact_id,'client_converted','human',p_actor_user_id,
    jsonb_build_object('lifecycle',previous.lifecycle,'stage',previous.stage),
    jsonb_build_object('lifecycle','client','stage','won'),
    case when p_proposal_id is null then '{}'::jsonb else jsonb_build_object('proposal_id',p_proposal_id) end,
    event_key)
  on conflict (idempotency_key) do nothing;
  update public.crm_suggestions set status='accepted',resolved_by=p_actor_user_id,resolved_at=now(),updated_at=now()
  where contact_id=p_contact_id and suggestion_type='convert_to_client' and status='pending';
  return converted;
end $$;
revoke all on function public.crm_convert_contact(uuid,text,uuid) from public;
grant execute on function public.crm_convert_contact(uuid,text,uuid) to service_role;

create or replace function public.crm_apply_human_decision(
  p_contact_id uuid,
  p_decision text,
  p_actor_user_id text,
  p_idempotency_key text
) returns public.whatsapp_leads
language plpgsql security definer set search_path = public
as $$
declare previous public.whatsapp_leads; changed public.whatsapp_leads; event_name text;
begin
  select * into previous from public.whatsapp_leads where id=p_contact_id for update;
  if previous.id is null then raise exception 'contact_not_found'; end if;
  if p_decision='lost' then
    update public.whatsapp_leads set stage='lost',updated_at=now() where id=p_contact_id returning * into changed;
    event_name := 'stage_changed';
  elsif p_decision='former_client' and previous.lifecycle='client' then
    update public.whatsapp_leads set lifecycle='former_client',updated_at=now() where id=p_contact_id returning * into changed;
    event_name := 'lifecycle_changed';
  elsif p_decision='new_opportunity' and previous.lifecycle='client' then
    update public.whatsapp_leads set stage='opportunity',updated_at=now() where id=p_contact_id returning * into changed;
    event_name := 'stage_changed';
  else
    raise exception 'invalid_decision';
  end if;
  insert into public.crm_activities(contact_id,event_type,actor,actor_user_id,old_value,new_value,metadata,idempotency_key)
  values (p_contact_id,event_name,'human',p_actor_user_id,
    jsonb_build_object('lifecycle',previous.lifecycle,'stage',previous.stage),
    jsonb_build_object('lifecycle',changed.lifecycle,'stage',changed.stage),
    jsonb_build_object('decision',p_decision),'human-decision:' || p_idempotency_key)
  on conflict (idempotency_key) do nothing;
  return changed;
end $$;
revoke all on function public.crm_apply_human_decision(uuid,text,text,text) from public;
grant execute on function public.crm_apply_human_decision(uuid,text,text,text) to service_role;

create or replace function public.crm_log_requirement_update() returns trigger
language plpgsql security definer set search_path = public
as $$ begin
  if new.contact_id is not null and (old.estado is distinct from new.estado or old.prioridad is distinct from new.prioridad) then
    insert into public.crm_activities(contact_id,event_type,actor,old_value,new_value,metadata,idempotency_key)
    values (new.contact_id,'requirement_updated','system',
      jsonb_build_object('estado',old.estado,'prioridad',old.prioridad),
      jsonb_build_object('estado',new.estado,'prioridad',new.prioridad),
      jsonb_build_object('requirement_id',new.id),
      'requirement-updated:' || new.id::text || ':' || new.updated_at::text)
    on conflict (idempotency_key) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists crm_requirement_update_activity on public.whatsapp_requerimientos;
create trigger crm_requirement_update_activity after update on public.whatsapp_requerimientos
for each row execute function public.crm_log_requirement_update();
