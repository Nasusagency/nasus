import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {describe,test} from "node:test";import type {LLMResponse} from "../lib/llm/provider";import {writeProposalCopy} from "../lib/crm/proposal-agent";import {composeProposalMarkdown} from "../lib/crm/proposals";import {createGmailProvider,type ProposalDeliveryProvider} from "../lib/email/gmail";import {detectsProposalAcceptance,deliverProposal} from "../lib/crm/proposal-delivery";
const snapshot={title:"CRM",scope:"API aprobada",currency:"MXN",items:[{description:"Backend",hours:10}],totals:{subtotal:10000,contingency_amount:1000,tax_amount:1760,total:12760},version:1};
const terms={validityDays:15,paymentTerms:"50/50",intellectualProperty:"Template PI",confidentiality:"Template NDA",supportMaintenance:"Template soporte",cancellation:"Template cancelación",scopeChanges:"Nueva estimación",exclusions:"Fuera de alcance",jurisdiction:null,legalApproved:false};
const copy={executiveSummary:"Resumen",deliverables:["API"],exclusions:["Hosting"],dependencies:["Accesos"],timeline:"2 semanas",nextStep:"Confirmar"};
describe("Fase 6 propuesta desde quote",()=>{
 test("draft no puede generar propuesta final",()=>assert.match(readFileSync("lib/crm/proposals.ts","utf8"),/quote\.status!=="approved"/));
 test("approved genera propuesta vinculada",()=>{const s=readFileSync("lib/crm/proposals.ts","utf8");assert.match(s,/quote_version_id:version\.id/);assert.match(s,/quote_id:quote\.id/)});
 test("usa snapshot exacto aprobado",()=>assert.match(readFileSync("lib/crm/proposals.ts","utf8"),/snapshot=version\.snapshot/));
 test("LLM no puede cambiar total",async()=>{const response:LLMResponse={content:[{type:"tool_use",id:"x",name:"redactar_propuesta_comercial",input:{executive_summary:"R",deliverables:[],exclusions:[],dependencies:[],timeline:"1 semana",next_step:"Sí",total:1}}],usage:{input_tokens:1,output_tokens:1},stop_reason:"tool_use",usedProvider:"claude"};let schema={} as Record<string,unknown>;const result=await writeProposalCopy(snapshot,{callWriter:async p=>{schema=p.tools?.[0].input_schema.properties??{};return response}});assert.equal("total" in schema,false);assert.equal("total" in result,false)});
 test("términos legales provienen del template",()=>{const md=composeProposalMarkdown({clientName:"ACME",project:"CRM",copy,snapshot,terms});assert.match(md,/Template PI/);assert.match(md,/requiere revisión humana/i)});
 test("regenerar incrementa versión",()=>assert.match(readFileSync("lib/crm/proposals.ts","utf8"),/proposalVersion=existing\?num\(existing\.proposal_version\)\+1:1/));
 test("propuesta enviada no se sobrescribe",()=>{const s=readFileSync("lib/crm/proposals.ts","utf8");assert.match(s,/\.insert\(\{contact_id:quote\.contact_id/);assert.doesNotMatch(s,/crm_proposals"\)\.upsert/)});
});
describe("Fase 7 Gmail y aceptación",()=>{
 test("Gmail registra message y thread reales",async()=>{const old={...process.env};Object.assign(process.env,{GMAIL_CLIENT_ID:"id",GMAIL_CLIENT_SECRET:"secret",GMAIL_REFRESH_TOKEN:"refresh",GMAIL_SENDER_EMAIL:"from@example.com"});let calls=0;const provider=createGmailProvider(async()=>{calls++;return new Response(JSON.stringify(calls===1?{access_token:"token"}:{id:"m1",threadId:"t1"}),{status:200})});assert.deepEqual(await provider.send({to:"to@example.com",subject:"S",text:"T",idempotencyKey:"k"}),{messageId:"m1",threadId:"t1"});process.env=old});
 test("error Gmail no produce referencia sent",async()=>{Object.assign(process.env,{GMAIL_CLIENT_ID:"id",GMAIL_CLIENT_SECRET:"secret",GMAIL_REFRESH_TOKEN:"refresh",GMAIL_SENDER_EMAIL:"from@example.com"});let calls=0;const p=createGmailProvider(async()=>new Response(JSON.stringify(++calls===1?{access_token:"t"}:{}),{status:calls===1?200:500}));await assert.rejects(()=>p.send({to:"x@y.com",subject:"S",text:"T",idempotencyKey:"k"}),/gmail_send_failed/)});
 test("retry tiene idempotency key por proposal y versión",()=>assert.match(readFileSync("lib/crm/proposal-delivery.ts","utf8"),/proposal-delivery:\$\{p\.id\}:v\$\{p\.proposal_version\}/));
 test("email inválido bloquea envío",()=>assert.match(readFileSync("lib/crm/proposal-delivery.ts","utf8"),/invalid_email/));
 test("proposal sin quote approved no se envía",()=>assert.match(readFileSync("lib/crm/proposal-delivery.ts","utf8"),/approved_quote_required/));
 test("respuesta se recupera solo por thread asociado",()=>{const s=readFileSync("lib/crm/proposal-delivery.ts","utf8");assert.match(s,/getThread\(p\.external_thread_id\)/);assert.doesNotMatch(s,/listThreads|messages\/list/)});
 test("aceptación crea suggestion y no convierte",()=>{assert.equal(detectsProposalAcceptance("Adelante, pueden iniciar"),true);const s=readFileSync("lib/crm/proposal-delivery.ts","utf8");assert.match(s,/proposal_acceptance_detected/);assert.doesNotMatch(s,/crm_convert_contact|stage:\s*"won"/)});
 test("logs y errores no exponen tokens ni destinatario",()=>{const s=readFileSync("lib/email/gmail.ts","utf8");assert.doesNotMatch(s,/console\.|access_token.*console|recipient.*console/)});
});

type Row=Record<string,unknown>;
function makeFakeClient(tables:Record<string,Row[]>,rpc:(fn:string,args:Record<string,unknown>)=>{data:unknown;error:{message:string}|null}=()=>({data:null,error:null})){
 function from(table:string){
  let mode:"select"|"insert"|"update"="select";let payload:Row={};const filters:Array<(r:Row)=>boolean>=[];
  const rows=()=>tables[table]||(tables[table]=[]);
  const match=()=>rows().filter(r=>filters.every(f=>f(r)));
  const exec=async()=>{
   if(mode==="insert"){
    if(rows().some(r=>r.idempotency_key===payload.idempotency_key))return {data:null,error:{message:"duplicate key value violates unique constraint"}};
    const row={id:`id-${rows().length+1}`,updated_at:new Date().toISOString(),...payload};rows().push(row);return {data:row,error:null};
   }
   if(mode==="update"){const m=match();m.forEach(r=>Object.assign(r,payload));return {data:m[0]??null,error:null};}
   const m=match();return {data:m[0]??null,error:null};
  };
  const b:Record<string,unknown>={
   select(){if(mode!=="update")mode="select";return b;},
   insert(row:Row){mode="insert";payload=row;return exec();},
   upsert(row:Row){mode="insert";payload=row;return exec();},
   update(row:Row){mode="update";payload=row;return b;},
   eq(col:string,val:unknown){filters.push(r=>r[col]===val);return b;},
   lt(col:string,val:unknown){filters.push(r=>String(r[col])<String(val));return b;},
   maybeSingle(){return exec();},
   then(resolve:(v:unknown)=>unknown,reject:(e:unknown)=>unknown){return exec().then(resolve,reject);},
  };
  return b;
 }
 return {from,rpc:async(fn:string,args:Record<string,unknown>)=>rpc(fn,args)} as unknown as import("@supabase/supabase-js").SupabaseClient;
}
function baseTables(overrides?:Partial<{delivery:Row}>){
 const proposal={id:"prop-1",contact_id:"contact-1",status:"draft",title:"Propuesta",content:"Contenido",value:12760,currency:"MXN",proposal_version:1,recipient_email:"cliente@example.com",ready_for_delivery:true,quote_id:"quote-1",quote_version_id:"qv-1",slug:"prop-1"};
 const tables:Record<string,Row[]>={crm_proposals:[proposal],crm_quotes:[{id:"quote-1",status:"approved"}],crm_quote_versions:[{id:"qv-1",quote_id:"quote-1"}],crm_proposal_deliveries:[],crm_activities:[]};
 if(overrides?.delivery)tables.crm_proposal_deliveries.push(overrides.delivery);
 return tables;
}
const fakeProvider:ProposalDeliveryProvider={name:"gmail",send:async()=>({messageId:"m-new",threadId:"t-new"}),getThread:async()=>({messages:[]})};
function makeFinalizeRpc(tables:Record<string,Row[]>){
 return (fn:string,args:Record<string,unknown>)=>{
  if(fn!=="crm_finalize_proposal_delivery")return {data:null,error:{message:"unknown_function"}};
  const delivery=tables.crm_proposal_deliveries.find(r=>r.idempotency_key===args.p_idempotency_key);
  if(!delivery)return {data:null,error:{message:"delivery_not_found"}};
  Object.assign(delivery,{status:"sent",message_id:args.p_message_id,thread_id:args.p_thread_id,sent_at:args.p_sent_at,updated_at:args.p_sent_at});
  const proposal=tables.crm_proposals.find(r=>r.id===args.p_proposal_id);
  if(!proposal)return {data:null,error:{message:"proposal_not_found"}};
  Object.assign(proposal,{status:proposal.status==="draft"?"sent":proposal.status,sent_at:proposal.sent_at??args.p_sent_at,delivery_provider:args.p_provider,external_message_id:args.p_message_id,external_thread_id:args.p_thread_id,updated_at:args.p_sent_at});
  return {data:null,error:null};
 };
}

describe("Fase 7 fix: reservas huérfanas y persistencia atómica",()=>{
 test("reintento tras delivery failed reclama la reserva y envía",async()=>{
  const tables=baseTables({delivery:{id:"d-1",proposal_id:"prop-1",proposal_version:1,idempotency_key:"proposal-delivery:prop-1:v1",provider:"gmail",recipient:"cliente@example.com",status:"failed",error_code:"gmail_config_missing",updated_at:new Date().toISOString()}});
  const client=makeFakeClient(tables,makeFinalizeRpc(tables));
  const result=await deliverProposal({proposalId:"prop-1",actorUserId:"admin"},fakeProvider,client);
  assert.equal(result.ok,true);
  assert.equal(tables.crm_proposal_deliveries[0].status,"sent");
 });
 test("reintento inmediato tras pending fresco no reclama (delivery_in_progress)",async()=>{
  const tables=baseTables({delivery:{id:"d-1",proposal_id:"prop-1",proposal_version:1,idempotency_key:"proposal-delivery:prop-1:v1",provider:"gmail",recipient:"cliente@example.com",status:"pending",updated_at:new Date().toISOString()}});
  const client=makeFakeClient(tables);
  const result=await deliverProposal({proposalId:"prop-1",actorUserId:"admin"},fakeProvider,client);
  assert.deepEqual(result,{ok:false,error:"delivery_in_progress"});
  assert.equal(tables.crm_proposal_deliveries[0].status,"pending");
 });
 test("pending huérfano (más viejo que el timeout de reserva) se reclama y permite reenviar",async()=>{
  const staleUpdatedAt=new Date(Date.now()-3*60*1000).toISOString();
  const tables=baseTables({delivery:{id:"d-1",proposal_id:"prop-1",proposal_version:1,idempotency_key:"proposal-delivery:prop-1:v1",provider:"gmail",recipient:"cliente@example.com",status:"pending",updated_at:staleUpdatedAt}});
  const client=makeFakeClient(tables,makeFinalizeRpc(tables));
  const result=await deliverProposal({proposalId:"prop-1",actorUserId:"admin"},fakeProvider,client);
  assert.equal(result.ok,true);
  assert.equal(tables.crm_proposal_deliveries[0].status,"sent");
 });
 test("delivery sent previo sin resend sigue devolviendo duplicate sin reenviar",async()=>{
  const tables=baseTables({delivery:{id:"d-1",proposal_id:"prop-1",proposal_version:1,idempotency_key:"proposal-delivery:prop-1:v1",provider:"gmail",recipient:"cliente@example.com",status:"sent",message_id:"m-old",thread_id:"t-old",updated_at:new Date().toISOString()}});
  const client=makeFakeClient(tables);
  const result=await deliverProposal({proposalId:"prop-1",actorUserId:"admin"},fakeProvider,client);
  assert.deepEqual(result,{ok:true,duplicate:true,messageId:"m-old",threadId:"t-old"});
 });
 test("envío exitoso finaliza vía RPC atómico, no con updates sueltos a crm_proposals",()=>{
  const s=readFileSync("lib/crm/proposal-delivery.ts","utf8");
  assert.match(s,/rpc\("crm_finalize_proposal_delivery"/);
 });
 test("si el RPC de finalización falla, no responde ok:true y preserva messageId/threadId",async()=>{
  const tables=baseTables();
  const client=makeFakeClient(tables,()=>({data:null,error:{message:"boom"}}));
  const result=await deliverProposal({proposalId:"prop-1",actorUserId:"admin"},fakeProvider,client);
  assert.deepEqual(result,{ok:false,error:"delivery_persist_failed",messageId:"m-new",threadId:"t-new"});
  assert.notEqual(tables.crm_proposals[0].status,"sent");
 });
});
