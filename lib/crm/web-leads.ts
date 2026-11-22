import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizePhoneNumber } from "@/lib/whatsapp/groq-allowlist";
import { buildLookupCandidates } from "@/lib/whatsapp/qa-reset-candidates";
import { recordCrmActivity } from "./service";

const PHONE_RE = /^\d{10,15}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export interface WebLeadInput {
  nombre: string;
  empresa: string;
  problema: string;
  telefono: string;
  email?: string | null;
  attribution?: { source?: string | null; medium?: string | null; campaign?: string | null; content?: string | null; term?: string | null; landingPath?: string | null };
}

export type WebLeadResult =
  | { ok: true; leadId: string; created: boolean }
  | { ok: false; error: "database_unavailable" | "invalid_phone" | "invalid_email" | "save_failed" };

/** Teléfono canónico (52 + 10 dígitos para México) o null si no es válido. */
export function canonicalPhone(raw: string): string | null {
  let digits = normalizePhoneNumber(raw);
  if (digits.length === 10) digits = `52${digits}`;
  return PHONE_RE.test(digits) ? digits : null;
}

/**
 * Alta de un lead originado en el formulario web. Reutiliza whatsapp_leads
 * (contacto canónico del CRM) con la misma identidad por número que el resto
 * del sistema. Si ya existe, NO pisa sus datos: solo actualiza la última
 * interacción, completa lo que falte y deja rastro en crm_activities.
 */
export async function createWebLead(
  input: WebLeadInput,
  client: SupabaseClient | null = createServiceClient(),
): Promise<WebLeadResult> {
  if (!client) return { ok: false, error: "database_unavailable" };
  const numero = canonicalPhone(input.telefono);
  if (!numero) return { ok: false, error: "invalid_phone" };
  const email = input.email?.trim().toLowerCase() || null;
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: "invalid_email" };

  const now = new Date().toISOString();
  const a = input.attribution ?? {};
  const web = {
    email,
    mensaje: input.problema,
    atribucion: { source: a.source ?? null, medium: a.medium ?? null, campaign: a.campaign ?? null, content: a.content ?? null, term: a.term ?? null, landing: a.landingPath ?? null },
    recibido: now,
  };

  const { data: existing, error: lookupError } = await client
    .from("whatsapp_leads")
    .select("id,nombre_contacto,nombre_empresa,problema_descrito,datos_estructurados")
    .in("numero", buildLookupCandidates(numero))
    .limit(1)
    .maybeSingle();
  if (lookupError) return { ok: false, error: "save_failed" };

  if (existing) {
    const prev = (existing.datos_estructurados as Record<string, unknown> | null) ?? {};
    const { error } = await client.from("whatsapp_leads").update({
      nombre_contacto: existing.nombre_contacto ?? input.nombre,
      nombre_empresa: existing.nombre_empresa ?? input.empresa,
      problema_descrito: existing.problema_descrito ?? input.problema,
      datos_estructurados: { ...prev, email: prev.email ?? email, web_form: web },
      ultima_interaccion: now,
      updated_at: now,
    }).eq("id", existing.id);
    if (error) return { ok: false, error: "save_failed" };
    await recordCrmActivity({
      contactId: existing.id, eventType: "web_form_submitted", actor: "system", source: "web_form",
      metadata: { returning: true, utm_source: a.source ?? null, utm_campaign: a.campaign ?? null },
      idempotencyKey: `web-form:${existing.id}:${now}`,
    }, client);
    return { ok: true, leadId: existing.id, created: false };
  }

  const { data: lead, error } = await client.from("whatsapp_leads").insert({
    numero,
    nombre_contacto: input.nombre,
    nombre_empresa: input.empresa,
    problema_descrito: input.problema,
    resumen: input.problema,
    stage: "exploring",
    lifecycle: "lead",
    origin_source: "web_form",
    requiere_humano: true,
    razon_handoff: "Formulario web",
    datos_estructurados: { email, web_form: web },
    ultima_interaccion: now,
    updated_at: now,
  }).select("id").single();
  if (error || !lead) return { ok: false, error: "save_failed" };

  await recordCrmActivity({
    contactId: lead.id, eventType: "web_form_submitted", actor: "system", source: "web_form",
    metadata: { returning: false, utm_source: a.source ?? null, utm_campaign: a.campaign ?? null },
    idempotencyKey: `web-form:${lead.id}:created`,
  }, client);
  return { ok: true, leadId: lead.id, created: true };
}
