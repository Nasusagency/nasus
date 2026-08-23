import { fetchGoogleAdsMetrics } from "@/lib/google-ads/sync";

async function main() {
  const required = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_LOGIN_CUSTOMER_ID", "GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_SERVICE_ACCOUNT_JSON"];
  if (required.some(name => !process.env[name])) { console.info("[google-ads-smoke] omitido: faltan variables locales de Google Ads"); return; }
  try {
    const result = await fetchGoogleAdsMetrics({ days: 3, dryRun: true });
    console.table(result.metrics.map(metric => ({ campaign: metric.campaignName, date: metric.date, impressions: metric.impressions, clicks: metric.clicks, spend: metric.spend })));
  } catch { console.error("[google-ads-smoke] falló la consulta; revisa acceso, IDs, developer token y API habilitada"); process.exitCode = 1; }
}
void main();
