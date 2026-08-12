-- ─────────────────────────────────────────────────────────────────────────────
-- WhatsApp: conversaciones + clientes con contexto de negocio
--
-- Ejecutar en Supabase → SQL Editor. Es idempotente: se puede correr de nuevo.
--
-- PRIVACIDAD: a diferencia del resto del proyecto, estas tablas SÍ guardan
-- contenido de mensajes y números de teléfono. Por eso van con RLS activo y
-- SIN políticas: ni `anon` ni `authenticated` pueden leerlas. El único acceso
-- es con la service role key desde el servidor (la service role salta RLS).
-- Nunca uses la anon key contra estas tablas.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Clientes con contexto de negocio ────────────────────────────────────────
-- Se administra a mano desde el panel de Supabase. Si un número NO está aquí
-- (o está con activo = false), el webhook responde en modo demo genérico.

create table if not exists public.whatsapp_clientes (
  id               uuid primary key default gen_random_uuid(),
  -- Formato de Meta: código de país + número, sin '+' ni espacios. Ej: 523312345678
  numero_whatsapp  text        not null unique,
  nombre_negocio   text        not null,
  contexto_negocio text        not null,
  activo           boolean     not null default true,
  created_at       timestamptz not null default now()
);

-- Solo se buscan los activos, así que el índice los filtra.
create index if not exists whatsapp_clientes_numero_idx
  on public.whatsapp_clientes (numero_whatsapp)
  where activo;

alter table public.whatsapp_clientes enable row level security;

-- ─── Mensajes ────────────────────────────────────────────────────────────────

do $$ begin
  create type public.whatsapp_direccion as enum ('entrante', 'saliente');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.whatsapp_mensajes (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid                       not null,
  numero          text                       not null,
  direccion       public.whatsapp_direccion  not null,
  contenido       text,
  -- Las imágenes no se copian: se guarda el media id de Meta. La URL de
  -- descarga de Graph caduca en minutos y exige el bearer token, así que
  -- guardarla no serviría de nada más tarde.
  media_id        text,
  media_mime      text,
  -- id del mensaje de Meta. Único cuando existe: hace que reintentos de Meta
  -- no dupliquen filas aunque el proceso se haya reiniciado (el dedup en
  -- memoria de rate-limit.ts se pierde entre instancias de Vercel).
  message_id      text,
  created_at      timestamptz                not null default now()
);

create unique index if not exists whatsapp_mensajes_message_id_key
  on public.whatsapp_mensajes (message_id)
  where message_id is not null;

-- Sirve para las dos lecturas del webhook: buscar la conversación abierta del
-- número y traer los últimos mensajes del hilo.
create index if not exists whatsapp_mensajes_numero_fecha_idx
  on public.whatsapp_mensajes (numero, created_at desc);

create index if not exists whatsapp_mensajes_conversacion_idx
  on public.whatsapp_mensajes (conversation_id, created_at);

alter table public.whatsapp_mensajes enable row level security;
