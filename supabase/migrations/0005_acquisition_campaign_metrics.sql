-- Captura manual hoy; misma capa para sincronización oficial futura.
create table if not exists public.acquisition_campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  campaign text not null,
  metric_date date not null,
  impressions bigint check (impressions is null or impressions >= 0),
  ad_clicks bigint check (ad_clicks is null or ad_clicks >= 0),
  spend numeric(14,2) check (spend is null or spend >= 0),
  currency text not null default 'MXN' check (currency ~ '^[A-Z]{3}$'),
  daily_budget numeric(14,2) check (daily_budget is null or daily_budget >= 0),
  total_budget numeric(14,2) check (total_budget is null or total_budget >= 0),
  source_type text not null default 'manual' check (source_type in ('manual', 'synced')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, campaign, metric_date, source_type)
);
create index if not exists acquisition_campaign_metrics_date_idx on public.acquisition_campaign_metrics (metric_date desc);
create index if not exists acquisition_campaign_metrics_campaign_idx on public.acquisition_campaign_metrics (platform, campaign, metric_date desc);
alter table public.acquisition_campaign_metrics enable row level security;
-- Sin políticas: sólo service role desde endpoints admin autenticados o sincronizadores server-side.
