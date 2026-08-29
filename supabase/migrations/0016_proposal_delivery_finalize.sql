-- Fase 7 fix: finalización atómica del envío de propuesta (delivery + proposal en una sola transacción).
-- Evita el estado inconsistente donde Gmail confirma el envío pero una de las dos escrituras
-- posteriores en Supabase falla y el CRM no lo refleja.

create or replace function public.crm_finalize_proposal_delivery(
  p_idempotency_key text, p_proposal_id uuid, p_message_id text, p_thread_id text,
  p_sent_at timestamptz, p_provider text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  update crm_proposal_deliveries
    set status='sent', message_id=p_message_id, thread_id=p_thread_id, sent_at=p_sent_at, updated_at=p_sent_at
  where idempotency_key=p_idempotency_key;
  if not found then raise exception 'delivery_not_found'; end if;

  update crm_proposals
    set status=case when status='draft' then 'sent' else status end,
        sent_at=coalesce(sent_at,p_sent_at), delivery_provider=p_provider,
        external_message_id=p_message_id, external_thread_id=p_thread_id, updated_at=p_sent_at
  where id=p_proposal_id;
  if not found then raise exception 'proposal_not_found'; end if;
end $$;
revoke all on function public.crm_finalize_proposal_delivery(text,uuid,text,text,timestamptz,text) from public;
grant execute on function public.crm_finalize_proposal_delivery(text,uuid,text,text,timestamptz,text) to service_role;
