import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, authorizeGoogleAdsSync as authorizeAdsSync } from "@/lib/google-ads/endpoint-auth";
import { META_ADS_ERROR_MESSAGES, META_ADS_ERROR_STATUS, MetaAdsSyncError } from "@/lib/meta-ads/core";
import { syncMetaAds } from "@/lib/meta-ads/sync";

export const maxDuration = 30;

const safeDays = (value: unknown) => { const days = Number(value); return Number.isInteger(days) ? Math.max(1, Math.min(30, days)) : 3; };

async function run(request: NextRequest, days: number) {
  const auth = await authorizeAdsSync({ adminCookie: request.cookies.get(ADMIN_COOKIE)?.value, authorization: request.headers.get("authorization") });
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const result = await syncMetaAds({ days });
    return NextResponse.json(result);
  } catch (error) {
    const safe = error instanceof MetaAdsSyncError ? error : new MetaAdsSyncError("api_error");
    const message = safe.code === "not_configured" && safe.missingVariables.length > 0
      ? `Falta configurar en Vercel: ${safe.missingVariables.join(", ")}`
      : META_ADS_ERROR_MESSAGES[safe.code];
    return NextResponse.json({ error: message, code: safe.code }, { status: META_ADS_ERROR_STATUS[safe.code] });
  }
}

export async function POST(request: NextRequest) {
  let days = 3;
  try { days = safeDays((await request.json())?.days); } catch { /* cuerpo opcional */ }
  return run(request, days);
}

/** Vercel Cron invoca con GET y Authorization: Bearer CRON_SECRET. */
export async function GET(request: NextRequest) { return run(request, 3); }
