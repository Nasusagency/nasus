import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ALL_TOOLS } from "../lib/llm/tools";
import { providerTelemetryLabel } from "../lib/llm/provider";
import { bindCanonicalToolInput } from "../lib/whatsapp/tool-context";
import { callGroqAgent, type GroqAgentDependencies } from "../app/api/whatsapp/webhook/route";
import type { LLMResponse } from "../lib/llm/provider";
import type { ToolResult } from "../lib/llm/tool-results";
import type { StoredMessage } from "../lib/whatsapp/types";

const context = { numero: "523331234567", conversationId: "conversation-trusted" };

describe("binding canónico de tools WhatsApp", () => {
  test("los schemas visibles al LLM no exponen identificadores canónicos", () => {
    assert.equal(ALL_TOOLS.some(tool => tool.name === "consultar_contexto_contacto"), false);
    for (const tool of ALL_TOOLS) {
      const properties = tool.input_schema.properties;
      assert.equal("numero" in properties, false, tool.name);
      assert.equal("numero_contacto" in properties, false, tool.name);
      assert.equal("conversation_id" in properties, false, tool.name);
      assert.equal("contact_id" in properties, false, tool.name);
      assert.equal("cliente_slug" in properties, false, tool.name);
    }
  });

  test("lead y consulta reciben siempre el número de Meta", () => {
    assert.equal(bindCanonicalToolInput("guardar_actualizar_lead", { numero: "El cliente", stage: "exploring" }, context).numero, context.numero);
    assert.equal(bindCanonicalToolInput("consultar_contexto_contacto", { numero: "521111111111" }, context).numero, context.numero);
  });

  test("requerimiento recibe número y conversación confiables", () => {
    const input = bindCanonicalToolInput("registrar_requerimiento", { numero_contacto: "otro", conversation_id: "inventada", contact_id: "inventado", tipo: "consulta" }, context);
    assert.equal(input.numero_contacto, context.numero);
    assert.equal(input.conversation_id, context.conversationId);
    assert.equal(input.contact_id, undefined);
    assert.equal(input.cliente_slug, undefined);
  });

  test("notificación usa el número canónico sin conservar otros IDs", () => {
    const input = bindCanonicalToolInput("notificar_humano", { numero_contacto: "otro", contact_id: "inventado", asunto: "Aviso", cuerpo: "Texto" }, context);
    assert.equal(input.numero_contacto, context.numero);
    assert.equal(input.contact_id, undefined);
  });

  test("las tools de pago reciben siempre el número de Meta, nunca uno inventado por el LLM", () => {
    for (const toolName of ["consultar_estado_pago", "consultar_pagos_pendientes", "recuperar_link_pago_existente"] as const) {
      const input = bindCanonicalToolInput(toolName, { numero: "521111111111", payment_id: "legit-payment-id" }, context);
      assert.equal(input.numero, context.numero, toolName);
      assert.equal(input.payment_id, "legit-payment-id", toolName);
    }
  });

  test("telemetría distingue Claude fallback de Groq exitoso", () => {
    assert.equal(providerTelemetryLabel("groq", "groq"), "groq");
    assert.equal(providerTelemetryLabel("groq", "claude"), "claude_fallback");
    assert.equal(providerTelemetryLabel("claude", "claude"), "claude");
  });

  test("el número completo del contacto nunca aparece en los logs del agente", async () => {
    const numero = "523331234567";
    const dependencies: GroqAgentDependencies = {
      callLLM: async (): Promise<LLMResponse> => ({
        content: [
          { type: "tool_use", id: "lead", name: "guardar_actualizar_lead", input: { numero: "El cliente", stage: "exploring", resumen: numero } },
          { type: "text", text: "Gracias." },
        ],
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: "end_turn",
        usedProvider: "groq",
      }),
      executeToolCall: async (name): Promise<ToolResult> => {
        if (name === "consultar_contexto_contacto") return { encontrado: false, es_cliente: false, es_lead: false };
        if (name === "guardar_actualizar_lead") return { exito: true, lead_id: "lead-1", operacion: "creado", mensaje: "ok" };
        throw new Error(`tool inesperada: ${name}`);
      },
    };

    const message = (contenido: string): StoredMessage => ({
      direccion: "entrante",
      contenido,
      media_id: null,
      created_at: new Date().toISOString(),
    });

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const emitted: string[] = [];
    const capture = (...args: unknown[]) => { emitted.push(args.map(String).join(" ")); };
    console.log = capture;
    console.warn = capture;
    console.error = capture;
    try {
      await callGroqAgent("Hola", [message("Hola")], numero, "Usuario", dependencies);
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }

    for (const line of emitted) {
      assert.equal(line.includes(numero), false, `log filtró el número completo: ${line}`);
    }
  });
});
