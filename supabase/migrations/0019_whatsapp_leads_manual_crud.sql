-- CRUD manual de leads desde el admin (creación + archivado).
--
-- Se eligió soft-delete (archivar) en vez de borrado físico: whatsapp_leads
-- cascadea a crm_quotes, crm_proposals, crm_payments y crm_activities (ver
-- docs/PROJECT_STATE.md §2). Un delete físico destruiría cotizaciones,
-- propuestas y pagos reales de forma irreversible. Archivar oculta el
-- contacto del listado normal del admin sin perder nada de su historial, y
-- es reversible.

alter table public.whatsapp_leads
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by text;

create index if not exists whatsapp_leads_archived_idx
  on public.whatsapp_leads (archived_at)
  where archived_at is not null;

comment on column public.whatsapp_leads.archived_at is
  'Soft-delete: si no es null, el contacto se oculta del listado normal del admin pero conserva todo su historial (cotizaciones, propuestas, pagos, actividad). Reversible.';
comment on column public.whatsapp_leads.archived_by is
  'Actor (admin) que archivó el contacto.';
