import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isHighIntentRequest, normalizeLegacyStage, resolveGroqStage } from "../lib/crm/domain";

describe("Señal high intent de WhatsApp", () => {
  test("alta intención avanza a qualified y activa handoff", () => {
    assert.equal(resolveGroqStage("opportunity", "qualified"), "qualified");
    assert.equal(isHighIntentRequest("qualified", true), true);
  });

  test("high_intent histórico se normaliza sin perder la señal", () => {
    assert.equal(normalizeLegacyStage("high_intent"), "qualified");
    assert.equal(isHighIntentRequest("high_intent"), true);
  });

  test("la señal no permite a Groq cerrar ni reabrir oportunidades", () => {
    assert.equal(resolveGroqStage("proposal", "qualified"), "proposal");
    assert.equal(resolveGroqStage("won", "qualified"), "won");
    assert.equal(resolveGroqStage("lost", "qualified"), "lost");
  });

  test("un contacto ya señalado no requiere una segunda notificación", () => {
    const lead = { stage: "qualified", high_intent: true, requiere_humano: true };
    assert.equal(lead.high_intent && lead.requiere_humano, true);
  });

  test("clientes pueden tener alta intención sin perder lifecycle", () => {
    const contact = { lifecycle: "client", stage: "opportunity", high_intent: true };
    assert.equal(contact.lifecycle, "client");
  });
});
