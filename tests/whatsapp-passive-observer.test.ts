import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  gateHumanObservation,
  observeHumanMessage,
  type PassiveObserverRepository,
} from "../lib/whatsapp/passive-observer";
import type { LLMResponse } from "../lib/llm/provider";

function response(input: Record<string, unknown>): LLMResponse {
  return {
    content: [{ type: "tool_use", id: "observer-1", name: "registrar_senal_comercial", input }],
    usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: "tool_use", usedProvider: "groq",
  };
}

function repository(overrides: Partial<PassiveObserverRepository> = {}): PassiveObserverRepository {
  return {
    canObserve: async () => true,
    alreadyProcessed: async () => false,
    apply: async () => "applied",
    ...overrides,
  };
}

describe("gating determinista del observador humano", () => {
  test("mensajes triviales no invocan IA", () => {
    for (const text of ["gracias", "Ok!", "perfecto", "👍", "sí"]) {
      assert.equal(gateHumanObservation(text).observe, false, text);
    }
  });

  test("detecta señales comerciales concretas", () => {
    assert.equal(gateHumanObservation("Somos Clínica Norte y queremos automatizar las citas").observe, true);
    assert.equal(gateHumanObservation("Aceptamos la propuesta y podemos pagar el anticipo").observe, true);
    assert.equal(gateHumanObservation("Hay que agregar otro módulo al alcance").observe, true);
  });

  test("conversación social sin señal comercial no invoca IA", () => {
    assert.deepEqual(gateHumanObservation("Espero que estés teniendo un buen día"), { observe: false, reason: "no_commercial_signal" });
  });
});

describe("observación pasiva event-driven", () => {
  test("un mensaje trivial no llama al proveedor ni persiste", async () => {
    let calls = 0;
    let applies = 0;
    const result = await observeHumanMessage({ text: "gracias", conversationId: "c1", messageId: "wamid-1", direction: "inbound" }, {
      repository: repository({ apply: async () => { applies++; return "applied"; } }),
      callObserver: async () => { calls++; return response({}); },
    });
    assert.deepEqual(result, { observed: false, reason: "trivial" });
    assert.equal(calls, 0);
    assert.equal(applies, 0);
  });

  test("un message_id procesado evita otra llamada al LLM", async () => {
    let calls = 0;
    const result = await observeHumanMessage({ text: "Quiero una cotización", conversationId: "c1", messageId: "wamid-1", direction: "inbound" }, {
      repository: repository({ alreadyProcessed: async () => true }),
      callObserver: async () => { calls++; return response({}); },
    });
    assert.deepEqual(result, { observed: false, reason: "duplicate" });
    assert.equal(calls, 0);
  });

  test("sin contacto canónico o fuera de human no consume tokens", async () => {
    let calls = 0;
    const result = await observeHumanMessage({ text: "Quiero una cotización", conversationId: "c1", messageId: "wamid-x", direction: "inbound" }, {
      repository: repository({ canObserve: async () => false }),
      callObserver: async () => { calls++; return response({}); },
    });
    assert.deepEqual(result, { observed: false, reason: "contact_unavailable" });
    assert.equal(calls, 0);
  });

  test("persiste señal relevante sin producir respuesta para el contacto", async () => {
    let applied: Parameters<PassiveObserverRepository["apply"]>[0] | undefined;
    const result = await observeHumanMessage({
      text: "Somos Clínica Norte y necesitamos automatizar citas",
      conversationId: "c1", messageId: "wamid-2", direction: "inbound",
    }, {
      repository: repository({ apply: async input => { applied = input; return "applied"; } }),
      callObserver: async params => {
        assert.equal(params.tool_choice?.type, "tool");
        return response({ nombre_empresa: "Clínica Norte", necesidad: "Automatizar citas", stage_suggestion: "opportunity" });
      },
    });
    assert.deepEqual(result, { observed: true, reason: "applied" });
    assert.equal(applied?.conversationId, "c1");
    assert.equal(applied?.observation.stage_suggestion, "opportunity");
  });

  test("aceptación se conserva como sugerencia sensible, no como mutación", async () => {
    let observation: Record<string, unknown> | undefined;
    await observeHumanMessage({ text: "Aceptamos la propuesta, adelante", conversationId: "c1", messageId: "wamid-3", direction: "inbound" }, {
      repository: repository({ apply: async input => { observation = input.observation; return "applied"; } }),
      callObserver: async () => response({ sensitive_suggestion: "accept_proposal", suggestion_reason: "Aceptación explícita observada" }),
    });
    assert.equal(observation?.sensitive_suggestion, "accept_proposal");
    assert.equal("stage" in (observation ?? {}), false);
    assert.equal("lifecycle" in (observation ?? {}), false);
  });

  test("también observa outbound humano relevante", async () => {
    let direction = "";
    await observeHumanMessage({ text: "Agendamos la reunión para el martes", conversationId: "c1", messageId: "admin:req-1", direction: "outbound" }, {
      repository: repository({ apply: async input => { direction = input.direction; return "applied"; } }),
      callObserver: async () => response({ resumen: "Reunión acordada para el martes" }),
    });
    assert.equal(direction, "outbound");
  });
});
