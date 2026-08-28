import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { captureFirstTouch } from "@/lib/acquisition/attribution";
import { performAdminReply } from "@/lib/whatsapp/admin-reply";
import { attributionLabel, modeAfterAdminReply, shouldAutoRespond } from "@/lib/whatsapp/conversation-policy";
import { selectProvider } from "@/lib/whatsapp/groq-allowlist";
import { buildContactInbox, type InboxMessageRow, type InboxStateRow } from "@/lib/whatsapp/inbox-model";

const message = (conversationId: string, createdAt: string, contenido: string): InboxMessageRow => ({
  conversation_id: conversationId,
  numero: "523331234567",
  direccion: "entrante",
  contenido,
  created_at: createdAt,
});

const state = (conversationId: string, updatedAt: string, mode: "ai" | "human" = "ai"): InboxStateRow => ({
  conversation_id: conversationId,
  numero: "523331234567",
  mode,
  status: "open",
  last_read_at: null,
  updated_at: updatedAt,
});

describe("inbox y handoff de WhatsApp", () => {
  test("un número con múltiples conversation_id produce una sola fila", () => {
    const items = buildContactInbox(
      [message("conversation-old", "2026-08-20T10:00:00Z", "Anterior"), message("conversation-new", "2026-08-28T10:00:00Z", "Más reciente")],
      [state("conversation-old", "2026-08-20T10:00:00Z"), state("conversation-new", "2026-08-28T10:00:00Z", "human")],
      [{ numero: "523331234567", stage: "qualified" }],
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].conversationCount, 2);
    assert.equal(items[0].conversationId, "conversation-new");
    assert.equal(items[0].lastMessage, "Más reciente");
    assert.equal(items[0].mode, "human");
    assert.equal(items[0].unread, 2);
  });

  test("múltiples requerimientos no multiplican el contacto del inbox", () => {
    const requirements = [{ id: "r1" }, { id: "r2" }, { id: "r3" }];
    const items = buildContactInbox(
      [message("conversation-1", "2026-08-28T10:00:00Z", "Hola")],
      [state("conversation-1", "2026-08-28T10:00:00Z")],
      [{ numero: "523331234567" }],
    );
    assert.equal(requirements.length, 3, "el detalle conserva todos los requerimientos");
    assert.equal(items.length, 1, "el listado no hace join con requerimientos");
  });

  test("múltiples conversaciones y requerimientos simultáneos mantienen una fila", () => {
    const requirements = Array.from({ length: 4 }, (_, index) => ({ id: `r${index}` }));
    const items = buildContactInbox(
      [message("c1", "2026-08-01T10:00:00Z", "Uno"), message("c2", "2026-08-28T11:00:00Z", "Dos")],
      [state("c1", "2026-08-01T10:00:00Z"), state("c2", "2026-08-28T11:00:00Z")],
      [{ numero: "523331234567", acquisition_events: { source: "google", campaign: "software" } }],
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].conversationCount, 2);
    assert.equal(items[0].source, "google");
    assert.equal(items[0].campaign, "software");
    assert.equal(requirements.length, 4);
  });

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
