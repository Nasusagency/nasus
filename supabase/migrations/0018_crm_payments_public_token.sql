-- Fase 10: token público no secuencial para /pagar/[token]. Se genera en la aplicación
-- (crypto.randomBytes, 32 bytes) y se pasa a crm_create_payment; evitamos depender de pgcrypto
-- en la base para no asumir que la extensión está habilitada en el proyecto.

alter table public.crm_payments add column if not exists public_token text;
create unique index if not exists crm_payments_public_token_idx on public.crm_payments(public_token);

create or replace function public.crm_create_payment(
  p_contact_id uuid, p_proposal_id uuid, p_quote_id uuid, p_quote_version_id uuid,
  p_provider text, p_external_reference text, p_amount numeric, p_currency text,
  p_description text, p_due_at timestamptz, p_actor_user_id text, p_public_token text
) returns crm_payments
language plpgsql security definer set search_path = public
as $$
declare payment crm_payments;
begin
  if not exists(select 1 from whatsapp_leads where id=p_contact_id) then raise exception 'contact_not_found'; end if;
  insert into crm_payments(contact_id,proposal_id,quote_id,quote_version_id,provider,external_reference,amount,currency,description,due_at,created_by,public_token)
  values(p_contact_id,p_proposal_id,p_quote_id,p_quote_version_id,p_provider,p_external_reference,p_amount,p_currency,p_description,p_due_at,p_actor_user_id,p_public_token)
  on conflict (external_reference) do nothing
  returning * into payment;
  if payment.id is null then select * into payment from crm_payments where external_reference=p_external_reference; end if;
  insert into crm_activities(contact_id,event_type,actor,actor_user_id,metadata,idempotency_key)
  values(p_contact_id,'payment_created','human',p_actor_user_id,jsonb_build_object('payment_id',payment.id,'amount',p_amount,'currency',p_currency),'payment-created:'||payment.id)
  on conflict (idempotency_key) do nothing;
  return payment;
end $$;
revoke all on function public.crm_create_payment(uuid,uuid,uuid,uuid,text,text,numeric,text,text,timestamptz,text,text) from public;
grant execute on function public.crm_create_payment(uuid,uuid,uuid,uuid,text,text,numeric,text,text,timestamptz,text,text) to service_role;
drop function if exists public.crm_create_payment(uuid,uuid,uuid,uuid,text,text,numeric,text,text,timestamptz,text);

-- No se expone /pagar/[token] con RLS para anon: la ruta lee con service role y solo
-- devuelve las columnas necesarias para mostrar el pago (ver lib/crm/payments.ts).
