import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { calculateCampaignEfficiency, divideCost, sumKnown } from "@/lib/acquisition/costs";

describe("costos de adquisición", () => {
  test("preserva desconocido frente a cero real", () => {
    assert.equal(sumKnown([null, null]), null);
    assert.equal(sumKnown([null, 0]), 0);
  });
  test("calcula CPC, CPM y costos owned", () => {
    const result = calculateCampaignEfficiency({ spend: 1000, impressions: 10000, adClicks: 200, visits: 100, whatsappClicks: 20, conversations: 10, leads: 8, qualified: 4, highIntent: 2 });
    assert.deepEqual(result, { cpc: 5, cpm: 100, ctr: 2, costPerVisit: 10, costPerWhatsappClick: 50, costPerConversation: 100, costPerLead: 125, costPerQualified: 250, costPerHighIntent: 500 });
  });
  test("toda división con cero o null es segura", () => {
    assert.equal(divideCost(100, 0), null); assert.equal(divideCost(100, null), null); assert.equal(divideCost(null, 10), null);
  });
});
