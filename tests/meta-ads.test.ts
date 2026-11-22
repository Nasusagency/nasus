import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  MetaAdsSyncError, assertMetaAdsConfigured, classifyGraphError, cleanAdAccountId, parseCampaignMapping,
  syncDateRange, toSyncedMetricRows, transformMetaInsights,
} from "@/lib/meta-ads/core";
import { normalizeSource } from "@/lib/acquisition/attribution";

describe("Meta Ads: sincronización de gasto", () => {
  test("convierte insights diarios a métricas y filas de la tabla", () => {
    const metrics = transformMetaInsights([
      { campaign_id: "1", campaign_name: "Prueba", date_start: "2026-11-20", impressions: "1500", inline_link_clicks: "42", clicks: "90", spend: "123.456" },
      { campaign_id: "2", campaign_name: "Sin enlaces", date_start: "2026-11-20", impressions: "10", clicks: "3", spend: "0.5" },
    ]);
    assert.deepEqual(metrics[0], { campaignId: "1", campaignName: "Prueba", date: "2026-11-20", impressions: 1500, clicks: 42, spend: 123.46 });
    assert.equal(metrics[1].clicks, 3);
    const rows = toSyncedMetricRows(metrics, "MXN");
    assert.equal(rows[0].platform, "meta");
    assert.equal(rows[0].source_type, "synced");
    assert.equal(rows[0].ad_clicks, 42);
  });

  test("descarta filas sin campaña o con fecha inválida y valores raros", () => {
    const metrics = transformMetaInsights([
      { campaign_id: "", campaign_name: "x", date_start: "2026-11-20" },
      { campaign_id: "1", campaign_name: "ok", date_start: "ayer" },
      { campaign_id: "1", campaign_name: "ok", date_start: "2026-11-20", impressions: "-5", spend: "abc" },
    ]);
    assert.equal(metrics.length, 1);
    assert.equal(metrics[0].impressions, 0);
    assert.equal(metrics[0].spend, 0);
  });

  test("el mapa de campañas renombra por id", () => {
    const mapping = parseCampaignMapping('{"1":"Nombre canónico"}');
    assert.equal(transformMetaInsights([{ campaign_id: "1", campaign_name: "Otro", date_start: "2026-11-20" }], mapping)[0].campaignName, "Nombre canónico");
    assert.deepEqual(parseCampaignMapping("no es json"), {});
  });

  test("cuenta publicitaria: acepta act_ y valida", () => {
    assert.equal(cleanAdAccountId("act_123456789"), "123456789");
    assert.equal(cleanAdAccountId("123456789"), "123456789");
    assert.throws(() => cleanAdAccountId("abc"), (e) => e instanceof MetaAdsSyncError && e.code === "invalid_account");
    assert.throws(() => cleanAdAccountId(undefined), (e) => e instanceof MetaAdsSyncError && e.code === "not_configured");
  });

  test("avisa qué variables faltan", () => {
    assert.throws(() => assertMetaAdsConfigured({}), (e) => e instanceof MetaAdsSyncError && e.missingVariables.length === 2);
    assert.doesNotThrow(() => assertMetaAdsConfigured({ META_ADS_ACCESS_TOKEN: "x", META_ADS_ACCOUNT_ID: "1" }));
  });

  test("clasifica los errores de la Graph API", () => {
    assert.equal(classifyGraphError(400, '{"error":{"code":190}}').code, "invalid_credentials");
    assert.equal(classifyGraphError(403, '{"error":{"code":200}}').code, "permission_denied");
    assert.equal(classifyGraphError(400, '{"error":{"code":17}}').code, "rate_limited");
    assert.equal(classifyGraphError(400, '{"error":{"code":100}}').code, "invalid_account");
    assert.equal(classifyGraphError(500, "no json").code, "api_error");
  });

  test("rango de fechas: tope de 30 días y 'ayer'", () => {
    const now = new Date("2026-11-22T15:00:00Z");
    assert.deepEqual(syncDateRange(3, now), { start: "2026-11-20", end: "2026-11-22", days: 3 });
    assert.equal(syncDateRange(999, now).days, 30);
    assert.deepEqual(syncDateRange(1, now, 1), { start: "2026-11-21", end: "2026-11-21", days: 1 });
  });

  test("la fuente 'meta' coincide con la plataforma que se sincroniza", () => {
    assert.equal(normalizeSource("meta"), "meta");
    assert.equal(normalizeSource("Instagram_Ads"), "meta");
  });
});
