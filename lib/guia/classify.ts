/**
 * Clasifica un visitante por su user agent declarado. Es una señal, no una
 * prueba: cualquiera puede mentir en el user agent y algunos agentes usan uno
 * de navegador normal.
 */
export type TipoVisitante =
  | "agente_ia"
  | "buscador"
  | "otro_bot"
  | "herramienta"
  | "navegador_automatizado"
  | "navegador"
  | "desconocido";

const AI: [RegExp, string][] = [
  [/ChatGPT-User/i, "ChatGPT-User"],
  [/OAI-SearchBot/i, "OAI-SearchBot"],
  [/GPTBot/i, "GPTBot"],
  [/Claude-User/i, "Claude-User"],
  [/Claude-SearchBot/i, "Claude-SearchBot"],
  [/ClaudeBot/i, "ClaudeBot"],
  [/anthropic-ai/i, "anthropic-ai"],
  [/Perplexity-User/i, "Perplexity-User"],
  [/PerplexityBot/i, "PerplexityBot"],
  [/Google-CloudVertexBot/i, "Google-CloudVertexBot"],
  [/Gemini/i, "Gemini"],
  [/meta-externalagent/i, "meta-externalagent"],
  [/meta-externalfetcher/i, "meta-externalfetcher"],
  [/Bytespider/i, "Bytespider"],
  [/CCBot/i, "CCBot"],
  [/Amazonbot/i, "Amazonbot"],
  [/DuckAssistBot/i, "DuckAssistBot"],
  [/MistralAI-User/i, "MistralAI-User"],
  [/cohere-ai/i, "cohere-ai"],
  [/YouBot/i, "YouBot"],
  [/AI2Bot/i, "AI2Bot"],
  [/Diffbot/i, "Diffbot"],
  [/Timpibot/i, "Timpibot"],
  [/Kangaroo Bot/i, "Kangaroo Bot"],
];

const SEARCH: [RegExp, string][] = [
  [/GoogleOther/i, "GoogleOther"], // investigación interna de Google: buscador, no agente de IA
  [/Googlebot/i, "Googlebot"],
  [/bingbot/i, "Bingbot"],
  [/Applebot/i, "Applebot"],
  [/YandexBot/i, "YandexBot"],
  [/Baiduspider/i, "Baiduspider"],
  [/DuckDuckBot/i, "DuckDuckBot"],
  [/PetalBot/i, "PetalBot"],
];

const OTHER_BOTS: [RegExp, string][] = [
  [/AhrefsBot/i, "AhrefsBot"],
  [/SemrushBot/i, "SemrushBot"],
  [/MJ12bot/i, "MJ12bot"],
  [/DotBot/i, "DotBot"],
  [/facebookexternalhit/i, "facebookexternalhit"],
  [/Twitterbot/i, "Twitterbot"],
  [/LinkedInBot/i, "LinkedInBot"],
  [/WhatsApp/i, "WhatsApp"],
  [/Slackbot/i, "Slackbot"],
  [/TelegramBot/i, "TelegramBot"],
  [/Discordbot/i, "Discordbot"],
  [/vercel/i, "Vercel"],
];

const TOOLS: [RegExp, string][] = [
  [/^curl\//i, "curl"],
  [/^Wget/i, "wget"],
  [/python-requests/i, "python-requests"],
  [/python-httpx/i, "python-httpx"],
  [/aiohttp/i, "aiohttp"],
  [/axios/i, "axios"],
  [/node-fetch/i, "node-fetch"],
  [/undici/i, "undici"],
  [/^node$/i, "node"],
  [/Go-http-client/i, "Go-http-client"],
  [/okhttp/i, "okhttp"],
  [/Java\//i, "Java"],
];

function match(ua: string, list: [RegExp, string][]): string | null {
  for (const [re, name] of list) if (re.test(ua)) return name;
  return null;
}

export function classifyVisitor(userAgent: string | null): { tipo: TipoVisitante; agente: string | null } {
  const ua = (userAgent ?? "").trim();
  if (!ua) return { tipo: "desconocido", agente: null };
  let name = match(ua, AI);
  if (name) return { tipo: "agente_ia", agente: name };
  name = match(ua, SEARCH);
  if (name) return { tipo: "buscador", agente: name };
  name = match(ua, OTHER_BOTS);
  if (name) return { tipo: "otro_bot", agente: name };
  name = match(ua, TOOLS);
  if (name) return { tipo: "herramienta", agente: name };
  if (/HeadlessChrome|Playwright|Puppeteer|PhantomJS|Selenium/i.test(ua)) return { tipo: "navegador_automatizado", agente: "headless" };
  if (/bot|crawl|spider|scrape|fetch/i.test(ua)) return { tipo: "otro_bot", agente: ua.slice(0, 40) };
  if (/^Mozilla\/5\.0/.test(ua) && /(Chrome|Safari|Firefox|Edg)\//.test(ua)) return { tipo: "navegador", agente: null };
  return { tipo: "desconocido", agente: null };
}

/**
 * Rol del visitante de IA, que es lo que importa para el estudio:
 *  - agente_usuario: entra porque una PERSONA le pidió algo a una IA (ChatGPT-User, Claude-User…).
 *    Es el único tráfico cuya ruta y 404 pueden revelar una intención.
 *  - rastreador_ia: indexa o entrena de forma sistemática (GPTBot, ClaudeBot, OAI-SearchBot…); no persigue
 *    la intención de nadie.
 */
export const AGENTES_USUARIO = [
  "ChatGPT-User", "Claude-User", "Perplexity-User", "MistralAI-User", "DuckAssistBot", "meta-externalfetcher", "Gemini",
] as const;

export type RolIA = "agente_usuario" | "rastreador_ia";

export function rolIA(tipo: string, agente: string | null): RolIA | null {
  if (tipo !== "agente_ia" || agente === "GoogleOther") return null; // GoogleOther: filas viejas aún marcadas como IA
  return agente && (AGENTES_USUARIO as readonly string[]).includes(agente) ? "agente_usuario" : "rastreador_ia";
}
