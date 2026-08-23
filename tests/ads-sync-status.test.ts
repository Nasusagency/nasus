import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ADS_SYNC_LABELS, defaultAdsSyncStatuses, formatMexicoCityTimestamp } from "@/lib/acquisition/sync-status";

describe("Ads sync status", () => {
  test("presenta estados públicos en español", () => {
    assert.deepEqual(ADS_SYNC_LABELS, { synced: "Sincronizado", error: "Error", pending: "Pendiente" });
  });
  test("presenta la última sincronización en timezone de Ciudad de México", () => {
    const formatted = formatMexicoCityTimestamp("2026-08-22T15:30:00.000Z");
    assert.match(formatted, /22 ago 2026/); assert.match(formatted, /9:30/);
  });
  test("Google y ChatGPT quedan pendientes sin historial", () => {
    assert.deepEqual(defaultAdsSyncStatuses().map(item => [item.platform, item.status, item.lastSuccessAt]), [["google", "pending", null], ["chatgpt", "pending", null]]);
    assert.equal(formatMexicoCityTimestamp(null), "Sin sincronización exitosa");
  });
});
