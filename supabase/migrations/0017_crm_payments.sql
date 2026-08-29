-- Fase 8: modelo de pagos provider-neutral. El CRM nunca decide el status final de un pago:
-- lo confirma solo un webhook firmado del proveedor (o su API de consulta), nunca el redirect
-- del navegador ni el LLM.

create table if not exists public.crm_payments (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.whatsapp_leads(id) on delete cascade,
  proposal_id uuid references public.crm_proposals(id),
  quote_id uuid references public.crm_quotes(id),
  quote_version_id uuid references public.crm_quote_versions(id),
  provider text not null,
  provider_payment_id text,
  external_reference text not null unique,
  amount numeric not null check (amount > 0),
  currency text not null default 'MXN',
  status text not null check (status in ('pending','paid','failed','cancelled','refunded')) default 'pending',
  payment_url text,
  description text not null,
  due_at timestamptz,
  paid_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists crm_payments_provider_payment_idx on public.crm_payments(provider, provider_payment_id) where provider_payment_id is not null;
create index if not exists crm_payments_contact_idx on public.crm_payments(contact_id, created_at desc);
create index if not exists crm_payments_proposal_idx on public.crm_payments(proposal_id);
alter table public.crm_payments enable row level security;

-- Crea un pago pendiente de forma idempotente (external_reference único evita duplicados si
-- el admin reintenta el request). Devuelve la fila completa para que el caller arme el checkout.
create or replace function public.crm_create_payment(
  p_contact_id uuid, p_proposal_id uuid, p_quote_id uuid, p_quote_version_id uuid,
  p_provider text, p_external_reference text, p_amount numeric, p_currency text,
  p_description text, p_due_at timestamptz, p_actor_user_id text
) returns crm_payments
language plpgsql security definer set search_path = public
as $$
declare payment crm_payments;
begin
  if not exists(select 1 from whatsapp_leads where id=p_contact_id) then raise exception 'contact_not_found'; end if;
  insert into crm_payments(contact_id,proposal_id,quote_id,quote_version_id,provider,external_reference,amount,currency,description,due_at,created_by)
  values(p_contact_id,p_proposal_id,p_quote_id,p_quote_version_id,p_provider,p_external_reference,p_amount,p_currency,p_description,p_due_at,p_actor_user_id)
  on conflict (external_reference) do nothing
  returning * into payment;
  if payment.id is null then select * into payment from crm_payments where external_reference=p_external_reference; end if;
  insert into crm_activities(contact_id,event_type,actor,actor_user_id,metadata,idempotency_key)
  values(p_contact_id,'payment_created','human',p_actor_user_id,jsonb_build_object('payment_id',payment.id,'amount',p_amount,'currency',p_currency),'payment-created:'||payment.id)
  on conflict (idempotency_key) do nothing;
  return payment;
end $$;
revoke all on function public.crm_create_payment(uuid,uuid,uuid,uuid,text,text,numeric,text,text,timestamptz,text) from public;
grant execute on function public.crm_create_payment(uuid,uuid,uuid,uuid,text,text,numeric,text,text,timestamptz,text) to service_role;

-- Guarda la referencia de la preferencia de pago (Checkout Pro) y su URL tras crearla. NOTA: en
-- Mercado Pago el id de preferencia no es el id de pago real; provider_payment_id se sobrescribe
-- con el id de pago verdadero recién en crm_confirm_payment, cuando el webhook lo entrega.
create or replace function public.crm_attach_payment_checkout(p_payment_id uuid, p_provider_payment_id text, p_payment_url text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  update crm_payments set provider_payment_id=p_provider_payment_id, payment_url=p_payment_url, updated_at=now()
  where id=p_payment_id and status='pending';
  if not found then raise exception 'payment_not_pending'; end if;
end $$;
revoke all on function public.crm_attach_payment_checkout(uuid,text,text) from public;
grant execute on function public.crm_attach_payment_checkout(uuid,text,text) to service_role;

-- Confirmación atómica e idempotente: solo transiciona pending->paid. Se busca por
-- external_reference (el dato que SÍ conocemos desde la creación del checkout) porque el
-- provider_payment_id real de Mercado Pago solo se conoce hasta que el webhook confirma el pago
-- (el id devuelto al crear el checkout es el de la preferencia, no el del pago). Si ya estaba
-- paid (webhook duplicado, reintento de Mercado Pago) es un no-op silencioso, no un error.
create or replace function public.crm_confirm_payment(p_external_reference text, p_provider text, p_provider_payment_id text, p_paid_at timestamptz) returns crm_payments
language plpgsql security definer set search_path = public
as $$
declare payment crm_payments;
begin
  select * into payment from crm_payments where external_reference=p_external_reference for update;
  if payment.id is null then raise exception 'payment_not_found'; end if;
  if payment.status='paid' then return payment; end if;
  update crm_payments set status='paid', paid_at=p_paid_at, provider=p_provider, provider_payment_id=p_provider_payment_id, updated_at=now() where id=payment.id returning * into payment;
  return payment;
end $$;
revoke all on function public.crm_confirm_payment(text,text,text,timestamptz) from public;
grant execute on function public.crm_confirm_payment(text,text,text,timestamptz) to service_role;
