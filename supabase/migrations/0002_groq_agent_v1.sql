-- ─────────────────────────────────────────────────────────────────────────────
-- Groq Agent v1: Leads + Requerimientos
--
-- Tablas mínimas para pipeline de prospectos y persistencia de tickets.
--
-- PRIVACIDAD: Como whatsapp_mensajes, estas tablas guardan PII y contexto.
-- Misma política: RLS activo, SIN políticas, solo service role.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Lead / Prospecto ────────────────────────────────────────────────────────

do $$ begin
  create type public.lead_stage as enum (
    'exploring',
    'opportunity',
    'qualified',
    'high_intent'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.whatsapp_leads (
  id                uuid primary key default gen_random_uuid(),

  -- Identificación
  numero            text not null,
  nombre_contacto   text,

  -- Negocio
  nombre_empresa    text,
  sector            text,

  -- Pipeline
  stage             public.lead_stage default 'exploring'::public.lead_stage not null,

  -- Contexto
  problema_descrito text,
  servicio_probable text,
  resumen           text,
  datos_estructurados jsonb,

  -- Handoff
  requiere_humano   boolean default false not null,
  razon_handoff     text,

  -- Auditoría
  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null,
  ultima_interaccion timestamptz default now() not null
);

create index if not exists whatsapp_leads_numero_idx
  on public.whatsapp_leads (numero);

create index if not exists whatsapp_leads_stage_idx
  on public.whatsapp_leads (stage);

create index if not exists whatsapp_leads_requiere_humano_idx
  on public.whatsapp_leads (requiere_humano)
  where requiere_humano = true;

alter table public.whatsapp_leads enable row level security;

-- ─── Requerimiento / Ticket ───────────────────────────────────────────────────

do $$ begin
  create type public.requerimiento_tipo as enum (
    'ajuste',
    'nuevo_feature',
    'problema',
    'consulta'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.requerimiento_prioridad as enum (
    'baja',
    'media',
    'alta'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.requerimiento_estado as enum (
    'abierto',
    'en_revision',
    'asignado',
    'resuelto',
    'rechazado'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.whatsapp_requerimientos (
  id                   uuid primary key default gen_random_uuid(),

  -- Identificación
  numero_contacto      text not null,
  cliente_slug         text,
  proyecto             text,

  -- Contenido
  tipo                 public.requerimiento_tipo not null,
  descripcion_original text not null,
  resumen              text,
  seccion_o_pagina     text,

  -- Clasificación
  prioridad            public.requerimiento_prioridad default 'media'::public.requerimiento_prioridad not null,
  estado               public.requerimiento_estado default 'abierto'::public.requerimiento_estado not null,

  -- Relación a conversación
  conversation_id      uuid,
  tiene_imagen         boolean default false,
  url_imagen           text,

  -- Contexto
  datos_adicionales    jsonb,
  razon_deteccion      text,

  -- Auditoría
  created_at           timestamptz default now() not null,
  updated_at           timestamptz default now() not null
);

create index if not exists whatsapp_requerimientos_numero_idx
  on public.whatsapp_requerimientos (numero_contacto);

create index if not exists whatsapp_requerimientos_cliente_idx
  on public.whatsapp_requerimientos (cliente_slug)
  where cliente_slug is not null;

create index if not exists whatsapp_requerimientos_estado_idx
  on public.whatsapp_requerimientos (estado);

create index if not exists whatsapp_requerimientos_prioridad_idx
  on public.whatsapp_requerimientos (prioridad);

alter table public.whatsapp_requerimientos enable row level security;

-- ─── Extensión a whatsapp_clientes para contexto vivo ──────────────────────

alter table if exists public.whatsapp_clientes
  add column if not exists resumen_vivo text,
  add column if not exists datos_estructurados jsonb,
  add column if not exists ultima_actualizacion_automatica timestamptz;
