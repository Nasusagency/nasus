import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type AcquisitionEventInput = {
  eventType: "page_view" | "whatsapp_click" | "assistant_demo_click";
  sessionId: string;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
  landingPath: string;
  referrer?: string | null;
  metadata?: Record<string, string>;
};

function shortId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export async function recordAcquisitionEvent(input: AcquisitionEventInput) {
  const supabase = createServiceClient();
  if (!supabase) return { attributionId: null, stored: false };
  const attributionId = input.eventType === "whatsapp_click" ? shortId() : null;
  const { error } = await supabase.from("acquisition_events").insert({
    event_type: input.eventType,
    attribution_id: attributionId,
    session_id: input.sessionId,
    source: input.source ?? null,
    medium: input.medium ?? null,
    campaign: input.campaign ?? null,
    content: input.content ?? null,
    term: input.term ?? null,
    landing_path: input.landingPath,
    referrer: input.referrer ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) return { attributionId: null, stored: false };
  return { attributionId, stored: true };
}

export async function resolveAndAssociateAttribution(attributionId: string, numero: string): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) return;
  const { data } = await supabase
    .from("acquisition_events")
    .select("id")
    .eq("attribution_id", attributionId)
    .eq("event_type", "whatsapp_click")
    .maybeSingle();
  if (!data) return;
  await supabase
    .from("whatsapp_leads")
    .update({ acquisition_event_id: data.id })
    .eq("numero", numero)
    .is("acquisition_event_id", null);
}
