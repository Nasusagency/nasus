-- Registro de inicios de sesión del panel admin: límite de intentos que
-- sobrevive entre instancias y avisos de acceso nuevo.
--
-- Sin datos personales: la IP no se guarda, solo un HMAC estable (ADMIN_JWT_SECRET)
-- para contar intentos y reconocer dispositivos; tampoco se guarda el correo ni la
-- contraseña escritos. País y ciudad vienen de los headers de Vercel.
-- RLS activo y sin políticas: solo la service role (servidor) lee y escribe.

create table if not exists public.admin_login_log (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  ip_hash text not null,
  ok boolean not null,
  country text check (country is null or char_length(country) <= 8),
  city text check (city is null or char_length(city) <= 80),
  user_agent text check (user_agent is null or char_length(user_agent) <= 200)
);

create index if not exists admin_login_log_ip_ts_idx on public.admin_login_log (ip_hash, ts desc);
create index if not exists admin_login_log_ok_ts_idx on public.admin_login_log (ok, ts desc);

alter table public.admin_login_log enable row level security;
revoke all on table public.admin_login_log from anon, authenticated;
