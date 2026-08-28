export type ConversationMode = "ai" | "human" | "paused";
export type ConversationStatus = "open" | "resolved";

export function shouldAutoRespond(mode: ConversationMode): boolean {
  return mode === "ai";
}

export function modeAfterAdminReply(): ConversationMode {
  return "human";
}

export function attributionLabel(source: string | null | undefined): string {
  return source || "Unknown / Direct";
}

