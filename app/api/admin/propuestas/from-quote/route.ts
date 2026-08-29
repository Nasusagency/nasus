import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";
import { createProposalFromApprovedQuote } from "@/lib/crm/proposals";
export const maxDuration = 60;
export async function POST(req: NextRequest) { const token=req.cookies.get(ADMIN_COOKIE)?.value;if(!token||!await verifyAdminToken(token))return NextResponse.json({},{status:401});const body=await req.json().catch(()=>null) as {quoteId?:string}|null;if(!body?.quoteId)return NextResponse.json({error:"quoteId requerido"},{status:400});try{const result=await createProposalFromApprovedQuote({quoteId:body.quoteId,actorUserId:process.env.ADMIN_ACTOR||"admin"});return NextResponse.json(result,{status:result.ok?201:400});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"proposal_generation_failed"},{status:400});} }
