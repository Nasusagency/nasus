/**
 * Abstracción de proveedor LLM.
 *
 * Permite intercambiar entre Groq (principal) y Claude (fallback).
 * Ambos con interfaz idéntica para que el código de llamada no dependa
 * de quién respondió.
 *
 * Estrategia:
 * 1. Intentar Groq (máximo 2 intentos por mensaje, ver GroqCallBudget)
 * 2. Si falla de forma no recuperable, o el segundo intento también falla,
 *    usar Claude
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

// ─── Rate limit / retry de Groq ─────────────────────────────────────────────
//
// app/api/whatsapp/webhook/route.ts declara `export const maxDuration = 30`
// (30s reales en Vercel). Dentro de ese presupuesto, el webhook todavía tiene
// que hacer: lookup de contexto en Supabase, hasta 3 rondas de agente (cada
// una con su propia llamada a LLM + ejecución de tools), persistencia y el
// envío final por WhatsApp. GROQ_RETRY_SAFE_BUDGET_MS es lo máximo que
// estamos dispuestos a invertir en total (todas las rondas de UN mensaje
// comparten el mismo GroqCallBudget) esperando por rate limits de Groq antes
// de resignarnos a Claude — deja ~24s de margen para todo lo demás.
export const GROQ_MAX_ATTEMPTS_PER_MESSAGE = 2;
export const GROQ_RETRY_SAFE_BUDGET_MS = 6_000;
// Tope duro por espera individual, independiente del budget restante: nunca
// vale la pena dormir más que esto de una sola vez dentro de un webhook de 30s.
const GROQ_MAX_SINGLE_WAIT_MS = 5_000;

/**
 * Presupuesto de reintentos de Groq para UN mensaje completo del webhook.
 * Se crea una sola vez por mensaje (no por ronda del agente) y se comparte
 * entre todas las llamadas a callLLM de ese mensaje, así nunca se disparan
 * más de `maxAttempts` llamadas reales a Groq sin importar cuántas rondas
 * de agente hagan falta.
 */
export interface GroqCallBudget {
  attemptsUsed: number;
  maxAttempts: number;
  /** Date.now() timestamp: no programar una espera que cruce este límite. */
  deadline: number;
}

export function createGroqCallBudget(safeBudgetMs: number = GROQ_RETRY_SAFE_BUDGET_MS): GroqCallBudget {
  return {
    attemptsUsed: 0,
    maxAttempts: GROQ_MAX_ATTEMPTS_PER_MESSAGE,
    deadline: Date.now() + safeBudgetMs,
  };
}

/**
 * Error estructurado de una respuesta HTTP de Groq. `callGroq` lo lanza con
 * el status y los datos de rate-limit ya parseados, para que la capa de
 * retry no tenga que volver a leer headers/cuerpo.
 */
export class GroqHttpError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;
  readonly dailyLimit: boolean;

  constructor(status: number, message: string, opts: { retryAfterMs?: number | null; dailyLimit?: boolean } = {}) {
    super(message);
    this.name = "GroqHttpError";
    this.status = status;
    this.retryAfterMs = opts.retryAfterMs ?? null;
    this.dailyLimit = opts.dailyLimit ?? false;
  }
}

interface ClassifiedGroqError {
  status: number | null;
  retryable: boolean;
  reason: string;
  retryAfterMs: number | null;
  dailyLimit: boolean;
}

/**
 * Decide si un error de Groq amerita reintento y con qué metadatos.
 * Acepta tanto GroqHttpError (la ruta real) como Error planos con mensajes
 * conocidos (usados por tests y por errores no-HTTP como timeout/abort),
 * para no exigirle a cada test construir un GroqHttpError completo.
 */
function classifyGroqError(err: unknown): ClassifiedGroqError {
  if (err instanceof GroqHttpError) {
    if (err.status === 429) {
      if (err.dailyLimit) {
        return { status: 429, retryable: false, reason: "rate_limit_daily", retryAfterMs: err.retryAfterMs, dailyLimit: true };
      }
      return {
        status: 429,
        retryable: err.retryAfterMs !== null,
        reason: err.retryAfterMs !== null ? "rate_limit_short_window" : "rate_limit_unknown",
        retryAfterMs: err.retryAfterMs,
        dailyLimit: false,
      };
    }
    if (err.status === 401 || err.status === 403) {
      return { status: err.status, retryable: false, reason: "auth_error", retryAfterMs: null, dailyLimit: false };
    }
    if (err.status === 400) {
      return { status: 400, retryable: false, reason: "invalid_tool_arguments_json", retryAfterMs: null, dailyLimit: false };
    }
    if (err.status >= 500) {
      return { status: err.status, retryable: true, reason: "server_error", retryAfterMs: null, dailyLimit: false };
    }
    return { status: err.status, retryable: false, reason: "client_error", retryAfterMs: null, dailyLimit: false };
  }

  const message = err instanceof Error ? err.message : String(err);
  if (/invalid_tool_arguments_json/i.test(message)) {
    return { status: 400, retryable: false, reason: "invalid_tool_arguments_json", retryAfterMs: null, dailyLimit: false };
  }
  if (/groq_request_failed:401|groq_auth_error:401/.test(message)) {
    return { status: 401, retryable: false, reason: "auth_error", retryAfterMs: null, dailyLimit: false };
  }
  if (/groq_request_failed:403|groq_auth_error:403/.test(message)) {
    return { status: 403, retryable: false, reason: "auth_error", retryAfterMs: null, dailyLimit: false };
  }
  if (/groq_request_failed:429/.test(message)) {
    // Mensaje plano sin Retry-After parseado: no se adivina cuánto esperar.
    return { status: 429, retryable: false, reason: "rate_limit_unknown", retryAfterMs: null, dailyLimit: false };
  }
  if (/groq_request_failed:5\d\d/.test(message)) {
    return { status: null, retryable: true, reason: "server_error", retryAfterMs: null, dailyLimit: false };
  }
  if (/timeout|aborterror/i.test(message)) {
    return { status: null, retryable: true, reason: "timeout", retryAfterMs: null, dailyLimit: false };
  }
  return { status: null, retryable: false, reason: "unknown_error", retryAfterMs: null, dailyLimit: false };
}

/** Espera corta con jitter para 5xx/timeout: no depende de rate limit real. */
function shortServerErrorWaitMs(): number {
  const base = 400;
  const jitter = Math.floor(Math.random() * 300);
  return base + jitter;
}

/**
 * Calcula cuánto esperar antes del segundo intento, o null si no se debe
 * reintentar: límite diario, sin dato real de espera, la espera excede el
 * tope duro, o no cabe en lo que queda del presupuesto del mensaje.
 */
function safeRetryWaitMs(classified: ClassifiedGroqError, budget: GroqCallBudget): number | null {
  if (classified.dailyLimit) return null;

  let waitMs: number;
  if (classified.reason === "rate_limit_short_window") {
    if (classified.retryAfterMs === null) return null;
    waitMs = classified.retryAfterMs;
  } else if (classified.reason === "server_error" || classified.reason === "timeout") {
    waitMs = shortServerErrorWaitMs();
  } else {
    return null;
  }

  if (waitMs > GROQ_MAX_SINGLE_WAIT_MS) return null;
  const remaining = budget.deadline - Date.now();
  if (waitMs > remaining) return null;
  return waitMs;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** "6m0s" / "1.5s" / "500ms" estilo Go duration, usado por los headers x-ratelimit-reset-* de Groq. */
function parseGoDurationMs(value: string): number | null {
  const match = value.trim().match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?(?:(\d+)ms)?$/);
  if (!match) return null;
  const [, h, m, s, ms] = match;
  if (!h && !m && !s && !ms) return null;
  const totalMs =
    (h ? Number(h) * 3_600_000 : 0) +
    (m ? Number(m) * 60_000 : 0) +
    (s ? Number(s) * 1_000 : 0) +
    (ms ? Number(ms) : 0);
  return totalMs;
}

function parseRetryAfterMs(headers: Headers): number | null {
  const raw = headers.get("retry-after");
  if (raw) {
    const asSeconds = Number(raw);
    if (!Number.isNaN(asSeconds) && asSeconds >= 0) return Math.round(asSeconds * 1000);
    const asDate = Date.parse(raw);
    if (!Number.isNaN(asDate)) {
      const diff = asDate - Date.now();
      return diff > 0 ? diff : 0;
    }
  }

  const resetHeaders = [headers.get("x-ratelimit-reset-requests"), headers.get("x-ratelimit-reset-tokens")].filter(
    (v): v is string => !!v,
  );
  for (const value of resetHeaders) {
    const parsed = parseGoDurationMs(value);
    if (parsed !== null) return parsed;
  }
  return null;
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

    if (invalidToolJson) {
      throw new GroqHttpError(res.status, `groq_request_failed:${res.status}:invalid_tool_arguments_json`);
    }
    if (res.status === 401 || res.status === 403) {
      console.warn(`[llm/provider] groq_auth_error status=${res.status} (revisar GROQ_API_KEY / configuración)`);
      throw new GroqHttpError(res.status, `groq_auth_error:${res.status}`);
    }
    if (res.status === 429) {
      const retryAfterMs = parseRetryAfterMs(res.headers);
      const dailyLimit = /per day|\bdaily\b|\bTPD\b|\bRPD\b/i.test(text);
      throw new GroqHttpError(429, "groq_rate_limited", { retryAfterMs, dailyLimit });
    }
    throw new GroqHttpError(res.status, `groq_request_failed:${res.status}`);
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

/** Explicit Claude-only path for second-opinion workflows. */
export async function callClaudeReviewer(params: LLMCreateParams): Promise<LLMResponse> {
  return callClaude(params);
}

/**
 * Llamada a LLM con fallback automático.
 *
 * Intenta Groq hasta `budget.maxAttempts` veces (2 por defecto, compartidas
 * entre todas las rondas de un mismo mensaje). Un 429 de ventana corta
 * (RPM/TPM) con Retry-After real dispara un segundo intento si cabe en el
 * presupuesto de ejecución; un 5xx/timeout reintenta una vez con espera
 * corta + jitter. Cualquier otro caso (400 de tool JSON inválido, 401/403,
 * límite diario, Retry-After que excede el presupuesto, u otro 4xx) cae a
 * Claude sin reintentar. Si Claude también falla, se lanza el error.
 *
 * Registra en logs cuál proveedor respondió y por qué.
 */
export async function runProviderFallback(
  params: LLMCreateParams,
  providers: {
    groq: (input: LLMCreateParams) => Promise<LLMResponse>;
    claude: (input: LLMCreateParams) => Promise<LLMResponse>;
  },
  preferGroq = true,
  budget: GroqCallBudget = createGroqCallBudget(),
  sleepFn: (ms: number) => Promise<void> = sleep,
): Promise<LLMResponse> {
  if (!preferGroq) return providers.claude(params);

  if (budget.attemptsUsed >= budget.maxAttempts) {
    console.log("[llm/provider] retry_skipped_reason=attempts_exhausted (budget ya consumido en rondas previas de este mensaje)");
    return providers.claude(params);
  }

  let lastReason = "unknown_error";

  while (budget.attemptsUsed < budget.maxAttempts) {
    if (Date.now() >= budget.deadline) {
      console.log("[llm/provider] retry_skipped_reason=execution_budget_exhausted");
      lastReason = "execution_budget_exhausted";
      break;
    }

    const attempt = budget.attemptsUsed + 1;
    budget.attemptsUsed = attempt;

    try {
      const response = await providers.groq(params);
      console.log(`[llm/provider] groq_attempt=${attempt} final_provider=groq`);
      return response;
    } catch (err) {
      const classified = classifyGroqError(err);
      lastReason = classified.reason;
      console.warn(
        `[llm/provider] groq_attempt=${attempt} retry_reason=${classified.reason}` +
          (classified.status !== null ? ` status=${classified.status}` : ""),
      );

      if (attempt >= budget.maxAttempts) {
        console.log("[llm/provider] retry_skipped_reason=attempts_exhausted");
        break;
      }
      if (!classified.retryable) {
        console.log(`[llm/provider] retry_skipped_reason=${classified.reason}`);
        break;
      }

      const waitMs = safeRetryWaitMs(classified, budget);
      if (waitMs === null) {
        const skipReason = classified.dailyLimit ? "daily_limit" : "retry_after_exceeds_budget";
        console.log(
          `[llm/provider] retry_skipped_reason=${skipReason}` +
            (classified.retryAfterMs !== null ? ` retry_after_ms=${classified.retryAfterMs}` : ""),
        );
        break;
      }

      console.log(`[llm/provider] retry_after_ms=${waitMs} groq_attempt_next=${attempt + 1}`);
      await sleepFn(waitMs);
    }
  }

  console.log(`[llm/provider] fallback a Claude (motivo=${lastReason})`);
  const response = await providers.claude(params);
  console.log("[llm/provider] final_provider=claude_fallback");
  return response;
}

export async function callLLM(params: LLMCreateParams, budget?: GroqCallBudget): Promise<LLMResponse> {
  const preferGroq = !!process.env.GROQ_API_KEY;

  if (!preferGroq) {
    // Si no hay GROQ_API_KEY, usar Claude directamente
    const response = await callClaude(params);
    console.log("[llm/provider] usando Claude (Groq no configurado)");
    return response;
  }

  const response = await runProviderFallback(
    params,
    { groq: callGroq, claude: callClaude },
    true,
    budget ?? createGroqCallBudget(),
  );
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
