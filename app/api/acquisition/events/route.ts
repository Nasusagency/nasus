import { NextResponse } from "next/server";
import { recordAcquisitionEvent, type AcquisitionEventInput } from "@/lib/acquisition/server";
import { normalizeSource } from "@/lib/acquisition/attribution";

const EVENTS = new Set(["page_view", "whatsapp_click", "assistant_demo_click"]);
const clean = (value: unknown, max = 160) => typeof value === "string" ? value.trim().slice(0, max) || null : null;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!EVENTS.has(String(body.eventType)) || !clean(body.sessionId, 80) || !clean(body.landingPath, 300)) {
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  }
  const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
    ? Object.fromEntries(Object.entries(body.metadata as Record<string, unknown>).slice(0, 10).flatMap(([k, v]) => {
        const value = clean(v, 100); return value ? [[k.slice(0, 40), value]] : [];
      }))
    : {};
  const result = await recordAcquisitionEvent({
    eventType: body.eventType as AcquisitionEventInput["eventType"], sessionId: clean(body.sessionId, 80)!,
    source: normalizeSource(clean(body.source), clean(body.referrer, 500)), medium: clean(body.medium), campaign: clean(body.campaign),
    content: clean(body.content), term: clean(body.term), landingPath: clean(body.landingPath, 300)!,
    referrer: clean(body.referrer, 500), metadata,
  });
  return NextResponse.json(result, { status: result.stored ? 201 : 202 });
}
