import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { writeAdsSyncStatus } from "@/lib/acquisition/sync-status-server";
import {
  META_GRAPH_VERSION, MetaAdsSyncError, assertMetaAdsConfigured, classifyGraphError, cleanAdAccountId,
  parseCampaignMapping, syncDateRange, toSyncedMetricRows, transformMetaInsights,
} from "./core";

type Fetcher = typeof fetch;
const MAX_PAGES = 20;

async function graphGet(url: string, token: string, fetcher: Fetcher): Promise<{ data?: unknown[]; paging?: { next?: string } }> {
  let response: Response;
  try {
    // El token va en el header, nunca en la URL (las URL acaban en logs).
    response = await fetcher(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(25_000) });
  } catch {
    throw new MetaAdsSyncError("timeout");
  }
  const body = await response.text();
  if (!response.ok) throw classifyGraphError(response.status, body.slice(0, 2000));
  try { return JSON.parse(body); } catch { throw new MetaAdsSyncError("api_error"); }
}

export async function fetchMetaAdsMetrics(params: { days?: number; yesterday?: boolean; fetcher?: Fetcher } = {}) {
  assertMetaAdsConfigured();
  const token = process.env.META_ADS_ACCESS_TOKEN!.trim();
  const accountId = cleanAdAccountId(process.env.META_ADS_ACCOUNT_ID);
  const fetcher = params.fetcher ?? fetch;
  const range = syncDateRange(params.yesterday ? 1 : params.days, new Date(), params.yesterday ? 1 : 0);
  const base = `https://graph.facebook.com/${META_GRAPH_VERSION}/act_${accountId}`;

  const account = await graphGet(`https://graph.facebook.com/${META_GRAPH_VERSION}/act_${accountId}?fields=currency`, token, fetcher) as { currency?: unknown };
  const currency = typeof account.currency === "string" && /^[A-Z]{3}$/.test(account.currency) ? account.currency : null;
  if (!currency) throw new MetaAdsSyncError("api_error");

  const query = new URLSearchParams({
    level: "campaign",
    time_increment: "1",
    time_range: JSON.stringify({ since: range.start, until: range.end }),
    fields: "campaign_id,campaign_name,impressions,inline_link_clicks,clicks,spend",
    limit: "500",
  });
  const rows: unknown[] = [];
  let next: string | undefined = `${base}/insights?${query}`;
  for (let page = 0; next && page < MAX_PAGES; page++) {
    const result = await graphGet(next, token, fetcher);
    rows.push(...(result.data ?? []));
    next = result.paging?.next;
  }
  const metrics = transformMetaInsights(rows, parseCampaignMapping(process.env.META_ADS_CAMPAIGN_MAP));
  return { range, currency, metrics };
}

export async function syncMetaAds(params: { days?: number; yesterday?: boolean } = {}) {
  assertMetaAdsConfigured();
  const attemptAt = new Date().toISOString();
  await writeAdsSyncStatus("meta", { status: "pending", lastAttemptAt: attemptAt, lastErrorCode: null });
  try {
    const fetched = await fetchMetaAdsMetrics(params);
    if (fetched.metrics.length) {
      const supabase = createServiceClient();
      if (!supabase) throw new MetaAdsSyncError("database_error");
      const syncedAt = new Date().toISOString();
      const { error } = await supabase.from("acquisition_campaign_metrics").upsert(
        toSyncedMetricRows(fetched.metrics, fetched.currency).map((row) => ({ ...row, synced_at: syncedAt, updated_at: syncedAt })),
        { onConflict: "platform,campaign,metric_date,source_type" },
      );
      if (error) throw new MetaAdsSyncError("database_error");
    }
    await writeAdsSyncStatus("meta", { status: "synced", lastSuccessAt: new Date().toISOString(), lastAttemptAt: attemptAt, lastErrorCode: null });
    const campaigns = new Set(fetched.metrics.map((metric) => metric.campaignName));
    console.info(`[meta-ads-sync] synced ${fetched.range.days} days, ${campaigns.size} campaigns, ${fetched.metrics.length} rows`);
    return { synced_days: fetched.range.days, campaigns: campaigns.size, rows_upserted: fetched.metrics.length };
  } catch (error) {
    const safe = error instanceof MetaAdsSyncError ? error : new MetaAdsSyncError("api_error");
    await writeAdsSyncStatus("meta", { status: "error", lastAttemptAt: attemptAt, lastErrorCode: safe.code });
    throw safe;
  }
}
