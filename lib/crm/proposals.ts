import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { recordCrmActivity } from "./service";
import { writeProposalCopy, type ProposalWriterDependencies, type ProposalCopy } from "./proposal-agent";

export type ProposalTerms = { validityDays:number; paymentTerms:string; intellectualProperty:string; confidentiality:string; supportMaintenance:string; cancellation:string; scopeChanges:string; exclusions:string; jurisdiction:string|null; legalApproved:boolean };
const num=(v:unknown)=>Number(v);
function mapTerms(t:Record<string,unknown>):ProposalTerms { return { validityDays:num(t.validity_days),paymentTerms:String(t.payment_terms),intellectualProperty:String(t.intellectual_property),confidentiality:String(t.confidentiality),supportMaintenance:String(t.support_maintenance),cancellation:String(t.cancellation),scopeChanges:String(t.scope_changes),exclusions:String(t.exclusions),jurisdiction:t.jurisdiction?String(t.jurisdiction):null,legalApproved:Boolean(t.legal_approved) }; }
export async function getActiveProposalTerms(client:SupabaseClient|null=createServiceClient()){if(!client)return null;const {data}=await client.from("crm_proposal_templates").select("*").eq("is_active",true).maybeSingle();return data?{id:data.id,name:data.name,...mapTerms(data)}:null;}
export async function updateActiveProposalTerms(input:ProposalTerms&{name:string;actorUserId:string},client:SupabaseClient|null=createServiceClient()){if(!client)return {ok:false as const,error:"database_unavailable"};const current=await getActiveProposalTerms(client);if(!current||!input.name.trim()||!Number.isInteger(input.validityDays)||input.validityDays<1||input.validityDays>365)return {ok:false as const,error:"invalid_terms"};const {error}=await client.from("crm_proposal_templates").update({name:input.name.trim(),validity_days:input.validityDays,payment_terms:input.paymentTerms,intellectual_property:input.intellectualProperty,confidentiality:input.confidentiality,support_maintenance:input.supportMaintenance,cancellation:input.cancellation,scope_changes:input.scopeChanges,exclusions:input.exclusions,jurisdiction:input.jurisdiction||null,legal_approved:input.legalApproved,updated_by:input.actorUserId,updated_at:new Date().toISOString()}).eq("id",current.id);return error?{ok:false as const,error:error.message}:{ok:true as const};}
const money=(n:number,c:string)=>`${c} ${n.toLocaleString("es-MX",{minimumFractionDigits:2})}`;
export function composeProposalMarkdown(input:{clientName:string;project:string;copy:ProposalCopy;snapshot:Record<string,unknown>;terms:ProposalTerms}) {
  const totals=input.snapshot.totals as Record<string,unknown>; const currency=String(input.snapshot.currency||"MXN");
  const section=(title:string,items:string[])=>`## ${title}\n${items.length?items.map(x=>`- ${x}`).join("\n"):"- Por definir con el cliente."}`;
  return [`# ${input.project}`,`Preparada para **${input.clientName}**`,`## Resumen ejecutivo\n${input.copy.executiveSummary}`,`## Alcance aprobado\n${String(input.snapshot.scope)}`,section("Entregables",input.copy.deliverables),section("Exclusiones",input.copy.exclusions),section("Dependencias y requisitos del cliente",input.copy.dependencies),`## Tiempo estimado\n${input.copy.timeline}`,`## Inversión\nSubtotal: **${money(num(totals.subtotal),currency)}**\n\nContingencia: **${money(num(totals.contingency_amount),currency)}**\n\nImpuestos: **${money(num(totals.tax_amount),currency)}**\n\nTotal aprobado: **${money(num(totals.total),currency)}**`,`## Condiciones de pago\n${input.terms.paymentTerms}`,`## Vigencia\n${input.terms.validityDays} días naturales.`,`## Términos comerciales\n- Propiedad intelectual: ${input.terms.intellectualProperty}\n- Confidencialidad: ${input.terms.confidentiality}\n- Soporte y mantenimiento: ${input.terms.supportMaintenance}\n- Cancelación: ${input.terms.cancellation}\n- Cambios de alcance: ${input.terms.scopeChanges}\n- Exclusiones generales: ${input.terms.exclusions}${input.terms.jurisdiction?`\n- Jurisdicción: ${input.terms.jurisdiction}`:""}`,!input.terms.legalApproved?"> Este documento comercial contiene términos provisionales y requiere revisión humana; no constituye un contrato legal definitivo.":"",`## Siguiente paso\n${input.copy.nextStep}`].filter(Boolean).join("\n\n");
}

export async function createProposalFromApprovedQuote(input:{quoteId:string;actorUserId:string},deps?:ProposalWriterDependencies,client:SupabaseClient|null=createServiceClient()) {
  if(!client)return {ok:false as const,error:"database_unavailable"};
  const {data:quote}=await client.from("crm_quotes").select("id,contact_id,status,version").eq("id",input.quoteId).maybeSingle();
  if(!quote||quote.status!=="approved")return {ok:false as const,error:"quote_not_approved"};
  const [{data:version},{data:contact},{data:template},{data:existing}]=await Promise.all([
    client.from("crm_quote_versions").select("id,snapshot,total").eq("quote_id",quote.id).maybeSingle(), client.from("whatsapp_leads").select("id,nombre_contacto,nombre_empresa,datos_estructurados").eq("id",quote.contact_id).maybeSingle(), client.from("crm_proposal_templates").select("*").eq("is_active",true).maybeSingle(), client.from("crm_proposals").select("proposal_version,status,parent_proposal_id,id").eq("quote_id",quote.id).order("proposal_version",{ascending:false}).limit(1).maybeSingle(),
  ]);
  if(!version||!contact||!template)return {ok:false as const,error:"proposal_source_incomplete"};
  const snapshot=version.snapshot as Record<string,unknown>; const copy=await writeProposalCopy(snapshot,deps); const terms=mapTerms(template);
  const proposalVersion=existing?num(existing.proposal_version)+1:1; const slug=`proposal-${quote.id}-v${proposalVersion}`; const title=String(snapshot.title||"Propuesta comercial"); const clientName=contact.nombre_empresa||contact.nombre_contacto||"Cliente";
  const content=composeProposalMarkdown({clientName,project:title,copy,snapshot,terms}); const expires=new Date(Date.now()+terms.validityDays*86400000).toISOString();
  const {data:proposal,error}=await client.from("crm_proposals").insert({contact_id:quote.contact_id,external_key:`quote:${quote.id}:proposal:${proposalVersion}`,slug,title,content,status:"draft",value:num((snapshot.totals as Record<string,unknown>).total),currency:String(snapshot.currency),quote_id:quote.id,quote_version_id:version.id,proposal_version:proposalVersion,parent_proposal_id:existing?.parent_proposal_id||existing?.id||null,structured_content:copy,terms_snapshot:terms,expires_at:expires}).select("id,slug,proposal_version").single();
  if(error||!proposal)return {ok:false as const,error:error?.message||"proposal_not_saved"};
  await recordCrmActivity({contactId:quote.contact_id,eventType:existing?"proposal_regenerated":"proposal_created",actor:"system",actorUserId:input.actorUserId,metadata:{proposal_id:proposal.id,quote_id:quote.id,quote_version_id:version.id,proposal_version:proposalVersion},idempotencyKey:`proposal-generated:${proposal.id}`},client);
  return {ok:true as const,proposal};
}

export async function getLatestProposalForQuote(quoteId:string,client:SupabaseClient|null=createServiceClient()) {
  if(!client)return null;
  const {data}=await client.from("crm_proposals").select("id,status,ready_for_delivery,sent_at").eq("quote_id",quoteId).order("proposal_version",{ascending:false}).limit(1).maybeSingle();
  return data;
}

export async function updateProposalCopy(input:{proposalId:string;content:string;recipientEmail?:string;ready:boolean;actorUserId:string},client:SupabaseClient|null=createServiceClient()) {
  if(!client)return {ok:false as const,error:"database_unavailable"}; const email=input.recipientEmail?.trim().toLowerCase()||null;
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return {ok:false as const,error:"invalid_email"};
  const {data:p}=await client.from("crm_proposals").select("id,contact_id,status").eq("id",input.proposalId).maybeSingle(); if(!p)return {ok:false as const,error:"proposal_not_found"}; if(p.status!=="draft")return {ok:false as const,error:"proposal_not_editable"};
  const {error}=await client.from("crm_proposals").update({content:input.content.slice(0,50000),recipient_email:email,ready_for_delivery:input.ready,updated_at:new Date().toISOString()}).eq("id",p.id).eq("status","draft"); if(error)return {ok:false as const,error:error.message};
  if(input.ready)await recordCrmActivity({contactId:p.contact_id,eventType:"proposal_ready_for_delivery",actor:"human",actorUserId:input.actorUserId,metadata:{proposal_id:p.id},idempotencyKey:`proposal-ready:${p.id}`},client); return {ok:true as const};
}
