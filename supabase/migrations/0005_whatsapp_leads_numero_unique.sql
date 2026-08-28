-- Un número de WhatsApp representa un solo lead. Este índice también
-- habilita upserts atómicos por numero y evita duplicados por concurrencia.
create unique index if not exists whatsapp_leads_numero_key
  on public.whatsapp_leads (numero);
