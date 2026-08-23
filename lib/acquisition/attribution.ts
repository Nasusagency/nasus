export const ATTRIBUTION_TOKEN_PATTERN = /(?:\s|^)\[N:([A-Z2-9]{6,10})\]\s*/i;

export type UtmFields = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
};

export type FirstTouch = Partial<UtmFields> & { referrer?: string | null };

export function captureFirstTouch(existing: FirstTouch | null, params: URLSearchParams, referrer: string | null): FirstTouch {
  if (existing && Object.keys(existing).length > 0) return existing;
  const value = (key: string) => params.get(`utm_${key}`)?.trim().slice(0, 160) || null;
  return { source: value("source"), medium: value("medium"), campaign: value("campaign"), content: value("content"), term: value("term"), referrer };
}

export function normalizeSource(source: string | null | undefined, referrer?: string | null): string {
  const value = source?.trim().toLowerCase();
  if (value) {
    if (value.includes("chatgpt") || value.includes("openai")) return "chatgpt";
    if (value.includes("google")) return "google";
    if (["organic", "direct"].includes(value)) return value;
    return "otros";
  }
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host.includes("google.")) return "organic";
    if (host.includes("chatgpt.com") || host.includes("openai.com")) return "chatgpt";
    if (host.endsWith("nasus.lat")) return "direct";
  } catch { /* referrer inválido: se clasifica como otros */ }
  return "otros";
}

export function extractAttributionToken(text: string): { cleanText: string; attributionId: string | null } {
  const match = text.match(ATTRIBUTION_TOKEN_PATTERN);
  return {
    attributionId: match?.[1]?.toUpperCase() ?? null,
    cleanText: text.replace(ATTRIBUTION_TOKEN_PATTERN, " ").replace(/\s{2,}/g, " ").trim(),
  };
}

export function safeRate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

export function maskPhone(phone: string): string {
  if (phone.length < 7) return "••••";
  return `${phone.slice(0, 2)}••••••${phone.slice(-4)}`;
}

export function matchesAcquisitionFilters<T extends { source?: string | null; campaign?: string | null }>(row: T, source?: string, campaign?: string): boolean {
  return (!source || row.source === source) && (!campaign || row.campaign === campaign);
}
