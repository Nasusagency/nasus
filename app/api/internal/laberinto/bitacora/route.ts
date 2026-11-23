import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, authorizeGoogleAdsSync } from "@/lib/google-ads/endpoint-auth";
import { escribirBitacoraDiaria } from "@/lib/guia/bitacora";

export const maxDuration = 30;

/** Vercel Cron (GET + Authorization: Bearer CRON_SECRET) o un admin con sesión. */
async function run(request: NextRequest) {
  const auth = await authorizeGoogleAdsSync({ adminCookie: request.cookies.get(ADMIN_COOKIE)?.value, authorization: request.headers.get("authorization") });
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const result = await escribirBitacoraDiaria();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}

export const GET = run;
export const POST = run;
