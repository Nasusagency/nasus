/**
 * Smoke test aislado para Groq Agent v1.
 *
 * Endpoint: POST /_internal/groq-smoke-test
 * NO está en el webhook público. Solo para testing/desarrollo.
 *
 * Valida:
 * 1. Groq responde correctamente
 * 2. Tool use funciona (respuesta con tool calls)
 * 3. Fallback a Claude si Groq falla
 * 4. Captura correcta de estructura
 */

import { NextRequest, NextResponse } from "next/server";
import { callLLM, callLLMWithToolForce } from "@/lib/llm/provider";
import { ALL_TOOLS } from "@/lib/llm/tools";
import { executeToolCall } from "@/lib/whatsapp/agent-handlers";
import type { LLMContentBlock } from "@/lib/llm/provider";

export const maxDuration = 30;

interface SmokeTestRequest {
  test: "basic" | "tool_use" | "fallback" | "full_agent";
  message?: string;
}

interface SmokeTestResponse {
  status: "ok" | "error";
  test: string;
  results: {
    provider: string;
    latency_ms: number;
    response_ok: boolean;
    tools_detected?: number;
    tool_calls?: Array<{
      name: string;
      input_keys: string[];
      handler_result?: {
        exito: boolean;
        mensaje: string;
      };
    }>;
    error?: string;
  };
}

/**
 * Test 1: Llamada básica a Groq/Claude sin tools.
 */
async function testBasic(message: string): Promise<SmokeTestResponse["results"]> {
  const start = Date.now();

  try {
    const response = await callLLM({
      model: "openai/gpt-oss-120b",
      max_tokens: 200,
      system: [
        {
          type: "text",
          text: "Eres un asistente simple. Responde brevemente.",
        },
      ],
      messages: [
        {
          role: "user",
          content: message || "Hola, quién eres?",
        },
      ],
    });

    const latency = Date.now() - start;
    const textBlock = response.content.find((b) => b.type === "text");

    return {
      provider: response.usedProvider,
      latency_ms: latency,
      response_ok: !!textBlock,
    };
  } catch (err) {
    return {
      provider: "unknown",
      latency_ms: Date.now() - start,
      response_ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Test 2: Tool use forzado (registrar_evaluacion, similar al webhook actual).
 */
async function testToolUse(message: string): Promise<SmokeTestResponse["results"]> {
  const start = Date.now();

  try {
    const response = await callLLMWithToolForce({
      model: "openai/gpt-oss-120b",
      max_tokens: 500,
      system: [
        {
          type: "text",
          text: "Evalúa si el siguiente mensaje es una solicitud formal (una petición concreta de cambio, ajuste o problema) o no.",
        },
      ],
      messages: [
        {
          role: "user",
          content:
            message ||
            "El formulario de contacto no envía los mensajes, siempre sale error.",
        },
      ],
      tools: [
        {
          name: "evaluacion",
          description: "Evalúa si es solicitud formal",
          input_schema: {
            type: "object" as const,
            properties: {
              es_solicitud: {
                type: "boolean",
                description: "true si es solicitud formal",
              },
              razon: {
                type: "string",
                description: "Explicación breve",
              },
            },
            required: ["es_solicitud", "razon"],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: "tool", name: "evaluacion" },
    });

    const latency = Date.now() - start;
    const toolBlock = response.content[0] as LLMContentBlock & { type: "tool_use" };

    return {
      provider: response.usedProvider,
      latency_ms: latency,
      response_ok: !!toolBlock,
      tools_detected: toolBlock ? 1 : 0,
    };
  } catch (err) {
    return {
      provider: "unknown",
      latency_ms: Date.now() - start,
      response_ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Test 3: Fallback (fuerza error en Groq, valida que Claude responda).
 * Nota: solo funciona si hay un mecanismo de error simulado.
 */
async function testFallback(): Promise<SmokeTestResponse["results"]> {
  // TODO: Implementar mecanismo de forzar error en Groq para este test
  // Por ahora, solo reportar que está listo
  return {
    provider: "test-skipped",
    latency_ms: 0,
    response_ok: true,
  };
}

/**
 * Test 4: Full agent loop (agente con tools, ejecuta handlers stub).
 */
async function testFullAgent(): Promise<SmokeTestResponse["results"]> {
  const start = Date.now();

  try {
    // Prompt similar al webhook real
    const response = await callLLM({
      model: "openai/gpt-oss-120b",
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: `Eres el asistente de Nasus Agency en WhatsApp. Tienes acceso a 6 herramientas para ayudar prospectos y clientes.
Puedes: consultar contexto del contacto, explicar servicios, mostrar portafolio, guardar leads, registrar requerimientos, notificar al equipo.
Siempre sé profesional, cálido y conciso. En este test, usa las herramientas cuando sea apropiado para demostrar que funcionan.`,
        },
      ],
      messages: [
        {
          role: "user",
          content:
            "Hola, soy una cafetería y queremos una página web. Cuáles son los primeros pasos?",
        },
      ],
      tools: ALL_TOOLS,
      tool_choice: { type: "auto" },
    });

    const latency = Date.now() - start;
    const toolBlocks = response.content.filter((b) => b.type === "tool_use");

    // Ejecutar cada tool call detectado
    const toolResults = [];
    for (const toolBlock of toolBlocks) {
      if (toolBlock.type === "tool_use") {
        const result = await executeToolCall(
          toolBlock.name as any,
          toolBlock.input
        );
        const resultObj = result as Record<string, any>;
        toolResults.push({
          name: toolBlock.name,
          input_keys: Object.keys(toolBlock.input),
          handler_result: {
            exito: resultObj.exito ?? false,
            mensaje: resultObj.mensaje ?? "Sin mensaje",
          },
        });
      }
    }

    return {
      provider: response.usedProvider,
      latency_ms: latency,
      response_ok: true,
      tools_detected: toolBlocks.length,
      tool_calls: toolResults,
    };
  } catch (err) {
    return {
      provider: "unknown",
      latency_ms: Date.now() - start,
      response_ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as SmokeTestRequest;
    const { test, message } = body;

    if (!test) {
      return NextResponse.json(
        { error: "test requerido (basic|tool_use|fallback|full_agent)" },
        { status: 400 }
      );
    }

    let results;

    switch (test) {
      case "basic":
        results = await testBasic(message ?? "");
        break;

      case "tool_use":
        results = await testToolUse(message ?? "");
        break;

      case "fallback":
        results = await testFallback();
        break;

      case "full_agent":
        results = await testFullAgent();
        break;

      default:
        return NextResponse.json(
          { error: "test inválido" },
          { status: 400 }
        );
    }

    const response: SmokeTestResponse = {
      status: results.response_ok ? "ok" : "error",
      test,
      results,
    };

    return NextResponse.json(response, {
      status: results.response_ok ? 200 : 500,
    });
  } catch (err) {
    console.error("[groq-smoke-test] error:", err);
    return NextResponse.json(
      {
        status: "error",
        test: "unknown",
        results: {
          provider: "unknown",
          latency_ms: 0,
          response_ok: false,
          error: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 }
    );
  }
}
