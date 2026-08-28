import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin/auth";
import { sendAdminWhatsAppMessage, setConversationState } from "@/lib/admin/whatsapp-data";
import type { ConversationMode, ConversationStatus } from "@/lib/whatsapp/conversation-policy";

async function authorized(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return Boolean(token && await verifyAdminToken(token));
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await authorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!text || text.length > 4096 || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400 });
  }
  const result = await sendAdminWhatsAppMessage({ conversationId: id, body: text, requestId, adminActor: "admin" });
  return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await authorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const modes = new Set<ConversationMode>(["ai", "human", "paused"]);
  const statuses = new Set<ConversationStatus>(["open", "resolved"]);
  const mode = body.mode as ConversationMode;
  const status = body.status as ConversationStatus | undefined;
  if (!modes.has(mode) || (status !== undefined && !statuses.has(status))) {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }
  const result = await setConversationState(id, mode, status);
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
