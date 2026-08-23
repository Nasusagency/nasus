import { GoogleAuth } from "google-auth-library";
import { createServiceClient } from "@/lib/supabase/service";
import { GOOGLE_ADS_API_VERSION, GOOGLE_ADS_SCOPE, GoogleAdsSyncError, buildCampaignMetricsGaql, parseCampaignMapping, parseServiceAccountJson, syncDateRange, toSyncedMetricRows, transformGoogleAdsResults } from "@/lib/google-ads/core";
import { writeAdsSyncStatus } from "@/lib/acquisition/sync-status-server";

function cleanCustomerId(value: string | undefined): string {
  const id = value?.replace(/-/g, "").trim(); if (!id || !/^\d{10}$/.test(id)) throw new GoogleAdsSyncError("not_configured"); return id;
}

function classifyApiError(status: number, body: string): GoogleAdsSyncError {
  if (status === 401) return new GoogleAdsSyncError("invalid_credentials");
  if (status === 403 && /SERVICE_DISABLED|API has not been used/i.test(body)) return new GoogleAdsSyncError("api_not_enabled");
  if (status === 403) return new GoogleAdsSyncError("permission_denied");
  if (status === 404) return new GoogleAdsSyncError("invalid_customer");
  if (status === 429) return new GoogleAdsSyncError("rate_limited");
  return new GoogleAdsSyncError("api_error");
}

async function searchStream(query: string, accessToken: string, config: { developerToken: string; loginCustomerId: string; customerId: string }, fetcher: typeof fetch): Promise<any[]> {
  let response: Response;
  try {
    response = await fetcher(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${config.customerId}/googleAds:searchStream`, { method: "POST", signal: AbortSignal.timeout(25_000), headers: { authorization: `Bearer ${accessToken}`, "developer-token": config.developerToken, "login-customer-id": config.loginCustomerId, "content-type": "application/json" }, body: JSON.stringify({ query }) });
  } catch { throw new GoogleAdsSyncError("timeout"); }
  const body = await response.text(); if (!response.ok) throw classifyApiError(response.status, body.slice(0, 2000));
  try { const batches = JSON.parse(body) as Array<{ results?: any[] }>; return batches.flatMap(batch => batch.results ?? []); } catch { throw new GoogleAdsSyncError("api_error"); }
}

export async function fetchGoogleAdsMetrics(params: { days?: number; yesterday?: boolean; dryRun?: boolean; fetcher?: typeof fetch } = {}) {
  const credentials = parseServiceAccountJson(process.env.GOOGLE_ADS_SERVICE_ACCOUNT_JSON);
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN; if (!developerToken) throw new GoogleAdsSyncError("not_configured");
  const config = { developerToken, loginCustomerId: cleanCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID), customerId: cleanCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID) };
  const auth = new GoogleAuth({ credentials, scopes: [GOOGLE_ADS_SCOPE] });
  let accessToken: string; try { const token = await auth.getAccessToken(); if (!token) throw new Error("missing"); accessToken = token; } catch { throw new GoogleAdsSyncError("invalid_credentials"); }
  const fetcher = params.fetcher ?? fetch; const range = syncDateRange(params.yesterday ? 1 : params.days, new Date(), params.yesterday ? 1 : 0);
  const [results, customerResults] = await Promise.all([searchStream(buildCampaignMetricsGaql(range.start, range.end), accessToken, config, fetcher), searchStream("SELECT customer.currency_code FROM customer LIMIT 1", accessToken, config, fetcher)]);
  const currency = customerResults[0]?.customer?.currencyCode; if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) throw new GoogleAdsSyncError("api_error");
  const mapping = parseCampaignMapping(process.env.GOOGLE_ADS_CAMPAIGN_MAP);
  const metrics = transformGoogleAdsResults(results, mapping);
  return { range, currency, metrics };
}

export async function syncGoogleAds(params: { days?: number; yesterday?: boolean; dryRun?: boolean; fetcher?: typeof fetch } = {}) {
  const attemptAt = new Date().toISOString();
  if (!params.dryRun && !await writeAdsSyncStatus("google", { status: "pending", lastAttemptAt: attemptAt, lastErrorCode: null })) throw new GoogleAdsSyncError("database_error");
  try {
    const fetched = await fetchGoogleAdsMetrics(params);
    if (!params.dryRun && fetched.metrics.length) {
      const supabase = createServiceClient(); if (!supabase) throw new GoogleAdsSyncError("database_error");
      const syncedAt = new Date().toISOString();
      const { error } = await supabase.from("acquisition_campaign_metrics").upsert(toSyncedMetricRows(fetched.metrics, fetched.currency).map(row => ({ ...row, synced_at: syncedAt, updated_at: syncedAt })), { onConflict: "platform,campaign,metric_date,source_type" });
      if (error) throw new GoogleAdsSyncError("database_error");
    }
    const completedAt = new Date().toISOString();
    if (!params.dryRun && !await writeAdsSyncStatus("google", { status: "synced", lastSuccessAt: completedAt, lastAttemptAt: attemptAt, lastErrorCode: null })) throw new GoogleAdsSyncError("database_error");
    const campaigns = new Set(fetched.metrics.map(metric => metric.campaignName));
    console.info(`[google-ads-sync] synced ${fetched.range.days} days, ${campaigns.size} campaigns, ${fetched.metrics.length} rows`);
    return { synced_days: fetched.range.days, campaigns: campaigns.size, rows_upserted: params.dryRun ? 0 : fetched.metrics.length, dry_run: Boolean(params.dryRun), metrics: params.dryRun ? fetched.metrics : undefined };
  } catch (error) {
    const syncError = error instanceof GoogleAdsSyncError ? error : new GoogleAdsSyncError("api_error");
    if (!params.dryRun) await writeAdsSyncStatus("google", { status: "error", lastAttemptAt: attemptAt, lastErrorCode: syncError.code });
    throw syncError;
  }
}
