export type CampaignMetricSource = "manual" | "synced";
export type CampaignMetricRow = {
  platform: string; campaign: string; metric_date: string; source_type: CampaignMetricSource;
  impressions: number | null; ad_clicks: number | null; spend: number | null; currency: string;
};

/** Para cada campaña/día, synced gana; manual queda como fallback sin borrarse. */
export function selectPreferredMetricRows<T extends Pick<CampaignMetricRow, "platform" | "campaign" | "metric_date" | "source_type">>(rows: T[]): T[] {
  const selected = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.platform}\u0000${row.campaign}\u0000${row.metric_date}`;
    const current = selected.get(key);
    if (!current || (current.source_type === "manual" && row.source_type === "synced")) selected.set(key, row);
  }
  return [...selected.values()];
}
