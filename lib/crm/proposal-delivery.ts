import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { createGmailProvider, type ProposalDeliveryProvider } from "@/lib/email/gmail";
import { recordCrmActivity } from "./service";

const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
// maxDuration de POST /api/admin/propuestas/[id]/send es 60s: una reserva "pending" que sigue viva
// más allá de eso ya perdió su función, Vercel mató la request que la creó.
const RESERVATION_TIMEOUT_MS=2*60*1000;
export async function deliverProposal(input:{proposalId:string;actorUserId:string;resend?:boolean},provider:ProposalDeliveryProvider=createGmailProvider(),client:SupabaseClient|null=createServiceClient()) {
  if(!client)return {ok:false as const,error:"database_unavailable"};
  const {data:p}=await client.from("crm_proposals").select("id,contact_id,status,title,content,value,currency,proposal_version,recipient_email,ready_for_delivery,quote_id,quote_version_id,slug").eq("id",input.proposalId).maybeSingle();
  if(!p)return {ok:false as const,error:"proposal_not_found"}; if(!p.ready_for_delivery||(p.status!=="draft"&&!(input.resend&&p.status==="sent")))return {ok:false as const,error:"proposal_not_ready"}; if(!p.recipient_email||!validEmail(p.recipient_email))return {ok:false as const,error:"invalid_email"};
  const [{data:q},{data:v}]=await Promise.all([client.from("crm_quotes").select("status").eq("id",p.quote_id).maybeSingle(),client.from("crm_quote_versions").select("id").eq("id",p.quote_version_id).eq("quote_id",p.quote_id).maybeSingle()]); if(q?.status!=="approved"||!v)return {ok:false as const,error:"approved_quote_required"};
  const key=`proposal-delivery:${p.id}:v${p.proposal_version}`; const {data:prior}=await client.from("crm_proposal_deliveries").select("id,status,message_id,thread_id,updated_at").eq("idempotency_key",key).maybeSingle(); if(prior?.status==="sent"&&!input.resend)return {ok:true as const,duplicate:true,messageId:prior.message_id,threadId:prior.thread_id};
  let attemptKey=key;
  if(input.resend||!prior){
    attemptKey=input.resend?`${key}:resend:${crypto.randomUUID()}`:key;
    const {error:reserveError}=await client.from("crm_proposal_deliveries").insert({proposal_id:p.id,proposal_version:p.proposal_version,idempotency_key:attemptKey,provider:provider.name,recipient:p.recipient_email,status:"pending"});
    if(reserveError)return {ok:false as const,error:"delivery_already_reserved"};
  } else {
    // prior existe, no es resend: solo puede ser 'failed' (reintento tras error real) o 'pending'
    // huérfano (la request que lo reservó murió antes de resolver). Reclamar con UPDATE...WHERE
    // status=X es atómico por fila en Postgres: si dos requests reclaman a la vez, solo una gana.
    const isStalePending=prior.status==="pending"&&Date.now()-new Date(prior.updated_at).getTime()>RESERVATION_TIMEOUT_MS;
    if(prior.status==="pending"&&!isStalePending)return {ok:false as const,error:"delivery_in_progress"};
    const now=new Date().toISOString();
    let reclaim=client.from("crm_proposal_deliveries").update({status:"pending",error_code:null,message_id:null,thread_id:null,updated_at:now}).eq("id",prior.id).eq("status",prior.status);
    if(prior.status==="pending")reclaim=reclaim.lt("updated_at",new Date(Date.now()-RESERVATION_TIMEOUT_MS).toISOString());
    const {data:claimed,error:claimError}=await reclaim.select("id").maybeSingle();
    if(claimError||!claimed)return {ok:false as const,error:"delivery_in_progress"};
  }
  try {const sent=await provider.send({to:p.recipient_email,subject:`Propuesta: ${p.title}`,text:`Hola,\n\nAdjuntamos el enlace a la propuesta: ${process.env.NEXT_PUBLIC_SITE_URL||"https://nasus.lat"}/propuesta/${p.slug}\n\nInversión aprobada: ${p.currency} ${Number(p.value).toLocaleString("es-MX")}\n\n${p.content.slice(0,3000)}`,idempotencyKey:attemptKey});const now=new Date().toISOString();
    const {error:finalizeError}=await client.rpc("crm_finalize_proposal_delivery",{p_idempotency_key:attemptKey,p_proposal_id:p.id,p_message_id:sent.messageId,p_thread_id:sent.threadId,p_sent_at:now,p_provider:provider.name});
    if(finalizeError)return {ok:false as const,error:"delivery_persist_failed",messageId:sent.messageId,threadId:sent.threadId};
    await recordCrmActivity({contactId:p.contact_id,eventType:"proposal_sent",actor:"human",actorUserId:input.actorUserId,metadata:{proposal_id:p.id,provider:provider.name,message_id:sent.messageId,thread_id:sent.threadId},idempotencyKey:`proposal-sent:${attemptKey}`},client);
    return {ok:true as const,duplicate:false,...sent};
  }catch(error){await client.from("crm_proposal_deliveries").update({status:"failed",error_code:error instanceof Error?error.message.split(":")[0]:"delivery_failed",updated_at:new Date().toISOString()}).eq("idempotency_key",attemptKey);return {ok:false as const,error:error instanceof Error?error.message:"delivery_failed"};}
}

export function detectsProposalAcceptance(text:string){return /\b(acepto|aceptamos|adelante|aprobamos|pueden iniciar)\b/i.test(text);}
export async function syncProposalThread(input:{proposalId:string;actorUserId:string},provider:ProposalDeliveryProvider=createGmailProvider(),client:SupabaseClient|null=createServiceClient()){
  if(!client)return {ok:false as const,error:"database_unavailable"};const {data:p}=await client.from("crm_proposals").select("id,contact_id,external_thread_id").eq("id",input.proposalId).maybeSingle();if(!p?.external_thread_id)return {ok:false as const,error:"proposal_thread_missing"};const thread=await provider.getThread(p.external_thread_id);const acceptance=thread.messages.some(m=>detectsProposalAcceptance(m.text));const now=new Date().toISOString();await client.from("crm_proposals").update({last_sync_at:now}).eq("id",p.id);if(acceptance){const {data:s,error}=await client.from("crm_suggestions").insert({contact_id:p.contact_id,suggestion_type:"proposal_acceptance_detected",reason:"Se detectó lenguaje de aceptación en el thread asociado a la propuesta.",proposal_id:p.id,created_by:"system"}).select("id").maybeSingle();if(error&&error.code!=="23505")return {ok:false as const,error:error.message};if(s)await recordCrmActivity({contactId:p.contact_id,eventType:"proposal_acceptance_detected",actor:"system",actorUserId:input.actorUserId,metadata:{proposal_id:p.id,thread_id:p.external_thread_id,suggestion_id:s.id},idempotencyKey:`proposal-acceptance-detected:${p.id}`},client);}return {ok:true as const,messageCount:thread.messages.length,acceptanceDetected:acceptance};}
