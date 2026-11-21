-- ─────────────────────────────────────────────────────────────────────────────
-- Presupuesto del asistente de voz en vivo (GPT-Live)
--
-- Cada sesión de voz cuesta dinero por segundo, y el endpoint es público. Esta
-- tabla es el tope duro del lado del servidor: antes de abrir una sesión se
-- RESERVAN segundos contra tres límites (por IP, diario y mensual). Si alguno
-- se agota, no se abre la sesión.
--
-- Se guarda solo un hash de la IP (HMAC con sal del servidor), nunca la IP.
-- La reserva es atómica: el advisory lock serializa las reservas concurrentes
-- para que dos peticiones simultáneas no rebasen el tope juntas.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  reserved_seconds integer not null check (reserved_seconds > 0),
  created_at timestamptz not null default now()
);

create index if not exists live_sessions_created_at_idx
  on public.live_sessions (created_at desc);

create index if not exists live_sessions_ip_created_idx
  on public.live_sessions (ip_hash, created_at desc);

-- Sin políticas RLS: solo la service role (servidor) accede.
alter table public.live_sessions enable row level security;
revoke all on public.live_sessions from anon, authenticated;

create or replace function public.live_reserve(
  p_ip_hash text,
  p_seconds integer,
  p_ip_daily_max integer,
  p_day_seconds_max integer,
  p_month_seconds_max integer
)
returns table (ok boolean, reason text, session_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_count integer;
  v_day_seconds bigint;
  v_month_seconds bigint;
  v_id uuid;
begin
  -- Serializa las reservas para que el conteo y el insert sean atómicos.
  perform pg_advisory_xact_lock(hashtext('live_reserve'));

  select count(*) into v_ip_count
    from public.live_sessions
   where ip_hash = p_ip_hash
     and created_at > now() - interval '24 hours';

  if v_ip_count >= p_ip_daily_max then
    return query select false, 'ip'::text, null::uuid;
    return;
  end if;

  select coalesce(sum(reserved_seconds), 0) into v_day_seconds
    from public.live_sessions
   where created_at > now() - interval '24 hours';

  if v_day_seconds + p_seconds > p_day_seconds_max then
    return query select false, 'day'::text, null::uuid;
    return;
  end if;

  select coalesce(sum(reserved_seconds), 0) into v_month_seconds
    from public.live_sessions
   where created_at >= date_trunc('month', now());

  if v_month_seconds + p_seconds > p_month_seconds_max then
    return query select false, 'month'::text, null::uuid;
    return;
  end if;

  insert into public.live_sessions (ip_hash, reserved_seconds)
  values (p_ip_hash, p_seconds)
  returning id into v_id;

  return query select true, 'ok'::text, v_id;
end;
$$;

revoke all on function public.live_reserve(text, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.live_reserve(text, integer, integer, integer, integer)
  to service_role;
