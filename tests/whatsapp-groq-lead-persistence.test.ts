import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { callGroqAgent, type GroqAgentDependencies } from "@/app/api/whatsapp/webhook/route";
import { runProviderFallback, type LLMResponse } from "@/lib/llm/provider";
import type { ToolName } from "@/lib/llm/tools";
import type { ToolResult } from "@/lib/llm/tool-results";
import type { StoredMessage } from "@/lib/whatsapp/types";

const numero = "523331234567";

function response(
  content: LLMResponse["content"],
  usedProvider: LLMResponse["usedProvider"] = "groq",
): LLMResponse {
  return {
    content,
    usage: { input_tokens: 1, output_tokens: 1 },
    stop_reason: "end_turn",
    usedProvider,
  };
}

function message(contenido: string): StoredMessage {
  return {
    direccion: "entrante",
    contenido,
    media_id: null,
    created_at: new Date().toISOString(),
  };
}

describe("persistencia del lead en el flujo Groq", () => {
  test("la conversación equivalente guarda mensajes y hace upsert de un solo lead", async () => {
    const incoming = [
      "Hola, quiero conocer el asistente de Nasus",
      "En mi empresa, los leads tienen que registrarse…",
      "Ok, muchas gracias",
    ];
    const stages = ["exploring", "opportunity", "opportunity"] as const;
    const savedMessages: StoredMessage[] = [];
    const leads = new Map<string, Record<string, unknown>>();
    const notifications: string[] = [];
    let turn = 0;

    const dependencies: GroqAgentDependencies = {
      callLLM: async () => {
        const stage = stages[turn++];
        return response([
          {
            type: "tool_use",
            id: `lead-${turn}`,
            name: "guardar_actualizar_lead",
            input: {
              numero,
              stage,
              problema_descrito: incoming[Math.min(turn - 1, incoming.length - 1)],
            },
          },
          { type: "text", text: "Gracias, entendido." },
        ]);
      },
      executeToolCall: async (name: ToolName, input): Promise<ToolResult> => {
        if (name === "consultar_contexto_contacto") {
          const lead = leads.get(numero);
          return {
            encontrado: Boolean(lead),
            es_cliente: false,
            es_lead: Boolean(lead),
            lead: lead
              ? {
                  numero,
                  stage: lead.stage as typeof stages[number],
                  requiere_humano: false,
                }
              : undefined,
          };
        }
        if (name === "guardar_actualizar_lead") {
          const existed = leads.has(String(input.numero));
          leads.set(String(input.numero), { ...leads.get(String(input.numero)), ...input });
          return {
            exito: true,
            lead_id: "lead-1",
            operacion: existed ? "actualizado" : "creado",
            mensaje: "ok",
          };
        }
        if (name === "notificar_humano") {
          notifications.push(String(input.asunto));
          return { exito: true, mensaje: "ok", email_enviado: true };
        }
        throw new Error(`tool inesperada: ${name}`);
      },
    };

    for (const text of incoming) {
      savedMessages.push(message(text));
      await callGroqAgent(text, [...savedMessages], numero, "Usuario externo", dependencies);
      savedMessages.push({ ...message("Gracias, entendido."), direccion: "saliente" });
    }

    assert.equal(savedMessages.length, 6, "se guardan tres entradas y tres salidas");
    assert.equal(leads.size, 1, "el upsert por número no duplica el lead");
    assert.equal(leads.get(numero)?.stage, "opportunity");
    assert.equal(notifications.length, 0, "un agradecimiento no corresponde a high_intent");
  });

  test("reintenta persistencia antes del email si el primer guardado falla", async () => {
    const events: string[] = [];
    let saveAttempts = 0;
    const dependencies: GroqAgentDependencies = {
      callLLM: async () => response([
        {
          type: "tool_use",
          id: "notify-first",
          name: "notificar_humano",
          input: { asunto: "Prospecto", cuerpo: "Solicita seguimiento", numero_contacto: numero },
        },
        {
          type: "tool_use",
          id: "lead-second",
          name: "guardar_actualizar_lead",
          input: { numero, stage: "qualified", requiere_humano: true },
        },
        { type: "text", text: "El equipo te contactará." },
      ]),
      executeToolCall: async (name): Promise<ToolResult> => {
        if (name === "consultar_contexto_contacto") {
          return { encontrado: false, es_cliente: false, es_lead: false };
        }
        if (name === "guardar_actualizar_lead") {
          saveAttempts++;
          events.push(`save:${saveAttempts}`);
          return {
            exito: saveAttempts > 1,
            lead_id: saveAttempts > 1 ? "lead-1" : "",
            operacion: "creado",
            mensaje: saveAttempts > 1 ? "ok" : "falló",
          };
        }
        if (name === "notificar_humano") {
          events.push("email");
          return { exito: true, mensaje: "ok", email_enviado: true };
        }
        throw new Error(`tool inesperada: ${name}`);
      },
    };

    await callGroqAgent("Quiero hablar con un asesor", [message("Quiero hablar con un asesor")], numero, undefined, dependencies);

    assert.deepEqual(events, ["save:1", "save:2", "email"]);
  });

  test("bloquea el email si la persistencia falla definitivamente", async () => {
    let emailCalls = 0;
    const dependencies: GroqAgentDependencies = {
      callLLM: async () => response([
        {
          type: "tool_use",
          id: "lead",
          name: "guardar_actualizar_lead",
          input: { numero, stage: "qualified", requiere_humano: true },
        },
        {
          type: "tool_use",
          id: "notify",
          name: "notificar_humano",
          input: { asunto: "Prospecto", cuerpo: "Seguimiento", numero_contacto: numero },
        },
        { type: "text", text: "Gracias." },
      ]),
      executeToolCall: async (name): Promise<ToolResult> => {
        if (name === "consultar_contexto_contacto") {
          return { encontrado: false, es_cliente: false, es_lead: false };
        }
        if (name === "guardar_actualizar_lead") {
          return { exito: false, lead_id: "", operacion: "creado", mensaje: "db unavailable" };
        }
        if (name === "notificar_humano") {
          emailCalls++;
          return { exito: true, mensaje: "ok", email_enviado: true };
        }
        throw new Error(`tool inesperada: ${name}`);
      },
    };

    await callGroqAgent("Quiero cotizar", [message("Quiero cotizar")], numero, undefined, dependencies);

    assert.equal(emailCalls, 0);
  });

  test("JSON inválido en Groq cae a Claude y reemplaza numero generado por el canónico", async () => {
    const persistedInputs: Record<string, unknown>[] = [];
    const finalProviders: string[] = [];
    const dependencies: GroqAgentDependencies = {
      callLLM: params => runProviderFallback(params, {
        groq: async () => { throw new Error("groq_request_failed:400:invalid_tool_arguments_json"); },
        claude: async () => response([
          { type: "tool_use", id: "claude-lead", name: "guardar_actualizar_lead", input: { numero: "El cliente", stage: "opportunity", resumen: "Necesita registrar leads" } },
          { type: "text", text: "Entendido." },
        ], "claude"),
      }),
      executeToolCall: async (name, input): Promise<ToolResult> => {
        if (name === "consultar_contexto_contacto") return { encontrado: false, es_cliente: false, es_lead: false };
        if (name === "guardar_actualizar_lead") {
          persistedInputs.push(input);
          return { exito: true, lead_id: "lead-1", operacion: "creado", mensaje: "ok" };
        }
        throw new Error(`tool inesperada: ${name}`);
      },
      onProviderUsed: provider => finalProviders.push(provider),
    };

    await callGroqAgent("Los leads deben registrarse", [message("Los leads deben registrarse")], numero, "El cliente", dependencies);

    assert.equal(persistedInputs.length, 1);
    assert.equal(persistedInputs[0].numero, numero);
    assert.notEqual(persistedInputs[0].numero, "El cliente");
    assert.deepEqual(finalProviders, ["claude"]);
  });

  test("un teléfono distinto producido por Groq nunca reemplaza al número de Meta", async () => {
    let persistedNumber = "";
    const dependencies: GroqAgentDependencies = {
      callLLM: async () => response([
        { type: "tool_use", id: "malicious-number", name: "guardar_actualizar_lead", input: { numero: "521111111111", stage: "exploring" } },
        { type: "text", text: "Hola." },
      ]),
      executeToolCall: async (name, input): Promise<ToolResult> => {
        if (name === "consultar_contexto_contacto") return { encontrado: false, es_cliente: false, es_lead: false };
        if (name === "guardar_actualizar_lead") {
          persistedNumber = String(input.numero);
          return { exito: true, lead_id: "lead-1", operacion: "creado", mensaje: "ok" };
        }
        throw new Error(`tool inesperada: ${name}`);
      },
    };

    await callGroqAgent("Hola", [message("Hola")], numero, undefined, dependencies);
    assert.equal(persistedNumber, numero);
  });

  test("fallback_persist_lead usa el número canónico cuando el modelo nunca invoca la tool", async () => {
    let persistedNumber = "";
    let saveCalls = 0;
    const dependencies: GroqAgentDependencies = {
      callLLM: async () => response([
        { type: "text", text: "Hola, cuéntame sobre tu negocio." },
      ]),
      executeToolCall: async (name, input): Promise<ToolResult> => {
        if (name === "consultar_contexto_contacto") return { encontrado: false, es_cliente: false, es_lead: false };
        if (name === "guardar_actualizar_lead") {
          saveCalls++;
          persistedNumber = String(input.numero);
          return { exito: true, lead_id: "lead-1", operacion: "creado", mensaje: "ok" };
        }
        throw new Error(`tool inesperada: ${name}`);
      },
    };

    await callGroqAgent("Hola", [message("Hola")], numero, undefined, dependencies);

    assert.equal(saveCalls, 1);
    assert.equal(persistedNumber, numero);
  });
});
