import test from "node:test";
import assert from "node:assert/strict";
import { summarizeByPlatform } from "@/lib/admin/acquisition-data";
import { toSyncedMetricRows as googleRows } from "@/lib/google-ads/core";
import { toSyncedMetricRows as metaRows } from "@/lib/meta-ads/core";

test("resumen por plataforma suma gasto, clics y leads y calcula costos con ceros reales", () => {
  const rows = summarizeByPlatform([
    { platform: "google", currency: "MXN", spend: 192.32, impressions: 1000, adClicks: 80, visits: 96, whatsappClicks: 3, leads: 1 },
    { platform: "meta", currency: "MXN", spend: 130.69, impressions: 2000, adClicks: 0, visits: 0, whatsappClicks: 0, leads: 0 },
    { platform: "meta", currency: "MXN", spend: 96.19, impressions: 1500, adClicks: 0, visits: 0, whatsappClicks: 0, leads: 0 },
  ]);
  assert.equal(rows.length, 2);
  const meta = rows.find((r) => r.platform === "meta")!;
  assert.equal(meta.campaigns, 2);
  assert.equal(Math.round((meta.spend ?? 0) * 100) / 100, 226.88);
  assert.equal(meta.impressions, 3500);
  assert.equal(meta.costPerLead, null); // sin leads no se inventa un costo
  const google = rows.find((r) => r.platform === "google")!;
  assert.equal(google.costPerLead, 192.32);
  assert.equal(google.cpc, 2.4);
  assert.equal(rows[0].platform, "meta"); // ordenado por gasto: Meta suma 226.88 vs Google 192.32
});

test("gasto desconocido se queda en null, no en cero", () => {
  const [row] = summarizeByPlatform([{ platform: "chatgpt", currency: "MXN", spend: null, impressions: null, adClicks: null, visits: 2, leads: 0 }]);
  assert.equal(row.spend, null);
  assert.equal(row.costPerVisit, null);
});

test("las sincronizaciones guardan el id de campaña de la plataforma", () => {
  const g = googleRows([{ campaignId: "24174632575", campaignName: "Proyectos De Software", campaignStatus: "ENABLED", date: "2026-11-25", impressions: 10, clicks: 2, spend: 5 }], "MXN");
  assert.equal(g[0].external_campaign_id, "24174632575");
  const m = metaRows([{ campaignId: "120210000000000", campaignName: "Publicación de Instagram", date: "2026-11-25", impressions: 10, clicks: 2, spend: 5 }], "MXN");
  assert.equal(m[0].external_campaign_id, "120210000000000");
});
