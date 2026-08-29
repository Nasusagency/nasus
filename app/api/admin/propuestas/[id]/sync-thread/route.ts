import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";
import { syncProposalThread } from "@/lib/crm/proposal-delivery";
export const maxDuration=60;
export async function POST(r:NextRequest,{params}:{params:Promise<{id:string}>}){const t=r.cookies.get(ADMIN_COOKIE)?.value;if(!t||!await verifyAdminToken(t))return NextResponse.json({},{status:401});const result=await syncProposalThread({proposalId:(await params).id,actorUserId:process.env.ADMIN_ACTOR||"admin"});return NextResponse.json(result,{status:result.ok?200:400});}
