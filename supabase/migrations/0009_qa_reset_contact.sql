-- Utilidad de QA/E2E: reset completo de UN contacto de whatsapp_leads por número.
--
-- Objetivo: poder rehacer una prueba end-to-end "desde cero" sin arrastrar
-- historial de pruebas anteriores, sin tocar ningún otro contacto y sin dar
-- acceso directo de borrado a nadie fuera del backend (service role).
--
-- No se usa "delete ... where numero = any(...)" en ningún punto: todo el
-- borrado se ata al `id` del lead resuelto una sola vez al inicio, o al
-- número exacto recibido como parámetro. Ambas funciones son security definer
-- y quedan revocadas para todo rol salvo service_role, igual que
-- crm_convert_contact / crm_apply_human_decision en 0008.
--
-- Relaciones verificadas antes de escribir esto (ver migraciones previas):
--   crm_proposals.contact_id   -> whatsapp_leads(id) on delete cascade
--   crm_activities.contact_id  -> whatsapp_leads(id) on delete cascade
--   crm_suggestions.contact_id -> whatsapp_leads(id) on delete cascade
--   whatsapp_requerimientos.contact_id -> whatsapp_leads(id) on delete SET NULL (no cascade)
--   whatsapp_leads.acquisition_event_id -> acquisition_events(id) on delete set null
--   whatsapp_mensajes, whatsapp_conversations, whatsapp_clientes: sin FK a whatsapp_leads,
--     se identifican por el propio número de teléfono.
--   idempotency_keys: sin FK y sin columna de número (la key es un hash del
--     contenido). No se puede vincular con certeza a un contacto desde SQL;
--     se deja fuera de esta función a propósito (ver scripts/qa-reset-contact.ts,
--     que recompone las keys de registrar_requerimiento con el mismo hash que
--     usa el backend antes de borrar los requerimientos, y documenta por qué
--     las de notificar_humano no son reconstruibles).
--   acquisition_campaign_metrics / acquisition_ads_sync_status: son rollups por
--     plataforma/fecha, nunca pertenecen a un solo contacto. No se tocan aquí.

create or replace function public.qa_reset_contact_preview(p_numero text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_acquisition_event_id uuid;
begin
  if p_numero is null or p_numero !~ '^\d{10,15}$' then
    raise exception 'invalid_number';
  end if;

  select id, acquisition_event_id into v_lead_id, v_acquisition_event_id
  from public.whatsapp_leads where numero = p_numero;

  return jsonb_build_object(
    'numero_masked', left(p_numero, 2) || repeat('*', greatest(length(p_numero) - 5, 0)) || right(p_numero, 3),
    'lead_found', v_lead_id is not null,
    'whatsapp_leads', (select count(*) from public.whatsapp_leads where numero = p_numero),
    'crm_suggestions', case when v_lead_id is null then 0 else (select count(*) from public.crm_suggestions where contact_id = v_lead_id) end,
    'crm_proposals', case when v_lead_id is null then 0 else (select count(*) from public.crm_proposals where contact_id = v_lead_id) end,
    'crm_activities', case when v_lead_id is null then 0 else (select count(*) from public.crm_activities where contact_id = v_lead_id) end,
    'whatsapp_requerimientos', (select count(*) from public.whatsapp_requerimientos where numero_contacto = p_numero or (v_lead_id is not null and contact_id = v_lead_id)),
    'whatsapp_mensajes', (select count(*) from public.whatsapp_mensajes where numero = p_numero),
    'whatsapp_conversations', (select count(*) from public.whatsapp_conversations where numero = p_numero),
    'whatsapp_clientes', (select count(*) from public.whatsapp_clientes where numero_whatsapp = p_numero),
    'acquisition_events_linked', case when v_acquisition_event_id is null then 0 else 1 end
  );
end;
$$;
revoke all on function public.qa_reset_contact_preview(text) from public;
grant execute on function public.qa_reset_contact_preview(text) to service_role;

create or replace function public.qa_reset_contact(p_numero text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_acquisition_event_id uuid;
  v_deleted jsonb := '{}'::jsonb;
  v_n int;
begin
  if p_numero is null or p_numero !~ '^\d{10,15}$' then
    raise exception 'invalid_number';
  end if;

  select id, acquisition_event_id into v_lead_id, v_acquisition_event_id
  from public.whatsapp_leads where numero = p_numero;

  if v_lead_id is not null then
    delete from public.crm_suggestions where contact_id = v_lead_id;
    get diagnostics v_n = row_count;
    v_deleted := v_deleted || jsonb_build_object('crm_suggestions', v_n);

    delete from public.crm_proposals where contact_id = v_lead_id;
    get diagnostics v_n = row_count;
    v_deleted := v_deleted || jsonb_build_object('crm_proposals', v_n);

    delete from public.crm_activities where contact_id = v_lead_id;
    get diagnostics v_n = row_count;
    v_deleted := v_deleted || jsonb_build_object('crm_activities', v_n);
  else
    v_deleted := v_deleted || jsonb_build_object('crm_suggestions', 0, 'crm_proposals', 0, 'crm_activities', 0);
  end if;

  -- Sin cascade desde whatsapp_leads: se identifican por numero_contacto
  -- (el texto plano, no solo contact_id) porque filas antiguas pueden no
  -- tener contact_id resuelto todavía.
  delete from public.whatsapp_requerimientos
  where numero_contacto = p_numero or (v_lead_id is not null and contact_id = v_lead_id);
  get diagnostics v_n = row_count;
  v_deleted := v_deleted || jsonb_build_object('whatsapp_requerimientos', v_n);

  delete from public.whatsapp_mensajes where numero = p_numero;
  get diagnostics v_n = row_count;
  v_deleted := v_deleted || jsonb_build_object('whatsapp_mensajes', v_n);

  delete from public.whatsapp_conversations where numero = p_numero;
  get diagnostics v_n = row_count;
  v_deleted := v_deleted || jsonb_build_object('whatsapp_conversations', v_n);

  delete from public.whatsapp_clientes where numero_whatsapp = p_numero;
  get diagnostics v_n = row_count;
  v_deleted := v_deleted || jsonb_build_object('whatsapp_clientes', v_n);

  -- El evento de adquisición solo se borra si está enlazado exclusivamente
  -- a este lead (whatsapp_leads.acquisition_event_id es 1:1 por diseño: ver
  -- resolveAndAssociateAttribution en lib/acquisition/server.ts, que solo
  -- asocia un evento a un lead cuando acquisition_event_id todavía es null).
  -- Nunca se borra por session_id ni por rango de fechas.
  if v_acquisition_event_id is not null then
    delete from public.acquisition_events where id = v_acquisition_event_id;
    get diagnostics v_n = row_count;
    v_deleted := v_deleted || jsonb_build_object('acquisition_events', v_n);
  else
    v_deleted := v_deleted || jsonb_build_object('acquisition_events', 0);
  end if;

  -- Al final: aunque crm_* ya se limpiaron explícitamente arriba, este delete
  -- también dispararía su cascade si algo quedó fuera de sincronía.
  delete from public.whatsapp_leads where numero = p_numero;
  get diagnostics v_n = row_count;
  v_deleted := v_deleted || jsonb_build_object('whatsapp_leads', v_n);

  return v_deleted;
end;
$$;
revoke all on function public.qa_reset_contact(text) from public;
grant execute on function public.qa_reset_contact(text) to service_role;
