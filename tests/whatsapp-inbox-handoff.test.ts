import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { captureFirstTouch } from "@/lib/acquisition/attribution";
import { performAdminReply } from "@/lib/whatsapp/admin-reply";
import { attributionLabel, modeAfterAdminReply, shouldAutoRespond } from "@/lib/whatsapp/conversation-policy";
import { selectProvider } from "@/lib/whatsapp/groq-allowlist";

describe("inbox y handoff de WhatsApp", () => {
  test("Google conserva el first touch al convertir por WhatsApp", () => {
    const first = captureFirstTouch(null, new URLSearchParams("utm_source=google&utm_medium=cpc&utm_campaign=software"), null);
    const afterWhatsApp = captureFirstTouch(first, new URLSearchParams("utm_source=whatsapp"), null);
    assert.equal(afterWhatsApp.source, "google");
    assert.equal(afterWhatsApp.campaign, "software");
  });

  test("respuesta admin persiste saliente y cambia mode a human antes de enviar", async () => {
    const events: string[] = [];
    let delivery = "pending";
    const result = await performAdminReply({
      reserve: async () => { events.push("message:reserved:human"); return "reserved"; },
      takeConversation: async () => { events.push(`mode:${modeAfterAdminReply()}`); return true; },
      send: async () => { events.push("whatsapp:sent"); },
      markDelivery: async status => { delivery = status; events.push(`delivery:${status}`); },
    });
    assert.equal(result.ok, true);
    assert.equal(delivery, "sent");
    assert.deepEqual(events, ["message:reserved:human", "mode:human", "whatsapp:sent", "delivery:sent"]);
  });

  test("mode human y paused no permiten respuesta automática", () => {
    assert.equal(shouldAutoRespond("human"), false);
    assert.equal(shouldAutoRespond("paused"), false);
  });

  test("devolver a IA permite que el siguiente mensaje use Groq", () => {
    assert.equal(shouldAutoRespond("ai"), true);
    assert.equal(selectProvider("523331234567", "groq", "523331234567"), "groq");
  });

  test("request id repetido no vuelve a enviar ni persistir", async () => {
    let sends = 0;
    let handoffs = 0;
    const result = await performAdminReply({
      reserve: async () => "duplicate",
      takeConversation: async () => { handoffs++; return true; },
      send: async () => { sends++; },
      markDelivery: async () => {},
    });
    assert.deepEqual(result, { ok: true, duplicate: true });
    assert.equal(sends, 0);
    assert.equal(handoffs, 0);
  });

  test("conversación sin atribución no inventa origen", () => {
    assert.equal(attributionLabel(null), "Unknown / Direct");
  });

  test("demo y humano respetan allowlist además del handoff", () => {
    assert.equal(selectProvider("523331234567", "groq", "523331234567"), "groq");
    assert.equal(selectProvider("523339999999", "groq", "523331234567"), "claude");
    assert.equal(shouldAutoRespond("human"), false);
  });
});
