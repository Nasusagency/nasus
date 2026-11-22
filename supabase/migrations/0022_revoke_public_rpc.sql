-- Cierra la ejecución pública de las funciones SECURITY DEFINER del CRM.
--
-- Postgres concede EXECUTE a PUBLIC por defecto y Supabase además a anon y
-- authenticated. Como la llave anon es pública (va en el navegador), cualquiera
-- podía llamar por /rest/v1/rpc/... funciones como crm_confirm_payment (marcar un
-- pago como pagado) o qa_reset_contact (borrar un contacto). El código las llama
-- SOLO con la llave service_role desde el servidor, así que se quita el permiso a
-- todos los demás. Para revertir: grant execute ... to anon, authenticated.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'crm_apply_human_decision', 'crm_approve_quote', 'crm_attach_payment_checkout',
        'crm_confirm_payment', 'crm_convert_contact', 'crm_create_payment',
        'crm_create_quote_draft', 'crm_create_quote_revision', 'crm_finalize_proposal_delivery',
        'crm_log_requirement_update', 'crm_update_quote_draft',
        'qa_reset_contact', 'qa_reset_contact_preview'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.signature);
    execute format('grant execute on function %s to service_role', fn.signature);
  end loop;
end $$;
