import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";
import { deliverProposal } from "@/lib/crm/proposal-delivery";
export const maxDuration=60;
export async function POST(r:NextRequest,{params}:{params:Promise<{id:string}>}){const t=r.cookies.get(ADMIN_COOKIE)?.value;if(!t||!await verifyAdminToken(t))return NextResponse.json({},{status:401});const b=await r.json().catch(()=>({})) as {resend?:boolean};const result=await deliverProposal({proposalId:(await params).id,actorUserId:process.env.ADMIN_ACTOR||"admin",resend:Boolean(b.resend)});return NextResponse.json(result,{status:result.ok?200:400});}
