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

/**
 * Registra la llegada desde un anuncio "clic a WhatsApp" de Meta como un evento de
 * adquisición (origen "meta"), igual que un clic desde el sitio, y devuelve su
 * attribution_id para ligarlo al lead con resolveAndAssociateAttribution.
 *
 * Meta no manda el nombre de la campaña en el mensaje: se usa el titular del anuncio
 * como campaña legible y el id del anuncio como `content`. Nada de esto es PII.
 */
export async function recordMetaAdReferral(referral: {
  adId: string | null; sourceType: string | null; sourceUrl: string | null; headline: string | null; ctwaClid: string | null;
}): Promise<string | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;
  const attributionId = shortId();
  const clean = (value: string | null, max: number) => value?.trim().slice(0, max) || null;
  const { error } = await supabase.from("acquisition_events").insert({
    event_type: "whatsapp_click",
    attribution_id: attributionId,
    session_id: clean(`ctwa:${referral.ctwaClid ?? referral.adId ?? attributionId}`, 80),
    source: "meta",
    medium: "paid_social",
    campaign: clean(referral.headline, 160) ?? (referral.adId ? `anuncio ${referral.adId}`.slice(0, 160) : "anuncio de meta"),
    content: clean(referral.adId, 160),
    term: null,
    landing_path: "/whatsapp-ad",
    referrer: clean(referral.sourceUrl, 500),
    metadata: {
      destination_type: "comercial",
      cta_location: "meta_ctwa",
      ...(referral.sourceType ? { source_type: referral.sourceType.slice(0, 40) } : {}),
      ...(referral.ctwaClid ? { ctwa_clid: referral.ctwaClid.slice(0, 100) } : {}),
    },
  });
  if (error) {
    console.error(`[acquisition] meta_referral_failed code=${error.code}`);
    return null;
  }
  return attributionId;
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
