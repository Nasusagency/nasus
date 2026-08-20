-- ─────────────────────────────────────────────────────────────────────────────
-- EJECUTAR ESTO EN SUPABASE SQL EDITOR
-- ─────────────────────────────────────────────────────────────────────────────
-- Copia este SQL completo y pégalo en:
-- https://supabase.com/dashboard/project/[project-id]/sql/new
-- ─────────────────────────────────────────────────────────────────────────────

-- Tabla de idempotency keys para Groq Agent v1
-- Garantiza que en Vercel/serverless no se repitan operaciones
create table if not exists public.idempotency_keys (
  key text primary key,
  tool_name text not null,
  result jsonb,
  created_at timestamptz default now() not null,
  expires_at timestamptz default now() + interval '1 hour' not null
);

-- Índice para limpiar automáticamente registros expirados
create index if not exists idempotency_keys_expires_at_idx
  on public.idempotency_keys (expires_at)
  where expires_at > now();

-- RLS: tabla protegida, solo service role accede (backend)
alter table public.idempotency_keys enable row level security;

-- Verificación: consulta esto debe devolver 3 (tabla, índice, RLS habilitado)
select count(*) as verificacion from information_schema.tables
where table_name = 'idempotency_keys' and table_schema = 'public';
