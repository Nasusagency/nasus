-- Registro de la guía pública (/guia, "Laberinto de Agentes"), de los archivos
-- para agentes (llms.txt, robots.txt, sitemap.xml) y de las rutas inexistentes
-- (404) de todo el sitio. Sirve para inferir qué buscan los agentes de IA.
--
-- Sin datos personales: la IP no se guarda, solo un HMAC de IP + día.
-- RLS activo y sin políticas: solo la service role (servidor) lee y escribe.

create table if not exists public.laberinto_visitas (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  ruta text not null check (char_length(ruta) <= 160),
  estado smallint not null,
  origen text not null check (origen in ('guia', 'archivo', '404')),
  metodo text not null default 'GET',
  tipo_visitante text not null,
  agente text,
  referencia text,
  referer_host text,
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  ip_hash text
);

create index if not exists laberinto_visitas_ts_idx on public.laberinto_visitas (ts desc);
create index if not exists laberinto_visitas_origen_ts_idx on public.laberinto_visitas (origen, ts desc);

alter table public.laberinto_visitas enable row level security;
revoke all on table public.laberinto_visitas from anon, authenticated;
