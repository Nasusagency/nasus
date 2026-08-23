import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { calculateLeadAcquisitionCosts, CAMPAIGN_IMPRESSIONS_LABEL, campaignMetricRange } from "@/lib/acquisition/costs";

describe("atribución de costo en detalle de lead", () => {
  test("calcula promedios de una campaña pagada atribuida", () => {
    const result = calculateLeadAcquisitionCosts({ spend: 900, adClicks: 120, leads: 8, qualified: 4, highIntent: 2, hasPaidCampaign: true });
    assert.deepEqual(result, { averageCampaignCpc: 7.5, estimatedEntryCost: 7.5, allocatedCostPerLead: 112.5, costPerQualified: 225, costPerHighIntent: 450 });
  });
  test("denominadores cero producen desconocido, no cero inventado", () => {
    const result = calculateLeadAcquisitionCosts({ spend: 100, adClicks: 0, leads: 0, qualified: 0, highIntent: 0, hasPaidCampaign: true });
    assert.equal(result.averageCampaignCpc, null); assert.equal(result.estimatedEntryCost, null); assert.equal(result.allocatedCostPerLead, null); assert.equal(result.costPerQualified, null); assert.equal(result.costPerHighIntent, null);
  });
  test("spend NULL no genera costos", () => {
    const result = calculateLeadAcquisitionCosts({ spend: null, adClicks: 10, leads: 2, qualified: 1, highIntent: 1, hasPaidCampaign: true });
    assert.ok(Object.values(result).every(value => value === null));
  });
  test("organic y direct no reciben costo publicitario", () => {
    for (const source of ["organic", "direct"]) {
      const result = calculateLeadAcquisitionCosts({ spend: 500, adClicks: 20, leads: 3, qualified: 1, highIntent: 1, hasPaidCampaign: !["organic", "direct"].includes(source) });
      assert.ok(Object.values(result).every(value => value === null));
    }
  });
  test("las impresiones se presentan como agregadas, no individuales", () => {
    assert.match(CAMPAIGN_IMPRESSIONS_LABEL, /campaña/i); assert.doesNotMatch(CAMPAIGN_IMPRESSIONS_LABEL, /persona|lead vio/i);
  });
  test("usa el rango completo coherente de las métricas diarias", () => {
    assert.deepEqual(campaignMetricRange([{ metric_date: "2026-08-22" }, { metric_date: "2026-08-01" }, { metric_date: "2026-08-10" }]), { start: "2026-08-01", end: "2026-08-22" });
    assert.equal(campaignMetricRange([]), null);
  });
});
