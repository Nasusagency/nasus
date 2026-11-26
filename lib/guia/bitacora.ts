import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { rolIA } from "./classify";

/**
 * Entrada diaria de la bitácora del Laberinto de Agentes (laberinto_bitacora),
 * calculada con las visitas de las últimas 24 h. La dispara el cron de Vercel
 * (vercel.json) porque las tareas programadas de Claude no pueden recibir el
 * conector de Supabase en esta organización.
 *
 * Solo conteos, nombres de agente y rutas: nunca ip_hash ni user agents.
 */
type Visita = { ruta: string; estado: number; origen: string; tipo_visitante: string; agente: string | null; referencia: string | null; ip_hash: string | null };

function top(values: (string | null)[], n = 8): [string, number][] {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}
const fmt = (rows: [string, number][]) => rows.map(([k, v]) => `${k} (${v})`).join(", ");

export async function escribirBitacoraDiaria(): Promise<{ ok: boolean; skipped?: boolean; id?: number; total?: number }> {
  const supabase = createServiceClient();
  if (!supabase) return { ok: false };
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

  const { data: existente } = await supabase.from("laberinto_bitacora").select("id").eq("fecha", hoy).eq("detalle->>fuente", "cron").limit(1);
  if (existente?.length) return { ok: true, skipped: true };

  const desde = new Date(Date.now() - 86400000).toISOString();
  const { data, error } = await supabase.from("laberinto_visitas")
    .select("ruta,estado,origen,tipo_visitante,agente,referencia,ip_hash").gte("ts", desde).limit(20000);
  if (error) return { ok: false };
  const rows = (data ?? []) as Visita[];

  const porTipo = top(rows.map((r) => r.tipo_visitante), 10);
  const agentes = top(rows.map((r) => r.agente), 10);
  const ramas = top(rows.filter((r) => r.origen === "guia" && r.estado === 200).map((r) => r.ruta));
  const noExisten = top(rows.filter((r) => r.estado === 404).map((r) => r.ruta), 10);
  const archivos = top(rows.filter((r) => r.origen === "archivo").map((r) => `${r.ruta} · ${r.agente ?? r.tipo_visitante}`));
  const caminos = top(rows.filter((r) => r.referencia).map((r) => `${r.referencia} → ${r.ruta}`), 5);
  const visitantes = new Set(rows.map((r) => r.ip_hash).filter(Boolean)).size;
  const ia = rows.filter((r) => r.tipo_visitante === "agente_ia").length;
  // Lo que importa para el estudio: ¿entró alguien por encargo de una persona, o solo rastreadores?
  const agentesUsuario = rows.filter((r) => rolIA(r.tipo_visitante, r.agente) === "agente_usuario");
  const rastreadoresIa = rows.filter((r) => rolIA(r.tipo_visitante, r.agente) === "rastreador_ia");
  const noExistenIa = top(rows.filter((r) => r.estado === 404 && rolIA(r.tipo_visitante, r.agente) !== null).map((r) => r.ruta), 8);

  const resumen = rows.length
    ? [
        `Últimas 24 h: ${rows.length} solicitudes de ${visitantes} visitantes distintos; ${ia} de IA.`,
        `Agentes de usuario (entran por encargo de una persona): ${agentesUsuario.length}${agentesUsuario.length ? ` (${fmt(top(agentesUsuario.map((r) => r.agente), 5))})` : ""}. Rastreadores de IA (indexan, sin intención): ${rastreadoresIa.length}${rastreadoresIa.length ? ` (${fmt(top(rastreadoresIa.map((r) => r.agente), 5))})` : ""}.`,
        noExistenIa.length ? `404 pedidos por IA: ${fmt(noExistenIa)}.` : "404 pedidos por IA: ninguno.",
        `Por tipo: ${fmt(porTipo)}.`,
        agentes.length ? `Agentes: ${fmt(agentes)}.` : "",
        ramas.length ? `Ramas más pedidas: ${fmt(ramas)}.` : "Sin visitas a páginas de la guía.",
        noExisten.length ? `Rutas que no existen más pedidas: ${fmt(noExisten)}.` : "Sin 404.",
        archivos.length ? `Archivos leídos: ${fmt(archivos)}.` : "",
        caminos.length ? `Caminos: ${fmt(caminos)}.` : "",
      ].filter(Boolean).join("\n").slice(0, 4000)
    : "Últimas 24 h: sin datos todavía (ninguna solicitud registrada en laberinto_visitas).";

  const { data: insert, error: insertError } = await supabase.from("laberinto_bitacora").insert({
    tipo: rows.length ? "datos" : "nota",
    resumen,
    detalle: {
      fuente: "cron", desde, total: rows.length, visitantes, agentes_ia: ia,
      agentes_usuario: agentesUsuario.length, rastreadores_ia: rastreadoresIa.length, no_existen_ia: Object.fromEntries(noExistenIa),
      por_tipo: Object.fromEntries(porTipo), agentes: Object.fromEntries(agentes),
      ramas: Object.fromEntries(ramas), no_existen: Object.fromEntries(noExisten),
      archivos: Object.fromEntries(archivos), caminos: Object.fromEntries(caminos),
    },
  }).select("id").single();
  if (insertError) return { ok: false };
  return { ok: true, id: insert?.id, total: rows.length };
}
