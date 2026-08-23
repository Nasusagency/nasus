import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { captureFirstTouch, extractAttributionToken, matchesAcquisitionFilters, normalizeSource, safeRate } from "@/lib/acquisition/attribution";

describe("atribución de adquisición", () => {
  test("normaliza fuentes UTM y referrer", () => {
    assert.equal(normalizeSource("ChatGPT-Ads"), "chatgpt");
    assert.equal(normalizeSource("google_ads"), "google");
    assert.equal(normalizeSource(null, "https://www.google.com/search?q=nasus"), "organic");
    assert.equal(normalizeSource(null, null), "direct");
  });
  test("captura UTMs y conserva la atribución original", () => {
    const first = captureFirstTouch(null, new URLSearchParams("utm_source=chatgpt&utm_campaign=lanzamiento"), "https://chatgpt.com/");
    assert.equal(first.source, "chatgpt"); assert.equal(first.campaign, "lanzamiento");
    const preserved = captureFirstTouch(first, new URLSearchParams("utm_source=google&utm_campaign=otra"), null);
    assert.deepEqual(preserved, first);
  });
  test("extrae código corto y no lo deja llegar al LLM o historial", () => {
    assert.deepEqual(extractAttributionToken("Hola, quiero una demo.\n\n[N:ABCD2345]"), { cleanText: "Hola, quiero una demo.", attributionId: "ABCD2345" });
  });
  test("un usuario sin atribución sigue intacto", () => {
    assert.deepEqual(extractAttributionToken("Necesito ayuda"), { cleanText: "Necesito ayuda", attributionId: null });
  });
  test("filtros de source y campaign son combinables", () => {
    const row = { source: "chatgpt", campaign: "nasus-admin" };
    assert.equal(matchesAcquisitionFilters(row, "chatgpt", "nasus-admin"), true);
    assert.equal(matchesAcquisitionFilters(row, "google"), false);
  });
  test("tasas del funnel evitan división entre cero", () => {
    assert.equal(safeRate(2, 8), 25);
    assert.equal(safeRate(2, 0), null);
  });
});
