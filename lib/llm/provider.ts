/**
 * Abstracción de proveedor LLM.
 *
 * Permite intercambiar entre Groq (principal) y Claude (fallback).
 * Ambos con interfaz idéntica para que el código de llamada no dependa
 * de quién respondió.
 *
 * Estrategia:
 * 1. Intentar Groq
 * 2. Si falla (timeout, error técnico), usar Claude
 * 3. Registrar cuál respondió para auditoría
 */

import Anthropic from "@anthropic-ai/sdk";

export type ProviderType = "groq" | "claude";

export function providerTelemetryLabel(selected: ProviderType, used: ProviderType): "groq" | "claude" | "claude_fallback" {
  return selected === "groq" && used === "claude" ? "claude_fallback" : used;
}

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: boolean;
  };
}

export interface LLMToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LLMTextBlock {
  type: "text";
  text: string;
}

export type LLMContentBlock = LLMTextBlock | LLMToolUseBlock;

export interface LLMResponse {
  content: LLMContentBlock[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason: string;
  usedProvider: ProviderType;
}

export interface LLMCreateParams {
  model: string;
  max_tokens: number;
  system?: Array<{
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }>;
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  tool_choice?: { type: "tool"; name: string } | { type: "auto" } | { type: "required" };
}

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return (anthropicClient ??= new Anthropic({ apiKey }));
}

/**
 * Groq usa OpenAI-compatible API.
 * Para esta v1, hacemos una llamada HTTP simple en lugar de usar SDK.
 */
async function callGroq(params: LLMCreateParams): Promise<LLMResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  // Convertir system prompt a primer mensaje si es necesario
  // Groq soporta system role, así que podemos pasarlo como tal
  const groqMessages: Array<{ role: string; content: string }> = [];

  if (params.system && params.system.length > 0) {
    groqMessages.push({
      role: "system",
      content: params.system.map((s) => s.text).join("\n"),
    });
  }

  groqMessages.push(
    ...params.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))
  );

  // Convertir tools a formato OpenAI-compatible
  const groqTools = params.tools
    ? params.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }))
    : undefined;

  const groqToolChoice = params.tool_choice
    ? params.tool_choice.type === "tool"
      ? { type: "function", function: { name: params.tool_choice.name } }
      : params.tool_choice.type === "required"
        ? "required"
        : "auto"
    : undefined;

  const url = "https://api.groq.com/openai/v1/chat/completions";
  const body = JSON.stringify({
    model: params.model,
    max_tokens: params.max_tokens,
    messages: groqMessages,
    tools: groqTools,
    tool_choice: groqToolChoice,
    temperature: 0,
    reasoning_effort: "low",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text();
    const invalidToolJson = /parse tool call arguments as json|tool call arguments are not valid json/i.test(text);
    throw new Error(invalidToolJson
      ? `groq_request_failed:${res.status}:invalid_tool_arguments_json`
      : `groq_request_failed:${res.status}`);
  }

  const data = (await res.json()) as {
    choices: Array<{
      message: {
        content?: string;
        tool_calls?: Array<{
          id: string;
          function: { name: string; arguments: string };
        }>;
      };
    }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  const choice = data.choices?.[0];
  if (!choice) throw new Error("groq_no_choices");

  const content: LLMContentBlock[] = [];

  if (choice.message.content) {
    content.push({
      type: "text",
      text: choice.message.content,
    });
  }

  if (choice.message.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      let input: Record<string, unknown>;
      try {
        input = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        throw new Error("groq_invalid_tool_arguments_json");
      }
      content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
    }
  }

  return {
    content,
    usage: {
      input_tokens: data.usage.prompt_tokens,
      output_tokens: data.usage.completion_tokens,
    },
    stop_reason: "end_turn" as const,
    usedProvider: "groq" as const,
  };
}

/**
 * Llamada a Claude (Anthropic).
 * Mantiene la integración existente, usado como fallback.
 *
 * Si el modelo no es válido para Claude, usa Haiku por defecto.
 */
async function callClaude(params: LLMCreateParams): Promise<LLMResponse> {
  const client = getAnthropicClient();

  // Normalizar modelo si es inválido
  const validClaudeModel = params.model.startsWith("claude-")
    ? params.model
    : "claude-haiku-4-5-20251001";

  // Convertir params a formato Anthropic
  const anthropicTools = params.tools
    ? params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }))
    : undefined;

  const anthropicToolChoice = params.tool_choice
    ? params.tool_choice.type === "tool"
      ? { type: "tool" as const, name: params.tool_choice.name }
      : undefined
    : undefined;

  const response = await client.messages.create({
    model: validClaudeModel,
    max_tokens: params.max_tokens,
    system: params.system,
    messages: params.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    tools: anthropicTools,
    tool_choice: anthropicToolChoice,
  });

  const content = response.content.map((block) => {
    if (block.type === "text") {
      return {
        type: "text" as const,
        text: block.text,
      };
    } else if (block.type === "tool_use") {
      return {
        type: "tool_use" as const,
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      };
    }
    return null;
  });

  return {
    content: content.filter((c) => c !== null) as LLMContentBlock[],
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
    stop_reason: response.stop_reason ?? "end_turn",
    usedProvider: "claude" as const,
  };
}

/**
 * Llamada a LLM con fallback automático.
 *
 * Intenta Groq primero. Si falla por error técnico (timeout, API error),
 * intenta Claude. Si Claude falla, lanza error.
 *
 * Registra en logs cuál proveedor respondió.
 */
export async function runProviderFallback(
  params: LLMCreateParams,
  providers: {
    groq: (input: LLMCreateParams) => Promise<LLMResponse>;
    claude: (input: LLMCreateParams) => Promise<LLMResponse>;
  },
  preferGroq = true,
): Promise<LLMResponse> {
  if (!preferGroq) return providers.claude(params);
  try {
    return await providers.groq(params);
  } catch (err) {
    const errMsg = (err instanceof Error ? err.message : "groq_unknown_error")
      .replace(/\d{10,15}/g, "[redacted_phone]")
      .slice(0, 160);
    console.warn(`[llm/provider] Groq falló (${errMsg}), intentando Claude fallback`);
    const response = await providers.claude(params);
    console.log("[llm/provider] fallback a Claude exitoso");
    return response;
  }
}

export async function callLLM(params: LLMCreateParams): Promise<LLMResponse> {
  const preferGroq = !!process.env.GROQ_API_KEY;

  if (!preferGroq) {
    // Si no hay GROQ_API_KEY, usar Claude directamente
    const response = await callClaude(params);
    console.log("[llm/provider] usando Claude (Groq no configurado)");
    return response;
  }

  const response = await runProviderFallback(params, { groq: callGroq, claude: callClaude }, true);
  if (response.usedProvider === "groq") {
    console.log("[llm/provider] respuesta exitosa de Groq");
  }
  return response;
}

/**
 * Versión tipada para llamadas con tool_choice forzado.
 * Garantiza que siempre hay tool use en la respuesta.
 */
export async function callLLMWithToolForce(
  params: LLMCreateParams & {
    tool_choice: { type: "tool"; name: string };
  }
): Promise<LLMResponse & { content: [LLMToolUseBlock, ...LLMContentBlock[]] }> {
  const response = await callLLM(params);

  const toolBlock = response.content.find(
    (b) => b.type === "tool_use"
  ) as LLMToolUseBlock | undefined;
  if (!toolBlock) {
    throw new Error(`llm_tool_force_failed:${response.usedProvider}`);
  }

  return {
    ...response,
    content: [
      toolBlock,
      ...response.content.filter((b) => b !== toolBlock),
    ] as [LLMToolUseBlock, ...LLMContentBlock[]],
  };
}
