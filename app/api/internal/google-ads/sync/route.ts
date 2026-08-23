import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, authorizeGoogleAdsSync } from "@/lib/google-ads/endpoint-auth";
import { syncGoogleAds } from "@/lib/google-ads/sync";
import { GoogleAdsSyncError } from "@/lib/google-ads/core";

export const maxDuration = 30;

const STATUS: Record<GoogleAdsSyncError["code"], number> = { not_configured: 503, invalid_credentials: 502, permission_denied: 403, invalid_customer: 502, api_not_enabled: 503, rate_limited: 429, timeout: 504, api_error: 502, database_error: 503 };
const MESSAGES: Record<GoogleAdsSyncError["code"], string> = { not_configured: "Google Ads no está configurado", invalid_credentials: "Credenciales de Google Ads inválidas", permission_denied: "La cuenta de servicio no tiene acceso a Google Ads", invalid_customer: "Customer ID de Google Ads inválido", api_not_enabled: "Google Ads API no está habilitada", rate_limited: "Google Ads limitó temporalmente la sincronización", timeout: "Google Ads no respondió a tiempo", api_error: "Google Ads devolvió una respuesta inválida", database_error: "No se pudieron guardar las métricas" };

function safeDays(value: unknown) { const days = Number(value); return Number.isInteger(days) ? Math.max(1, Math.min(30, days)) : 3; }
async function run(request: NextRequest, days: number, yesterday = false) {
  const auth = await authorizeGoogleAdsSync({ adminCookie: request.cookies.get(ADMIN_COOKIE)?.value, authorization: request.headers.get("authorization") });
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const result = await syncGoogleAds({ days, yesterday });
    return NextResponse.json({ synced_days: result.synced_days, campaigns: result.campaigns, rows_upserted: result.rows_upserted });
  } catch (error) {
    const safe = error instanceof GoogleAdsSyncError ? error : new GoogleAdsSyncError("api_error");
    return NextResponse.json({ error: MESSAGES[safe.code], code: safe.code }, { status: STATUS[safe.code] });
  }
}

export async function POST(request: NextRequest) {
  let days = 3; let yesterday = false; try { const body = await request.json(); days = safeDays(body?.days); yesterday = body?.range === "yesterday"; } catch { /* body opcional */ }
  return run(request, days, yesterday);
}

/** Vercel Cron invoca rutas mediante GET y Authorization Bearer CRON_SECRET. */
export async function GET(request: NextRequest) { return run(request, 3); }
