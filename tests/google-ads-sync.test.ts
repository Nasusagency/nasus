import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { signAdminToken } from "@/lib/admin/auth";
import { selectPreferredMetricRows } from "@/lib/acquisition/campaign-metrics";
import { authorizeGoogleAdsSync } from "@/lib/google-ads/endpoint-auth";
import { GoogleAdsSyncError, assertGoogleAdsConfigured, buildCampaignMetricsGaql, microsToCurrency, parseServiceAccountJson, publicGoogleAdsError, resolveCampaignKey, syncDateRange, toSyncedMetricRows, transformGoogleAdsResults } from "@/lib/google-ads/core";

describe("Google Ads sync", () => {
  test("configuration preflight reports missing variable names", () => {
    assert.throws(() => assertGoogleAdsConfigured({ GOOGLE_ADS_DEVELOPER_TOKEN: "set" }), (error: unknown) => error instanceof GoogleAdsSyncError && error.missingVariables.includes("GOOGLE_ADS_CUSTOMER_ID"));
    assert.doesNotThrow(() => assertGoogleAdsConfigured({ GOOGLE_ADS_DEVELOPER_TOKEN: "set", GOOGLE_ADS_LOGIN_CUSTOMER_ID: "1234567890", GOOGLE_ADS_CUSTOMER_ID: "0987654321", GOOGLE_ADS_SERVICE_ACCOUNT_JSON: "{json}" }));
  });
  test("parsea service account JSON válido y rechaza JSON inválido", () => {
    const input = JSON.stringify({ type: "service_account", client_email: "sync@example.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\nmock\n-----END PRIVATE KEY-----", project_id: "demo" });
    assert.equal(parseServiceAccountJson(input).client_email, "sync@example.iam.gserviceaccount.com");
    assert.throws(() => parseServiceAccountJson("{bad"), (error: unknown) => error instanceof GoogleAdsSyncError && error.code === "invalid_credentials");
  });
  test("convierte micros sin perder precisión útil", () => {
    assert.equal(microsToCurrency("7031250"), 7.03125); assert.equal(microsToCurrency(undefined), null);
  });
  test("mapea campaign ID a utm_campaign y cae al nombre", () => {
    assert.equal(resolveCampaignKey("123", "Nombre Google", { "123": "nasus_mundo_test" }), "nasus_mundo_test");
    assert.equal(resolveCampaignKey("456", "Nombre Google", {}), "Nombre Google");
  });
  test("transforma una respuesta mock de Google, incluidos ceros", () => {
    const metrics = transformGoogleAdsResults([{ campaign: { id: "123", name: "Google Campaign", status: "ENABLED" }, segments: { date: "2026-08-22" }, metrics: { impressions: "0", clicks: "0", costMicros: "0" } }], { "123": "utm_key" });
    assert.deepEqual(metrics[0], { campaignId: "123", campaignName: "utm_key", campaignStatus: "ENABLED", date: "2026-08-22", impressions: 0, clicks: 0, spend: 0 });
  });
  test("upsert es determinista, synced no se convierte en manual", () => {
    const metric = { campaignId: "1", campaignName: "camp", campaignStatus: "ENABLED", date: "2026-08-22", impressions: 10, clicks: 2, spend: 3 };
    assert.deepEqual(toSyncedMetricRows([metric], "MXN"), toSyncedMetricRows([metric], "MXN"));
    assert.equal(toSyncedMetricRows([metric], "MXN")[0].source_type, "synced");
  });
  test("dashboard prioriza synced por día y conserva manual como fallback", () => {
    const manual = { platform: "google", campaign: "camp", metric_date: "2026-08-22", source_type: "manual" as const, spend: 9 };
    const synced = { ...manual, source_type: "synced" as const, spend: 7 };
    assert.deepEqual(selectPreferredMetricRows([manual, synced]), [synced]);
    assert.deepEqual(selectPreferredMetricRows([manual]), [manual]);
  });
  test("rango default re-sincroniza tres días y GAQL sólo usa fechas validadas", () => {
    assert.deepEqual(syncDateRange(3, new Date("2026-08-22T12:00:00Z")), { start: "2026-08-20", end: "2026-08-22", days: 3 });
    assert.deepEqual(syncDateRange(1, new Date("2026-08-22T12:00:00Z"), 1), { start: "2026-08-21", end: "2026-08-21", days: 1 });
    assert.match(buildCampaignMetricsGaql("2026-08-20", "2026-08-22"), /BETWEEN '2026-08-20' AND '2026-08-22'/);
    assert.throws(() => buildCampaignMetricsGaql("2026-08-20' OR 1=1", "2026-08-22"));
  });
  test("endpoint rechaza no autorizado y acepta cron/admin", async () => {
    assert.equal(await authorizeGoogleAdsSync({}, "cron-secret"), null);
    assert.equal(await authorizeGoogleAdsSync({ authorization: "Bearer cron-secret" }, "cron-secret"), "cron");
    const previous = process.env.ADMIN_JWT_SECRET; process.env.ADMIN_JWT_SECRET = "test-secret";
    try { assert.equal(await authorizeGoogleAdsSync({ adminCookie: await signAdminToken() }, "cron-secret"), "admin"); } finally { process.env.ADMIN_JWT_SECRET = previous; }
  });
  test("errores públicos nunca incluyen secretos", () => {
    const privateKey = "-----BEGIN PRIVATE KEY-----SECRET";
    const safe = publicGoogleAdsError(new Error(privateKey));
    assert.equal(safe.code, "api_error"); assert.doesNotMatch(JSON.stringify(safe), /PRIVATE KEY|SECRET/);
  });
});
