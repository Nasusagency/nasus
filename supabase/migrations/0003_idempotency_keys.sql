-- ─────────────────────────────────────────────────────────────────────────────
-- Idempotency Keys para Groq Agent v1
--
-- Tabla mínima para garantizar idempotencia en Vercel/serverless.
-- Sobrevive reinicios e instancias múltiples.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.idempotency_keys (
  key text primary key,
  tool_name text not null,
  result jsonb,
  created_at timestamptz default now() not null,
  expires_at timestamptz default now() + interval '1 hour' not null
);

create index if not exists idempotency_keys_expires_at_idx
  on public.idempotency_keys (expires_at)
  where expires_at > now();

alter table public.idempotency_keys enable row level security;

-- Nota: Sin políticas RLS. Solo service role (backend) accede para evitar abuse.
-- No se persisten datos sensibles aquí, solo el resultado (éxito/error).
