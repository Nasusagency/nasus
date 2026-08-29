import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  extractPhoneCandidates,
  parseExplicitConfirmation,
  runMasterAgent,
  type MasterAgentRepository,
  type MasterContact,
} from "../lib/whatsapp/master-agent";
import type { LLMResponse } from "../lib/llm/provider";

const contact: MasterContact = {
  id: "contact-1", numero: "523331234567", nombre_contacto: "Juan",
  nombre_empresa: "Clínica Uno", lifecycle: "lead", stage: "opportunity",
};

function tool(name: string, input: Record<string, unknown>): LLMResponse {
  return { content: [{ type: "tool_use", id: "tool-1", name, input }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: "tool_use", usedProvider: "groq" };
}

function repository(overrides: Partial<MasterAgentRepository> = {}): MasterAgentRepository {
  let state: Awaited<ReturnType<MasterAgentRepository["getState"]>> = null;
  return {
    getState: async () => state,
    setState: async (_id, value) => { state = value; },
    findContacts: async () => [contact],
    upsertManualContact: async input => ({ ...contact, numero: input.phone, stage: input.stage }),
    summarizeContact: async () => "Juan: lifecycle lead, stage opportunity. Sin propuesta.",
    resolveProposalForAcceptance: async () => "proposal-1",
    executeSensitive: async action => `executed:${action.action}:${action.contactId}`,
    ...overrides,
  };
}

describe("Master Agent por WhatsApp", () => {
  test("extrae y normaliza el teléfono server-side", () => {
    assert.deepEqual(extractPhoneCandidates("Juan del +52 1 333 123 4567 llamó"), ["523331234567"]);
  });

  test("solo acepta confirmaciones explícitas", () => {
    assert.equal(parseExplicitConfirmation("confirmo"), "confirm");
    assert.equal(parseExplicitConfirmation("sí, pero cambia el monto"), "unknown");
    assert.equal(parseExplicitConfirmation("cancelar"), "cancel");
  });

  test("crea el lead usando el teléfono del mensaje, no uno del LLM", async () => {
    let receivedPhone = "";
    const repo = repository({
      upsertManualContact: async input => { receivedPhone = input.phone; return { ...contact, numero: input.phone }; },
    });
    const result = await runMasterAgent({
      text: "Me habló Juan del +52 1 333 123 4567, tiene una clínica dental.",
      conversationId: "conversation-1", adminNumber: "523330000000",
    }, {
      repository: repo,
      callAgent: async () => tool("registrar_contacto_manual", {
        numero: "521111111111", nombre_contacto: "Juan", nombre_empresa: "Clínica", necesidad: "automatizar citas", stage: "opportunity",
      }),
    });
    assert.equal(receivedPhone, "523331234567");
    assert.match(result, /Registré a Juan/);
  });

  test("una búsqueda ambigua pide teléfono y no consulta un ID elegido por el LLM", async () => {
    let summarized = false;
    const repo = repository({
      findContacts: async () => [contact, { ...contact, id: "contact-2", numero: "523339999999" }],
      summarizeContact: async () => { summarized = true; return "incorrecto"; },
    });
    const result = await runMasterAgent({ text: "¿Qué pasó con Juan?", conversationId: "conversation-1", adminNumber: "admin" }, {
      repository: repo,
      callAgent: async () => tool("consultar_contacto_crm", { target_query: "Juan", contact_id: "inventado" }),
    });
    assert.equal(summarized, false);
    assert.match(result, /varias coincidencias/);
  });

  test("registra el canal real del evento cuando el admin lo menciona", async () => {
    let receivedSource = "";
    const repo = repository({
      upsertManualContact: async input => { receivedSource = input.source; return { ...contact, numero: input.phone }; },
    });
    await runMasterAgent({
      text: "Pedro aceptó $30,000 en la reunión de ayer, +52 333 123 4567.",
      conversationId: "conversation-1", adminNumber: "523330000000",
    }, {
      repository: repo,
      callAgent: async () => tool("registrar_contacto_manual", {
        nombre_contacto: "Pedro", necesidad: "aceptó propuesta en reunión", stage: "qualified", source: "meeting",
      }),
    });
    assert.equal(receivedSource, "meeting");
  });

  test("un source inventado o fuera del enum cae a whatsapp_manual, nunca se pasa tal cual", async () => {
    let receivedSource = "";
    const repo = repository({
      upsertManualContact: async input => { receivedSource = input.source; return { ...contact, numero: input.phone }; },
    });
    await runMasterAgent({
      text: "Habló Juan, +52 333 123 4567.",
      conversationId: "conversation-1", adminNumber: "523330000000",
    }, {
      repository: repo,
      callAgent: async () => tool("registrar_contacto_manual", { nombre_contacto: "Juan", stage: "exploring", source: "canal_inventado_por_el_llm" }),
    });
    assert.equal(receivedSource, "whatsapp_manual");
  });

  test("sin mención de canal, el default es whatsapp_manual", async () => {
    let receivedSource = "";
    const repo = repository({
      upsertManualContact: async input => { receivedSource = input.source; return { ...contact, numero: input.phone }; },
    });
    await runMasterAgent({
      text: "Habló Juan, +52 333 123 4567.",
      conversationId: "conversation-1", adminNumber: "523330000000",
    }, {
      repository: repo,
      callAgent: async () => tool("registrar_contacto_manual", { nombre_contacto: "Juan", stage: "exploring" }),
    });
    assert.equal(receivedSource, "whatsapp_manual");
  });

  test("una acción sensible requiere un segundo mensaje de confirmación", async () => {
    const repo = repository();
    const dependencies = { repository: repo, callAgent: async () => tool("proponer_accion_sensible", { target_query: "Juan", action: "mark_lost" }) };
    const first = await runMasterAgent({ text: "Marca lost a Juan +52 333 123 4567", conversationId: "conversation-1", adminNumber: "admin" }, dependencies);
    assert.match(first, /Responde “confirmo”/);
    const second = await runMasterAgent({ text: "confirmo", conversationId: "conversation-1", adminNumber: "admin" }, dependencies);
    assert.equal(second, "executed:mark_lost:contact-1");
  });
});
