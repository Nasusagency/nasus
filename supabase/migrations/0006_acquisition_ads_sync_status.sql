alter table public.acquisition_campaign_metrics
  add column if not exists synced_at timestamptz;

update public.acquisition_campaign_metrics
set synced_at = updated_at
where source_type = 'synced' and synced_at is null;

create table if not exists public.acquisition_ads_sync_status (
  platform text primary key,
  status text not null default 'pending' check (status in ('synced', 'error', 'pending')),
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error_code text,
  updated_at timestamptz not null default now()
);

alter table public.acquisition_ads_sync_status enable row level security;
-- Sin políticas: sólo service role desde el admin y sincronizadores protegidos.

insert into public.acquisition_ads_sync_status (platform, status, last_success_at, last_attempt_at)
select 'google', 'synced', max(synced_at), max(synced_at)
from public.acquisition_campaign_metrics
where platform = 'google' and source_type = 'synced' and synced_at is not null
having count(*) > 0
on conflict (platform) do nothing;

insert into public.acquisition_ads_sync_status (platform, status)
values ('google', 'pending'), ('chatgpt', 'pending')
on conflict (platform) do nothing;
