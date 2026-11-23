import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export type GuiaVisita = {
  ts: string; ruta: string; estado: number; origen: string; tipo_visitante: string;
  agente: string | null; referencia: string | null; referer_host: string | null; ip_hash: string | null;
};

type Count = { key: string; total: number; ia: number; agentes: string[]; ultima: string };

function countBy(rows: GuiaVisita[], keyOf: (r: GuiaVisita) => string | null): Count[] {
  const map = new Map<string, Count & { set: Set<string> }>();
  for (const r of rows) {
    const key = keyOf(r);
    if (!key) continue;
    const c = map.get(key) ?? { key, total: 0, ia: 0, agentes: [], ultima: r.ts, set: new Set<string>() };
    c.total++;
    if (r.tipo_visitante === "agente_ia") c.ia++;
    if (r.agente) c.set.add(r.agente);
    if (r.ts > c.ultima) c.ultima = r.ts;
    map.set(key, c);
  }
  return [...map.values()]
    .map(({ set, ...c }) => ({ ...c, agentes: [...set].slice(0, 6) }))
    .sort((a, b) => b.total - a.total);
}

export async function getGuiaDashboard({ days, tipo }: { days: number; tipo?: string }) {
  const supabase = createServiceClient();
  if (!supabase) return null;
  const from = new Date(Date.now() - Math.max(1, Math.min(days, 365)) * 86400000).toISOString();
  let query = supabase.from("laberinto_visitas")
    .select("ts,ruta,estado,origen,tipo_visitante,agente,referencia,referer_host,ip_hash")
    .gte("ts", from).order("ts", { ascending: false }).limit(20000);
  if (tipo) query = query.eq("tipo_visitante", tipo);
  const { data, error } = await query;
  if (error) return { error: true as const };
  const rows = (data ?? []) as GuiaVisita[];
  const guia = rows.filter((r) => r.origen === "guia");
  return {
    error: false as const,
    total: rows.length,
    visitantes: new Set(rows.map((r) => r.ip_hash).filter(Boolean)).size,
    porTipo: countBy(rows, (r) => r.tipo_visitante),
    agentes: countBy(rows, (r) => r.agente),
    ramas: countBy(guia.filter((r) => r.estado === 200), (r) => r.ruta),
    noExisten: countBy(rows.filter((r) => r.estado === 404), (r) => r.ruta),
    archivos: countBy(rows.filter((r) => r.origen === "archivo"), (r) => r.ruta),
    caminos: countBy(guia.filter((r) => r.referencia), (r) => `${r.referencia} → ${r.ruta}`),
    referers: countBy(rows.filter((r) => r.referer_host && !r.referer_host.endsWith("nasus.mx")), (r) => r.referer_host),
    recientes: rows.slice(0, 60),
  };
}
