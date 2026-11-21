import { createHmac } from "node:crypto";

import { createServiceClient } from "@/lib/supabase/service";

import { liveLimits } from "./config";

export type ReserveResult =
  | { ok: true; id: string }
  | { ok: false; reason: "ip" | "day" | "month" | "unavailable" };

/**
 * Hash de la IP con sal del servidor. Nunca se guarda ni se registra la IP.
 */
export function hashIp(ip: string): string {
  const salt = process.env.LIVE_IP_SALT ?? process.env.ADMIN_JWT_SECRET ?? "nasus-live";
  return createHmac("sha256", salt).update(ip).digest("hex");
}

/**
 * Reserva segundos de voz contra los topes por IP, diario y mensual.
 *
 * Falla CERRADO: si Supabase no está configurado o la función SQL no existe
 * todavía (migración 0020 sin aplicar), no se abre ninguna sesión. Un error aquí
 * jamás debe traducirse en gasto sin control.
 */
export async function reserveLiveSession(ipHash: string): Promise<ReserveResult> {
  const supabase = createServiceClient();
  if (!supabase) return { ok: false, reason: "unavailable" };

  const limits = liveLimits();
  const { data, error } = await supabase.rpc("live_reserve", {
    p_ip_hash: ipHash,
    p_seconds: limits.sessionSeconds,
    p_ip_daily_max: limits.ipDailySessions,
    p_day_seconds_max: limits.dailySeconds,
    p_month_seconds_max: limits.monthlySeconds,
  });

  if (error) {
    // Solo el mensaje: nada de IP ni del objeto de error completo.
    console.error("[live] reserve error:", error.message);
    return { ok: false, reason: "unavailable" };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, reason: "unavailable" };
  if (row.ok === true && typeof row.session_id === "string") {
    return { ok: true, id: row.session_id };
  }
  if (row.reason === "ip" || row.reason === "day" || row.reason === "month") {
    return { ok: false, reason: row.reason };
  }
  return { ok: false, reason: "unavailable" };
}

/** Devuelve la reserva cuando OpenAI no llegó a abrir la sesión (no se cobró). */
export async function releaseLiveReservation(id: string): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) return;
  const { error } = await supabase.from("live_sessions").delete().eq("id", id);
  if (error) console.error("[live] release error:", error.message);
}
