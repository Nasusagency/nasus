/**
 * Meta Ads (Facebook / Instagram): gasto, impresiones y clics por campaña y por día,
 * desde la Marketing API (Insights). Mismo destino que Google Ads:
 * acquisition_campaign_metrics con platform = "meta" y source_type = "synced".
 *
 * Funciones puras: sin red ni base de datos, para poder probarlas.
 */

export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION?.match(/^v\d{2}\.\d$/)?.[0] ?? "v23.0";

export type MetaAdsErrorCode =
  | "not_configured" | "invalid_credentials" | "permission_denied" | "invalid_account"
  | "rate_limited" | "timeout" | "api_error" | "database_error";

export class MetaAdsSyncError extends Error {
  constructor(public readonly code: MetaAdsErrorCode, public readonly missingVariables: string[] = []) {
    super(code);
  }
}

export const REQUIRED_META_ADS_ENV = ["META_ADS_ACCESS_TOKEN", "META_ADS_ACCOUNT_ID"] as const;

export function assertMetaAdsConfigured(env: Record<string, string | undefined> = process.env): void {
  const missing = REQUIRED_META_ADS_ENV.filter((name) => !env[name]?.trim());
  if (missing.length > 0) throw new MetaAdsSyncError("not_configured", [...missing]);
}

/** Acepta "act_123" o "123"; devuelve solo los dígitos. */
export function cleanAdAccountId(value: string | undefined): string {
  const id = value?.trim().replace(/^act_/i, "");
  if (!id) throw new MetaAdsSyncError("not_configured", ["META_ADS_ACCOUNT_ID"]);
  if (!/^\d{5,20}$/.test(id)) throw new MetaAdsSyncError("invalid_account");
  return id;
}

export type MetaDailyMetric = {
  campaignId: string;
  campaignName: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
};

const num = (value: unknown): number => {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

/**
 * Filas de /insights (level=campaign, time_increment=1) -> métricas diarias.
 * Clics = clics en el enlace (inline_link_clicks) y, si Meta no los da, clics totales.
 * Las filas sin campaña o con fecha inválida se descartan.
 */
export function transformMetaInsights(rows: unknown[], mapping: Record<string, string> = {}): MetaDailyMetric[] {
  return rows.flatMap((raw) => {
    const row = raw as Record<string, unknown>;
    const campaignId = String(row.campaign_id ?? "").trim();
    const original = String(row.campaign_name ?? "").trim();
    const date = String(row.date_start ?? "");
    if (!campaignId || !original || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const link = row.inline_link_clicks;
    return [{
      campaignId,
      campaignName: mapping[campaignId]?.trim() || original,
      date,
      impressions: Math.round(num(row.impressions)),
      clicks: Math.round(link !== undefined && link !== null && link !== "" ? num(link) : num(row.clicks)),
      spend: Math.round(num(row.spend) * 100) / 100,
    }];
  });
}

/** Mapa opcional id de campaña -> nombre canónico (JSON en META_ADS_CAMPAIGN_MAP). */
export function parseCampaignMapping(value: string | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === "string" && v.trim()).map(([k, v]) => [k, String(v)]));
  } catch {
    return {};
  }
}

export function syncDateRange(days = 3, now = new Date(), endOffsetDays = 0): { start: string; end: string; days: number } {
  const safeDays = Math.max(1, Math.min(30, Math.trunc(days) || 3));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - endOffsetDays));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (safeDays - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end), days: safeDays };
}

export function toSyncedMetricRows(metrics: MetaDailyMetric[], currency: string) {
  return metrics.map((metric) => ({
    platform: "meta" as const,
    campaign: metric.campaignName,
    metric_date: metric.date,
    impressions: metric.impressions,
    ad_clicks: metric.clicks,
    spend: metric.spend,
    currency,
    source_type: "synced" as const,
    external_campaign_id: metric.campaignId,
  }));
}

/**
 * Clasifica el error de la Graph API. Los códigos son los documentados por Meta:
 * 190 = token inválido o vencido; 10 y 200-299 = permisos; 4, 17, 32 y 613 = límite de uso;
 * 100 = parámetro inválido (cuenta publicitaria inexistente o sin acceso).
 */
export function classifyGraphError(status: number, body: string): MetaAdsSyncError {
  let code = 0;
  try { code = Number((JSON.parse(body) as { error?: { code?: unknown } }).error?.code) || 0; } catch { /* cuerpo no JSON */ }
  if (status === 401 || code === 190) return new MetaAdsSyncError("invalid_credentials");
  if (code === 10 || (code >= 200 && code <= 299) || status === 403) return new MetaAdsSyncError("permission_denied");
  if ([4, 17, 32, 613].includes(code) || status === 429) return new MetaAdsSyncError("rate_limited");
  if (code === 100 || status === 404) return new MetaAdsSyncError("invalid_account");
  return new MetaAdsSyncError("api_error");
}

export const META_ADS_ERROR_MESSAGES: Record<MetaAdsErrorCode, string> = {
  not_configured: "Meta Ads no está configurado",
  invalid_credentials: "El token de Meta Ads es inválido o venció",
  permission_denied: "El token de Meta Ads no tiene permiso (ads_read) sobre la cuenta publicitaria",
  invalid_account: "La cuenta publicitaria de Meta no existe o el token no tiene acceso a ella",
  rate_limited: "Meta limitó las consultas; intenta más tarde",
  timeout: "Meta Ads no respondió a tiempo",
  api_error: "Meta Ads devolvió un error",
  database_error: "No se pudieron guardar las métricas de Meta Ads",
};

export const META_ADS_ERROR_STATUS: Record<MetaAdsErrorCode, number> = {
  not_configured: 503, invalid_credentials: 502, permission_denied: 403, invalid_account: 502,
  rate_limited: 429, timeout: 504, api_error: 502, database_error: 500,
};
