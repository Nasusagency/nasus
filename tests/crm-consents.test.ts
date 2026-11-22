import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isOptOutMessage, latestPerChannel } from "@/lib/crm/consents";
import { CONSENT_TEXT } from "@/lib/crm/consent-text";

describe("permisos de contacto", () => {
  test("BAJA solo cuenta como mensaje completo", () => {
    for (const t of ["baja", "BAJA", " Baja. ", "stop", "Cancelar", "darme de baja", "¡Baja!"]) assert.equal(isOptOutMessage(t), true, t);
    for (const t of ["baja de precio", "¿hay baja de costos?", "quiero cotizar", "hola", ""]) assert.equal(isOptOutMessage(t), false, t);
  });

  test("la decisión más reciente de cada canal gana", () => {
    const rows = [
      { channel: "whatsapp" as const, status: "revoked" as const, source: "whatsapp", created_at: "2026-11-22T10:00:00Z" },
      { channel: "email" as const, status: "granted" as const, source: "web_form", created_at: "2026-11-21T10:00:00Z" },
      { channel: "whatsapp" as const, status: "granted" as const, source: "web_form", created_at: "2026-11-21T10:00:00Z" },
    ];
    const state = latestPerChannel(rows);
    assert.equal(state.find((s) => s.channel === "whatsapp")?.status, "revoked");
    assert.equal(state.find((s) => s.channel === "email")?.status, "granted");
  });

  test("los textos de permiso mencionan el canal y la baja", () => {
    assert.match(CONSENT_TEXT.whatsapp, /WhatsApp/);
    assert.match(CONSENT_TEXT.email, /correo/);
    for (const text of Object.values(CONSENT_TEXT)) assert.match(text, /baja/);
  });
});
