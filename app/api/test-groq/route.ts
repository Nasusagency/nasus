/**
 * Smoke test para validar integración de Groq.
 * Endpoint: POST /api/test-groq
 *
 * Forma simplificada - sin handlers aún.
 */

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm/provider";
import { ALL_TOOLS } from "@/lib/llm/tools";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { test?: string; message?: string };
    const { test = "basic", message = "Hola" } = body;

    const start = Date.now();

    if (test === "basic") {
      // Test simple sin tools
      const response = await callLLM({
        model: "openai/gpt-oss-120b",
        max_tokens: 200,
        system: [
          {
            type: "text",
            text: "Eres un asistente simple. Responde en máximo 2 oraciones.",
          },
        ],
        messages: [{ role: "user", content: message }],
      });

      const latency = Date.now() - start;
      const textBlock = response.content.find((b) => b.type === "text");

      return NextResponse.json({
        test: "basic",
        provider: response.usedProvider,
        latency_ms: latency,
        response_ok: !!textBlock,
        response_text: textBlock ? (textBlock as any).text.slice(0, 100) : null,
      });
    }

    if (test === "tool_use") {
      // Test con tool use forzado
      const response = await callLLM({
        model: "openai/gpt-oss-120b",
        max_tokens: 500,
        system: [
          {
            type: "text",
            text: "Evalúa si es una solicitud formal (cambio, problema, ajuste).",
          },
        ],
        messages: [{ role: "user", content: message }],
        tools: [
          {
            name: "evaluar",
            description: "Evalúa el mensaje",
            input_schema: {
              type: "object" as const,
              properties: {
                es_solicitud: {
                  type: "boolean",
                  description: "true si es solicitud",
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
        tool_choice: { type: "tool", name: "evaluar" },
      });

      const latency = Date.now() - start;
      const toolBlock = response.content.find((b) => b.type === "tool_use");

      return NextResponse.json({
        test: "tool_use",
        provider: response.usedProvider,
        latency_ms: latency,
        tools_detected: toolBlock ? 1 : 0,
        tool_name: toolBlock ? (toolBlock as any).name : null,
        tool_input: toolBlock ? (toolBlock as any).input : null,
      });
    }

    if (test === "full_agent") {
      // Test completo con ALL_TOOLS
      const response = await callLLM({
        model: "openai/gpt-oss-120b",
        max_tokens: 800,
        system: [
          {
            type: "text",
            text: "Eres un asistente de Nasus. Usa las herramientas cuando sea apropiado.",
          },
        ],
        messages: [
          {
            role: "user",
            content:
              message ||
              "Hola, queremos una página web. Cuáles son los primeros pasos?",
          },
        ],
        tools: ALL_TOOLS,
        tool_choice: { type: "auto" },
      });

      const latency = Date.now() - start;
      const toolBlocks = response.content.filter((b) => b.type === "tool_use");
      const textBlock = response.content.find((b) => b.type === "text");

      return NextResponse.json({
        test: "full_agent",
        provider: response.usedProvider,
        latency_ms: latency,
        tools_detected: toolBlocks.length,
        tool_calls: toolBlocks.map((b: any) => ({
          name: b.name,
          input_keys: Object.keys(b.input),
        })),
        response_text: textBlock ? (textBlock as any).text.slice(0, 100) : null,
      });
    }

    return NextResponse.json(
      { error: "test inválido (basic|tool_use|full_agent)" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[test-groq] error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
