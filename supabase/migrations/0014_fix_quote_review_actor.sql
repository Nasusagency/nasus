-- Corrige producción: crm_actor admite groq, human y system; la revisión Claude
-- es una automatización del sistema y conserva el proveedor real en metadata.

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
