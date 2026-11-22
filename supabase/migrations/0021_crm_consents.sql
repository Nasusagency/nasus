-- Permisos de contacto (correo / WhatsApp) para envíos de marketing.
--
-- Registro de solo-alta: cada aceptación o retiro es una fila nueva, nunca se
-- edita ni se borra. Así queda la prueba de QUÉ texto aceptó la persona, CUÁNDO
-- y DESDE DÓNDE (formulario web, correo, admin). El estado vigente de un canal es
-- la fila más reciente de ese contacto + canal (vista crm_consent_status).
--
-- WhatsApp no pide permiso dentro de la conversación: el permiso llega por el
-- formulario o por un correo, y el CRM lo consulta antes de cualquier envío masivo.
--
-- Contiene PII (correo / teléfono): RLS activo y SIN políticas. Solo service role.

create table if not exists public.crm_consents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.whatsapp_leads(id) on delete set null,
  channel text not null check (channel in ('email', 'whatsapp')),
  status text not null check (status in ('granted', 'revoked')),
  -- Destino al que aplica el permiso: correo (minúsculas) o teléfono canónico.
  address text not null check (char_length(address) between 3 and 254),
  source text not null check (source in ('web_form', 'email_campaign', 'admin', 'whatsapp')),
  -- Texto exacto que vio la persona al aceptar (prueba del consentimiento).
  consent_text text,
  campaign text,
  created_at timestamptz not null default now()
);

create index if not exists crm_consents_contact_idx on public.crm_consents (contact_id, channel, created_at desc);
create index if not exists crm_consents_address_idx on public.crm_consents (channel, address, created_at desc);

alter table public.crm_consents enable row level security;

-- Estado vigente por canal + destino: la última decisión gana.
create or replace view public.crm_consent_status
with (security_invoker = true) as
select distinct on (channel, address)
  contact_id, channel, address, status, source, campaign, created_at as decided_at
from public.crm_consents
order by channel, address, created_at desc;

revoke all on public.crm_consents from anon, authenticated;
revoke all on public.crm_consent_status from anon, authenticated;

comment on table public.crm_consents is
  'Registro de solo-alta de permisos de marketing por canal. PII: solo service role (RLS sin políticas).';
