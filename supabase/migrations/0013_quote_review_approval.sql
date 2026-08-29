-- Fases 4 y 5: revisión técnica selectiva y aprobaciones versionadas/inmutables.

alter type public.crm_quote_status add value if not exists 'approved';

alter table public.crm_quotes
  add column if not exists version integer not null default 1,
  add column if not exists parent_quote_id uuid references public.crm_quotes(id),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text;
create unique index if not exists crm_quote_lineage_version_idx
  on public.crm_quotes ((coalesce(parent_quote_id,id)), version);

create table if not exists public.crm_quote_reviews (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.crm_quotes(id) on delete cascade,
  quote_revision integer not null,
  findings jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  missing_requirements jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  reviewer_provider text not null check (reviewer_provider in ('claude')),
  trigger_reasons jsonb not null default '[]'::jsonb,
  reviewed_at timestamptz not null,
  unique(quote_id, quote_revision, reviewer_provider)
);
alter table public.crm_quote_reviews enable row level security;

create table if not exists public.crm_quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.crm_quotes(id),
  root_quote_id uuid not null references public.crm_quotes(id),
  contact_id uuid not null references public.whatsapp_leads(id),
  version integer not null,
  snapshot jsonb not null,
  subtotal numeric(14,2) not null,
  contingency_amount numeric(14,2) not null,
  tax_amount numeric(14,2) not null,
  total numeric(14,2) not null,
  approved_at timestamptz not null,
  approved_by text not null,
  unique(root_quote_id, version)
);
alter table public.crm_quote_versions enable row level security;

create or replace function public.crm_create_quote_draft(
  p_contact_id uuid, p_profile_id uuid, p_request_key text, p_title text, p_scope text,
  p_currency text, p_notes text, p_risks jsonb, p_missing_requirements jsonb,
  p_pricing_snapshot jsonb, p_totals jsonb, p_items jsonb, p_actor_user_id text,
  p_review jsonb, p_review_reasons jsonb
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
  update crm_quotes set parent_quote_id=quote_id where id=quote_id;
  for item in select value from jsonb_array_elements(p_items) loop
    insert into crm_quote_items(quote_id,sort_order,category,description,unit,quantity,hours,unit_rate,direct_cost,external_cost,margin_pct,margin_amount,line_subtotal,notes,source)
    values(quote_id,(item->>'sort_order')::integer,item->>'category',item->>'description',item->>'unit',(item->>'quantity')::numeric,
      (item->>'hours')::numeric,(item->>'unit_rate')::numeric,(item->>'direct_cost')::numeric,(item->>'external_cost')::numeric,
      (item->>'margin_pct')::numeric,(item->>'margin_amount')::numeric,(item->>'line_subtotal')::numeric,item->>'notes',coalesce(item->>'source','llm'));
  end loop;
  if p_review is not null then
    insert into crm_quote_reviews(quote_id,quote_revision,findings,risks,missing_requirements,recommendations,reviewer_provider,trigger_reasons,reviewed_at)
    values(quote_id,1,coalesce(p_review->'findings','[]'),coalesce(p_review->'risks','[]'),coalesce(p_review->'missingRequirements','[]'),
      coalesce(p_review->'recommendations','[]'),p_review->>'reviewerProvider',coalesce(p_review_reasons,'[]'),(p_review->>'reviewedAt')::timestamptz);
    insert into crm_activities(contact_id,event_type,actor,actor_user_id,metadata,idempotency_key)
    values(p_contact_id,'quote_reviewed','system',p_actor_user_id,jsonb_build_object('quote_id',quote_id,'reviewer_provider',p_review->>'reviewerProvider','reasons',p_review_reasons),'quote-reviewed:'||quote_id||':1');
  end if;
  insert into crm_activities(contact_id,event_type,actor,actor_user_id,metadata,idempotency_key)
  values(p_contact_id,'quote_draft_created','human',p_actor_user_id,jsonb_build_object('quote_id',quote_id),'quote-created:'||quote_id);
  return quote_id;
end $$;
revoke all on function public.crm_create_quote_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb,jsonb) from public;
grant execute on function public.crm_create_quote_draft(uuid,uuid,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,text,jsonb,jsonb) to service_role;

create or replace function public.crm_approve_quote(
  p_quote_id uuid, p_expected_revision integer, p_actor_user_id text, p_approved_at timestamptz,
  p_totals jsonb, p_snapshot jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare q crm_quotes; version_id uuid; root_id uuid;
begin
  select * into q from crm_quotes where id=p_quote_id for update;
  if q.id is null then raise exception 'quote_not_found'; end if;
  if q.status <> 'draft' then raise exception 'quote_not_approvable'; end if;
  if q.revision <> p_expected_revision then raise exception 'quote_revision_conflict'; end if;
  root_id := coalesce(q.parent_quote_id,q.id);
  update crm_quotes set status='approved', approved_at=p_approved_at, approved_by=p_actor_user_id,
    direct_cost=(p_totals->>'direct_cost')::numeric,external_cost=(p_totals->>'external_cost')::numeric,
    margin_amount=(p_totals->>'margin_amount')::numeric,contingency_amount=(p_totals->>'contingency_amount')::numeric,
    subtotal=(p_totals->>'subtotal')::numeric,tax_amount=(p_totals->>'tax_amount')::numeric,total=(p_totals->>'total')::numeric,
    updated_by=p_actor_user_id,updated_at=now()
  where id=p_quote_id and status='draft' and revision=p_expected_revision;
  insert into crm_quote_versions(quote_id,root_quote_id,contact_id,version,snapshot,subtotal,contingency_amount,tax_amount,total,approved_at,approved_by)
  values(q.id,root_id,q.contact_id,q.version,p_snapshot,(p_totals->>'subtotal')::numeric,(p_totals->>'contingency_amount')::numeric,
    (p_totals->>'tax_amount')::numeric,(p_totals->>'total')::numeric,p_approved_at,p_actor_user_id) returning id into version_id;
  insert into crm_activities(contact_id,event_type,actor,actor_user_id,metadata,idempotency_key)
  values(q.contact_id,'quote_approved','human',p_actor_user_id,jsonb_build_object('quote_id',q.id,'version',q.version,'version_id',version_id),'quote-approved:'||q.id);
  return version_id;
end $$;
revoke all on function public.crm_approve_quote(uuid,integer,text,timestamptz,jsonb,jsonb) from public;
grant execute on function public.crm_approve_quote(uuid,integer,text,timestamptz,jsonb,jsonb) to service_role;

create or replace function public.crm_create_quote_revision(p_quote_id uuid, p_actor_user_id text) returns uuid
language plpgsql security definer set search_path = public
as $$
declare source crm_quotes; new_id uuid; item crm_quote_items; root_id uuid; next_version integer;
begin
  select * into source from crm_quotes where id=p_quote_id for update;
  if source.id is null then raise exception 'quote_not_found'; end if;
  if source.status <> 'approved' then raise exception 'source_quote_not_approved'; end if;
  root_id := coalesce(source.parent_quote_id,source.id);
  select coalesce(max(version),0)+1 into next_version from crm_quotes where coalesce(parent_quote_id,id)=root_id;
  insert into crm_quotes(contact_id,pricing_profile_id,status,title,scope,currency,notes,risks,missing_requirements,pricing_snapshot,
    direct_cost,external_cost,margin_amount,contingency_amount,subtotal,tax_amount,total,revision,version,parent_quote_id,created_by,updated_by)
  values(source.contact_id,source.pricing_profile_id,'draft',source.title,source.scope,source.currency,source.notes,source.risks,source.missing_requirements,source.pricing_snapshot,
    source.direct_cost,source.external_cost,source.margin_amount,source.contingency_amount,source.subtotal,source.tax_amount,source.total,1,next_version,root_id,p_actor_user_id,p_actor_user_id)
  returning id into new_id;
  for item in select * from crm_quote_items where quote_id=source.id order by sort_order loop
    insert into crm_quote_items(quote_id,sort_order,category,description,unit,quantity,hours,unit_rate,direct_cost,external_cost,margin_pct,margin_amount,line_subtotal,notes,source)
    values(new_id,item.sort_order,item.category,item.description,item.unit,item.quantity,item.hours,item.unit_rate,item.direct_cost,item.external_cost,item.margin_pct,item.margin_amount,item.line_subtotal,item.notes,'human');
  end loop;
  insert into crm_activities(contact_id,event_type,actor,actor_user_id,metadata,idempotency_key)
  values(source.contact_id,'quote_revision_created','human',p_actor_user_id,jsonb_build_object('quote_id',new_id,'source_quote_id',source.id,'version',next_version),'quote-revision:'||source.id||':'||next_version);
  return new_id;
end $$;
revoke all on function public.crm_create_quote_revision(uuid,text) from public;
grant execute on function public.crm_create_quote_revision(uuid,text) to service_role;

-- Defense in depth: approved rows cannot be changed or deleted, even by a future code path.
create or replace function public.crm_guard_approved_quote() returns trigger language plpgsql as $$
begin
  if old.status='approved' then raise exception 'approved_quote_immutable'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists crm_guard_approved_quote_update on public.crm_quotes;
create trigger crm_guard_approved_quote_update before update or delete on public.crm_quotes
for each row execute function public.crm_guard_approved_quote();

create or replace function public.crm_guard_approved_quote_item() returns trigger language plpgsql as $$
declare owning_quote uuid; owning_status public.crm_quote_status;
begin
  owning_quote := case when tg_op='INSERT' then new.quote_id else old.quote_id end;
  select status into owning_status from crm_quotes where id=owning_quote;
  if owning_status='approved' then raise exception 'approved_quote_items_immutable'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists crm_guard_approved_quote_item_write on public.crm_quote_items;
create trigger crm_guard_approved_quote_item_write before insert or update or delete on public.crm_quote_items
for each row execute function public.crm_guard_approved_quote_item();
