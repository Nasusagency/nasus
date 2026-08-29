import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import ProposalEditor from "./ProposalEditor";
export default async function Page({params}:{params:Promise<{id:string}>}){const db=createServiceClient();if(!db)notFound();const {data}=await db.from("crm_proposals").select("id,slug,title,content,status,value,currency,proposal_version,recipient_email,ready_for_delivery,sent_at,delivery_provider,external_message_id,external_thread_id,last_sync_at,quote_id,quote_version_id,terms_snapshot,whatsapp_leads(nombre_contacto,nombre_empresa),crm_quote_versions(version)").eq("id",(await params).id).maybeSingle();if(!data)notFound();return <ProposalEditor initial={data}/>;}
