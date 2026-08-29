import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";
import { deliverProposal } from "@/lib/crm/proposal-delivery";

/** Compatibilidad: este endpoint ahora efectúa Gmail real; ya no acepta deliveryId del navegador. */
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const token=req.cookies.get(ADMIN_COOKIE)?.value;
  if(!token||!await verifyAdminToken(token))return NextResponse.json({},{status:401});
  const result=await deliverProposal({proposalId:(await params).id,actorUserId:process.env.ADMIN_ACTOR||"admin"});
  return NextResponse.json(result,{status:result.ok?200:400});
}
