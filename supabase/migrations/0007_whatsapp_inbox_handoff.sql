do $$ begin
  create type public.whatsapp_conversation_mode as enum ('ai', 'human', 'paused');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.whatsapp_conversation_status as enum ('open', 'resolved');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.whatsapp_sender_type as enum ('contact', 'ai', 'human', 'system');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.whatsapp_delivery_status as enum ('received', 'pending', 'sent', 'failed');
exception when duplicate_object then null;
end $$;

create table if not exists public.whatsapp_conversations (
  conversation_id uuid primary key,
  numero text not null,
  mode public.whatsapp_conversation_mode not null default 'ai',
  status public.whatsapp_conversation_status not null default 'open',
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_conversations_numero_idx
  on public.whatsapp_conversations (numero, updated_at desc);
create index if not exists whatsapp_conversations_inbox_idx
  on public.whatsapp_conversations (status, mode, updated_at desc);
alter table public.whatsapp_conversations enable row level security;

alter table public.whatsapp_mensajes
  add column if not exists sender_type public.whatsapp_sender_type,
  add column if not exists admin_actor text,
  add column if not exists delivery_status public.whatsapp_delivery_status;

update public.whatsapp_mensajes
set sender_type = case when direccion = 'entrante' then 'contact'::public.whatsapp_sender_type else 'ai'::public.whatsapp_sender_type end
where sender_type is null;

update public.whatsapp_mensajes
set delivery_status = case when direccion = 'entrante' then 'received'::public.whatsapp_delivery_status else 'sent'::public.whatsapp_delivery_status end
where delivery_status is null;

alter table public.whatsapp_mensajes
  alter column sender_type set not null,
  alter column delivery_status set not null,
  alter column sender_type set default 'contact'::public.whatsapp_sender_type,
  alter column delivery_status set default 'received'::public.whatsapp_delivery_status;

insert into public.whatsapp_conversations (conversation_id, numero, created_at, updated_at)
select conversation_id, min(numero), min(created_at), max(created_at)
from public.whatsapp_mensajes
group by conversation_id
on conflict (conversation_id) do nothing;

