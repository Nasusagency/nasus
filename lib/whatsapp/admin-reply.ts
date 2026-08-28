export type AdminReplyDependencies = {
  reserve: () => Promise<"reserved" | "duplicate" | "failed">;
  takeConversation: () => Promise<boolean>;
  send: () => Promise<void>;
  markDelivery: (status: "sent" | "failed") => Promise<void>;
};

export async function performAdminReply(dependencies: AdminReplyDependencies) {
  const reservation = await dependencies.reserve();
  if (reservation === "duplicate") return { ok: true, duplicate: true } as const;
  if (reservation === "failed") return { ok: false, error: "message_reservation_failed" } as const;
  if (!(await dependencies.takeConversation())) {
    await dependencies.markDelivery("failed");
    return { ok: false, error: "handoff_failed" } as const;
  }
  try {
    await dependencies.send();
    await dependencies.markDelivery("sent");
    return { ok: true, duplicate: false } as const;
  } catch {
    await dependencies.markDelivery("failed");
    return { ok: false, error: "whatsapp_send_failed" } as const;
  }
}

