/**
 * Test del fallback real: Groq → Claude
 *
 * Simula un error en Groq (modelo inválido)
 * y valida que Claude responda automáticamente.
 *
 * Endpoint: POST /api/test-fallback
 */

import { isAdminRequest } from "@/lib/admin/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm/provider";

export async function POST(req: NextRequest) {
  // Ruta de diagnóstico: solo con sesión de admin. Sin ella responde 404 para no
  // revelar que existe (antes era pública y permitía usar la IA o tocar datos reales).
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    // Test 1: Groq con modelo inválido (fuerza error)
    const startGroq = Date.now();
    const responseGroq = await callLLM({
      model: "invalid-model-xyz", // Modelo que no existe en Groq
      max_tokens: 200,
      system: [
        {
          type: "text",
          text: "Eres un asistente. Responde brevemente.",
        },
      ],
      messages: [
        {
          role: "user",
          content: "¿Quién eres?",
        },
      ],
    });
    const latencyGroq = Date.now() - startGroq;

    // Si llegamos aquí, Groq falló y fallback a Claude funcionó
    const textBlock = responseGroq.content.find((b) => b.type === "text");

    return NextResponse.json({
      status: "success",
      fallback_test: {
        attempt: "Groq con modelo inválido",
        final_provider: responseGroq.usedProvider,
        latency_ms: latencyGroq,
        response_ok: !!textBlock,
        response_preview: textBlock ? (textBlock as any).text.slice(0, 80) : null,
        fallback_occurred: responseGroq.usedProvider === "claude",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
