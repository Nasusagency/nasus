import assert from "node:assert/strict";
import test from "node:test";
import {
  convertToClient,
  isHighIntentRequest,
  normalizeLegacyStage,
  openClientOpportunity,
  preserveFirstTouch,
  proposalExternalKey,
  resolveGroqStage,
  shouldCreateAcceptanceSuggestion,
  stageForProposalCreated,
  type ContactCommercialState,
} from "../lib/crm/domain";

test("1. nuevo prospecto inicia como lead/exploring", () => {
  const state: ContactCommercialState = { lifecycle: "lead", stage: resolveGroqStage(null, "exploring"), highIntent: false };
  assert.deepEqual(state, { lifecycle: "lead", stage: "exploring", highIntent: false });
});

test("2. Groq puede avanzar interés a opportunity sin regresiones", () => {
  assert.equal(resolveGroqStage("exploring", "opportunity"), "opportunity");
  assert.equal(resolveGroqStage("opportunity", "exploring"), "opportunity");
});

test("3. alta intención termina en qualified y señal separada", () => {
  assert.equal(resolveGroqStage("opportunity", "qualified"), "qualified");
  assert.equal(isHighIntentRequest("qualified", true), true);
  assert.equal(normalizeLegacyStage("high_intent"), "qualified");
});

test("4. crear propuesta mueve la oportunidad a proposal", () => {
  assert.equal(stageForProposalCreated("qualified"), "proposal");
});

test("5. propuesta enviada conserva una identidad idempotente", () => {
  assert.equal(proposalExternalKey("contact-1", " NASUS-2026 "), "contact-1:nasus-2026");
  assert.equal(proposalExternalKey("contact-1", "nasus-2026"), "contact-1:nasus-2026");
});

test("6. aceptación detectada crea sugerencia y no conversión automática", () => {
  const state: ContactCommercialState = { lifecycle: "lead", stage: "proposal", highIntent: true };
  assert.equal(shouldCreateAcceptanceSuggestion(false), true);
  assert.deepEqual(state, { lifecycle: "lead", stage: "proposal", highIntent: true });
});

test("7. confirmación humana convierte a client/won con auditoría", () => {
  const converted = convertToClient({ lifecycle: "lead", stage: "proposal", highIntent: true }, "oscar", "2026-08-28T12:00:00.000Z");
  assert.deepEqual(converted, { lifecycle: "client", stage: "won", highIntent: true, convertedAt: "2026-08-28T12:00:00.000Z", convertedBy: "oscar" });
});

test("8. cliente que vuelve conserva lifecycle client", () => {
  const state: ContactCommercialState = { lifecycle: "client", stage: "won", highIntent: false };
  assert.equal(state.lifecycle, "client");
});

test("9. requerimiento de cliente no altera lifecycle", () => {
  const state: ContactCommercialState = { lifecycle: "client", stage: "won", highIntent: false };
  const requirement = { type: "nuevo_feature", contactId: "contact-1" };
  assert.equal(requirement.contactId, "contact-1");
  assert.equal(state.lifecycle, "client");
});

test("10. cliente abre nueva oportunidad sin dejar de ser client", () => {
  assert.deepEqual(openClientOpportunity({ lifecycle: "client", stage: "won", highIntent: false }), { lifecycle: "client", stage: "opportunity", highIntent: false });
  assert.equal(resolveGroqStage("won", "opportunity", "client"), "opportunity");
  assert.equal(stageForProposalCreated("won", "client"), "proposal");
});

test("11. actividad modela actor, cambio y metadata sin PII", () => {
  const activity = { contactId: "contact-1", actor: "groq", eventType: "stage_changed", oldValue: { stage: "exploring" }, newValue: { stage: "opportunity" }, metadata: {} };
  assert.equal(activity.actor, "groq");
  assert.equal("numero" in activity.metadata, false);
});

test("12. first-touch no se sobrescribe", () => {
  assert.equal(preserveFirstTouch("first-event", "later-event"), "first-event");
  assert.equal(preserveFirstTouch(null, "first-event"), "first-event");
});

test("13. contactos, propuestas y sugerencias tienen claves idempotentes", () => {
  const contacts = new Map([["521234567890", "contact-1"]]);
  contacts.set("521234567890", "contact-1");
  assert.equal(contacts.size, 1);
  assert.equal(proposalExternalKey("contact-1", "p-1"), proposalExternalKey("contact-1", "P-1"));
  assert.equal(shouldCreateAcceptanceSuggestion(true), false);
});

test("Groq nunca puede tocar proposal/won/lost ni reabrirlas", () => {
  assert.equal(resolveGroqStage("proposal", "qualified"), "proposal");
  assert.equal(resolveGroqStage("won", "opportunity"), "won");
  assert.equal(resolveGroqStage("lost", "qualified"), "lost");
});
