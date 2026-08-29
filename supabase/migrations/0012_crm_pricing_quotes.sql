-- Fase 3: pricing persistente y quote drafts estructurados.
-- crm_proposals permanece como documento posterior; no se duplica ni reutiliza como cotización.

create table if not exists public.crm_pricing_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'MXN' check (currency ~ '^[A-Z]{3}$'),
  is_active boolean not null default false,
  contingency_pct numeric(7,4) not null default 0 check (contingency_pct between 0 and 100),
  tax_pct numeric(7,4) not null default 0 check (tax_pct between 0 and 100),
  tax_label text not null default 'Impuestos',
  fiscal_config jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists crm_pricing_one_active_idx
  on public.crm_pricing_profiles (is_active) where is_active = true;
alter table public.crm_pricing_profiles enable row level security;

create table if not exists public.crm_pricing_rates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.crm_pricing_profiles(id) on delete cascade,
  category text not null check (category in ('development','design','frontend','backend','api_integration','configuration','qa','infrastructure','ai_usage','third_party')),
  label text not null,
  unit text not null check (unit in ('hour','fixed','month','usage')),
  unit_label text not null,
  rate numeric(14,4) check (rate is null or rate >= 0),
  margin_pct numeric(7,4) not null default 0 check (margin_pct between 0 and 100),
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, category)
);
alter table public.crm_pricing_rates enable row level security;

do $$ begin
  create type public.crm_quote_status as enum ('draft');
exception when duplicate_object then null;
end $$;

create table if not exists public.crm_quotes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.whatsapp_leads(id) on delete cascade,
  pricing_profile_id uuid not null references public.crm_pricing_profiles(id),
  status public.crm_quote_status not null default 'draft',
  title text not null check (length(btrim(title)) > 0),
  scope text not null check (length(btrim(scope)) > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  notes text,
  risks jsonb not null default '[]'::jsonb,
  missing_requirements jsonb not null default '[]'::jsonb,
  pricing_snapshot jsonb not null,
  direct_cost numeric(14,2) not null default 0 check (direct_cost >= 0),
  external_cost numeric(14,2) not null default 0 check (external_cost >= 0),
  margin_amount numeric(14,2) not null default 0 check (margin_amount >= 0),
  contingency_amount numeric(14,2) not null default 0 check (contingency_amount >= 0),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  revision integer not null default 1,
  request_key text unique,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_quotes_contact_idx on public.crm_quotes(contact_id, updated_at desc);
alter table public.crm_quotes enable row level security;

create table if not exists public.crm_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.crm_quotes(id) on delete cascade,
  sort_order integer not null default 0,
  category text not null check (category in ('development','design','frontend','backend','api_integration','configuration','qa','infrastructure','ai_usage','third_party')),
  description text not null check (length(btrim(description)) > 0),
  unit text not null check (unit in ('hour','fixed','month','usage')),
  quantity numeric(14,4) not null default 0 check (quantity >= 0),
  hours numeric(14,4) not null default 0 check (hours >= 0),
  unit_rate numeric(14,4) not null check (unit_rate >= 0),
  direct_cost numeric(14,2) not null default 0 check (direct_cost >= 0),
  external_cost numeric(14,2) not null default 0 check (external_cost >= 0),
  margin_pct numeric(7,4) not null default 0 check (margin_pct between 0 and 100),
  margin_amount numeric(14,2) not null default 0 check (margin_amount >= 0),
  line_subtotal numeric(14,2) not null default 0 check (line_subtotal >= 0),
  notes text,
  source text not null default 'llm' check (source in ('llm','human')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_quote_items_quote_idx on public.crm_quote_items(quote_id, sort_order, created_at);
alter table public.crm_quote_items enable row level security;

create or replace function public.crm_create_quote_draft(
  p_contact_id uuid, p_profile_id uuid, p_request_key text, p_title text, p_scope text,
  p_currency text, p_notes text, p_risks jsonb, p_missing_requirements jsonb,
  p_pricing_snapshot jsonb, p_totals jsonb, p_items jsonb, p_actor_user_id text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare quote_id uuid; item jsonb;
begin
  select id into quote_id from crm_quotes where request_key=p_request_key;
  if quote_id is not null then return quote_id; end if;
  if not exists(select 1 from whatsapp_leads where id=p_contact_id) then raise exception 'contact_not_found'; end if;
  insert into crm_quotes(contact_id,pricing_profile_id,request_key,title,scope,currency,notes,risks,missing_requirements,pricing_snapshot,
    direct_cost,external_cost,margin_amount,contingency_amount,subtotal,tax_amount,total,created_by,updated_by)
  values(p_contact_id,p_profile_id,p_request_key,p_title,p_scope,p_currency,p_notes,coalesce(p_risks,'[]'),coalesce(p_missing_requirements,'[]'),p_pricing_snapshot,
    (p_totals->>'direct_cost')::numeric,(p_totals->>'external_cost')::numeric,(p_totals->>'margin_amount')::numeric,
    (p_totals->>'contingency_amount')::numeric,(p_totals->>'subtotal')::numeric,(p_totals->>'tax_amount')::numeric,(p_totals->>'total')::numeric,
    p_actor_user_id,p_actor_user_id) returning id into quote_id;
  for item in select value from jsonb_array_elements(p_items) loop
    insert into crm_quote_items(quote_id,sort_order,category,description,unit,quantity,hours,unit_rate,direct_cost,external_cost,margin_pct,margin_amount,line_subtotal,notes,source)
    values(quote_id,(item->>'sort_order')::integer,item->>'category',item->>'description',item->>'unit',(item->>'quantity')::numeric,
      (item->>'hours')::numeric,(item->>'unit_rate')::numeric,(item->>'direct_cost')::numeric,(item->>'external_cost')::numeric,
      (item->>'margin_pct')::numeric,(item->>'margin_amount')::numeric,(item->>'line_subtotal')::numeric,item->>'notes',coalesce(item->>'source','llm'));
  end loop;
  insert into crm_activities(contact_id,event_type,actor,actor_user_id,metadata,idempotency_key)
  values(p_contact_id,'quote_draft_created','human',p_actor_user_id,jsonb_build_object('quote_id',quote_id),'quote-created:'||quote_id);
  return quote_id;
end $$;
revoke all on function public.crm_create_quote_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text) from public;
grant execute on function public.crm_create_quote_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text) to service_role;

create or replace function public.crm_update_quote_draft(
  p_quote_id uuid, p_expected_revision integer, p_title text, p_scope text, p_notes text,
  p_totals jsonb, p_items jsonb, p_actor_user_id text
) returns integer
language plpgsql security definer set search_path = public
as $$
declare current_quote crm_quotes; item jsonb; next_revision integer;
begin
  select * into current_quote from crm_quotes where id=p_quote_id for update;
  if current_quote.id is null then raise exception 'quote_not_found'; end if;
  if current_quote.status <> 'draft' then raise exception 'quote_not_editable'; end if;
  if current_quote.revision <> p_expected_revision then raise exception 'quote_revision_conflict'; end if;
  next_revision := current_quote.revision + 1;
  update crm_quotes set title=p_title,scope=p_scope,notes=p_notes,
    direct_cost=(p_totals->>'direct_cost')::numeric,external_cost=(p_totals->>'external_cost')::numeric,
    margin_amount=(p_totals->>'margin_amount')::numeric,contingency_amount=(p_totals->>'contingency_amount')::numeric,
    subtotal=(p_totals->>'subtotal')::numeric,tax_amount=(p_totals->>'tax_amount')::numeric,total=(p_totals->>'total')::numeric,
    revision=next_revision,updated_by=p_actor_user_id,updated_at=now()
  where id=p_quote_id;
  delete from crm_quote_items where quote_id=p_quote_id;
  for item in select value from jsonb_array_elements(p_items) loop
    insert into crm_quote_items(quote_id,sort_order,category,description,unit,quantity,hours,unit_rate,direct_cost,external_cost,margin_pct,margin_amount,line_subtotal,notes,source)
    values(p_quote_id,(item->>'sort_order')::integer,item->>'category',item->>'description',item->>'unit',(item->>'quantity')::numeric,
      (item->>'hours')::numeric,(item->>'unit_rate')::numeric,(item->>'direct_cost')::numeric,(item->>'external_cost')::numeric,
      (item->>'margin_pct')::numeric,(item->>'margin_amount')::numeric,(item->>'line_subtotal')::numeric,item->>'notes','human');
  end loop;
  insert into crm_activities(contact_id,event_type,actor,actor_user_id,old_value,new_value,metadata,idempotency_key)
  values(current_quote.contact_id,'quote_edited','human',p_actor_user_id,jsonb_build_object('revision',current_quote.revision),jsonb_build_object('revision',next_revision),jsonb_build_object('quote_id',p_quote_id),'quote-edited:'||p_quote_id||':'||next_revision);
  insert into crm_activities(contact_id,event_type,actor,actor_user_id,metadata,idempotency_key)
  values(current_quote.contact_id,'quote_recalculated','system',p_actor_user_id,jsonb_build_object('quote_id',p_quote_id,'revision',next_revision),'quote-recalculated:'||p_quote_id||':'||next_revision);
  return next_revision;
end $$;
revoke all on function public.crm_update_quote_draft(uuid,integer,text,text,text,jsonb,jsonb,text) from public;
grant execute on function public.crm_update_quote_draft(uuid,integer,text,text,text,jsonb,jsonb,text) to service_role;

-- Estructura inicial sin precios inventados. El admin debe configurar rate antes de cotizar.
with profile as (
  insert into public.crm_pricing_profiles(name,currency,is_active)
  select 'Pricing principal Nasus','MXN',true
  where not exists (select 1 from public.crm_pricing_profiles)
  returning id
), active_profile as (
  select id from profile
  union all
  select id from public.crm_pricing_profiles where is_active=true
  limit 1
)
insert into public.crm_pricing_rates(profile_id,category,label,unit,unit_label,rate,margin_pct,sort_order)
select active_profile.id, seed.category, seed.label, seed.unit, seed.unit_label, null, 0, seed.sort_order
from active_profile cross join (values
  ('development','Desarrollo general','hour','hora',10),
  ('design','Diseño','hour','hora',20),
  ('frontend','Frontend','hour','hora',30),
  ('backend','Backend','hour','hora',40),
  ('api_integration','Integraciones API','hour','hora',50),
  ('configuration','Configuración','hour','hora',60),
  ('qa','QA y pruebas','hour','hora',70),
  ('infrastructure','Infraestructura','month','mes',80),
  ('ai_usage','Consumo IA / tokens','usage','unidad',90),
  ('third_party','Servicios de terceros','fixed','partida',100)
) as seed(category,label,unit,unit_label,sort_order)
on conflict(profile_id,category) do nothing;
