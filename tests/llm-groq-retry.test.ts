import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  runProviderFallback,
  createGroqCallBudget,
  providerTelemetryLabel,
  GroqHttpError,
  type LLMResponse,
  type LLMCreateParams,
} from "@/lib/llm/provider";
import { callGroqAgent, type GroqAgentDependencies } from "@/app/api/whatsapp/webhook/route";
import type { ToolResult } from "@/lib/llm/tool-results";
import type { StoredMessage } from "@/lib/whatsapp/types";

function response(content: LLMResponse["content"], usedProvider: LLMResponse["usedProvider"]): LLMResponse {
  return { content, usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: "end_turn", usedProvider };
}

function message(contenido: string): StoredMessage {
  return { direccion: "entrante", contenido, media_id: null, created_at: new Date().toISOString() };
}

const baseParams: LLMCreateParams = {
  model: "openai/gpt-oss-120b",
  max_tokens: 200,
  messages: [{ role: "user", content: "hola" }],
};

const noSleep = async () => {};

describe("retry de Groq por rate limit antes de fallback a Claude", () => {
  test("1. Groq #1 → 429 corto con Retry-After → Groq #2 exitoso", async () => {
    let calls = 0;
    const sleeps: number[] = [];
    const result = await runProviderFallback(
      baseParams,
      {
        groq: async () => {
          calls++;
          if (calls === 1) throw new GroqHttpError(429, "rate limited", { retryAfterMs: 50 });
          return response([{ type: "text", text: "ok" }], "groq");
        },
        claude: async () => {
          throw new Error("no debería llamarse a Claude");
        },
      },
      true,
      createGroqCallBudget(),
      async (ms) => {
        sleeps.push(ms);
      },
    );

    assert.equal(calls, 2);
    assert.equal(result.usedProvider, "groq");
    assert.deepEqual(sleeps, [50]);
  });

  test("2. Groq #1 → 429 → Groq #2 → 429 → Claude", async () => {
    let groqCalls = 0;
    let claudeCalls = 0;
    const result = await runProviderFallback(
      baseParams,
      {
        groq: async () => {
          groqCalls++;
          throw new GroqHttpError(429, "rate limited", { retryAfterMs: 20 });
        },
        claude: async () => {
          claudeCalls++;
          return response([{ type: "text", text: "claude ok" }], "claude");
        },
      },
      true,
      createGroqCallBudget(),
      noSleep,
    );

    assert.equal(groqCalls, 2);
    assert.equal(claudeCalls, 1);
    assert.equal(result.usedProvider, "claude");
  });

  test("3. Groq #1 → 400 invalid_tool_arguments_json → Claude sin retry", async () => {
    let groqCalls = 0;
    const result = await runProviderFallback(
      baseParams,
      {
        groq: async () => {
          groqCalls++;
          throw new GroqHttpError(400, "groq_request_failed:400:invalid_tool_arguments_json");
        },
        claude: async () => response([{ type: "text", text: "claude ok" }], "claude"),
      },
      true,
      createGroqCallBudget(),
      async () => {
        throw new Error("no debería dormir para un 400 no recuperable");
      },
    );

    assert.equal(groqCalls, 1);
    assert.equal(result.usedProvider, "claude");
  });

  test("4. Groq #1 → 401/403 → Claude sin retry", async () => {
    for (const status of [401, 403] as const) {
      let groqCalls = 0;
      const result = await runProviderFallback(
        baseParams,
        {
          groq: async () => {
            groqCalls++;
            throw new GroqHttpError(status, `groq_auth_error:${status}`);
          },
          claude: async () => response([{ type: "text", text: "claude ok" }], "claude"),
        },
        true,
        createGroqCallBudget(),
        async () => {
          throw new Error("no debería dormir para un error de auth");
        },
      );

      assert.equal(groqCalls, 1, `status ${status}`);
      assert.equal(result.usedProvider, "claude", `status ${status}`);
    }
  });

  test("5. Groq #1 → 5xx → retry corto → éxito", async () => {
    let calls = 0;
    const sleeps: number[] = [];
    const result = await runProviderFallback(
      baseParams,
      {
        groq: async () => {
          calls++;
          if (calls === 1) throw new GroqHttpError(503, "groq_request_failed:503");
          return response([{ type: "text", text: "ok" }], "groq");
        },
        claude: async () => {
          throw new Error("no debería llamarse a Claude");
        },
      },
      true,
      createGroqCallBudget(),
      async (ms) => {
        sleeps.push(ms);
      },
    );

    assert.equal(calls, 2);
    assert.equal(result.usedProvider, "groq");
    assert.equal(sleeps.length, 1);
    assert.ok(sleeps[0] >= 400 && sleeps[0] <= 700, `wait fuera de rango: ${sleeps[0]}`);
  });

  test("6. Groq #1 → 5xx → retry → falla → Claude", async () => {
    let groqCalls = 0;
    const result = await runProviderFallback(
      baseParams,
      {
        groq: async () => {
          groqCalls++;
          throw new GroqHttpError(500, "groq_request_failed:500");
        },
        claude: async () => response([{ type: "text", text: "claude ok" }], "claude"),
      },
      true,
      createGroqCallBudget(),
      noSleep,
    );

    assert.equal(groqCalls, 2);
    assert.equal(result.usedProvider, "claude");
  });

  test("7. Retry-After mayor al presupuesto de ejecución → Claude directo sin segundo intento", async () => {
    let groqCalls = 0;
    const budget = createGroqCallBudget(50); // 50ms de presupuesto total para todo el mensaje
    const result = await runProviderFallback(
      baseParams,
      {
        groq: async () => {
          groqCalls++;
          throw new GroqHttpError(429, "rate limited", { retryAfterMs: 5_000 });
        },
        claude: async () => response([{ type: "text", text: "claude ok" }], "claude"),
      },
      true,
      budget,
      async () => {
        throw new Error("no debería dormir: la espera excede el presupuesto");
      },
    );

    assert.equal(groqCalls, 1);
    assert.equal(result.usedProvider, "claude");
  });

  test("8. un mismo GroqCallBudget nunca permite más de 2 llamadas a Groq entre varias rondas", async () => {
    let groqCalls = 0;
    const budget = createGroqCallBudget();
    const attempt = () =>
      runProviderFallback(
        baseParams,
        {
          groq: async () => {
            groqCalls++;
            throw new GroqHttpError(500, "groq_request_failed:500");
          },
          claude: async () => response([{ type: "text", text: "claude ok" }], "claude"),
        },
        true,
        budget,
        noSleep,
      );

    const r1 = await attempt(); // "ronda 1": consume los 2 intentos permitidos
    const r2 = await attempt(); // "ronda 2": budget ya agotado, debe ir directo a Claude

    assert.equal(groqCalls, 2, "nunca deben ejecutarse más de 2 llamadas reales a Groq");
    assert.equal(r1.usedProvider, "claude");
    assert.equal(r2.usedProvider, "claude");
  });

  test("9. telemetría del provider final distingue groq de claude_fallback", async () => {
    const exitoso = await runProviderFallback(
      baseParams,
      { groq: async () => response([{ type: "text", text: "ok" }], "groq"), claude: async () => { throw new Error("no debería llamarse"); } },
      true,
      createGroqCallBudget(),
      noSleep,
    );
    assert.equal(providerTelemetryLabel("groq", exitoso.usedProvider), "groq");

    const conFallback = await runProviderFallback(
      baseParams,
      {
        groq: async () => {
          throw new GroqHttpError(500, "groq_request_failed:500");
        },
        claude: async () => response([{ type: "text", text: "claude ok" }], "claude"),
      },
      true,
      createGroqCallBudget(),
      noSleep,
    );
    assert.equal(providerTelemetryLabel("groq", conFallback.usedProvider), "claude_fallback");
  });

  test("10. el binder de identidad canónica sigue aplicándose aunque Groq reintente antes de responder", async () => {
    const numero = "523331234567";
    const persistedInputs: Record<string, unknown>[] = [];
    let groqCalls = 0;

    const dependencies: GroqAgentDependencies = {
      callLLM: (params, budget) =>
        runProviderFallback(
          params,
          {
            groq: async () => {
              groqCalls++;
              if (groqCalls === 1) throw new GroqHttpError(429, "rate limited", { retryAfterMs: 10 });
              return response(
                [
                  { type: "tool_use", id: "lead", name: "guardar_actualizar_lead", input: { numero: "otro numero inventado", stage: "exploring" } },
                  { type: "text", text: "Gracias." },
                ],
                "groq",
              );
            },
            claude: async () => {
              throw new Error("no debería llamarse a Claude: el segundo intento de Groq debe tener éxito");
            },
          },
          true,
          budget ?? createGroqCallBudget(),
          noSleep,
        ),
      executeToolCall: async (name, input): Promise<ToolResult> => {
        if (name === "consultar_contexto_contacto") return { encontrado: false, es_cliente: false, es_lead: false };
        if (name === "guardar_actualizar_lead") {
          persistedInputs.push(input);
          return { exito: true, lead_id: "lead-1", operacion: "creado", mensaje: "ok" };
        }
        throw new Error(`tool inesperada: ${name}`);
      },
    };

    await callGroqAgent("Hola", [message("Hola")], numero, undefined, dependencies);

    assert.equal(groqCalls, 2);
    assert.equal(persistedInputs.length, 1);
    assert.equal(persistedInputs[0].numero, numero);
    assert.notEqual(persistedInputs[0].numero, "otro numero inventado");
  });
});
