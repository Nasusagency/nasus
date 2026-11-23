-- La tabla nació como guia_visitas; se renombra con el prefijo laberinto_
-- acordado para todas las tablas del experimento (doc. de contexto v0.2).
-- Idempotente: en una base nueva 0023 ya la crea como laberinto_visitas.
do $$
begin
  if to_regclass('public.guia_visitas') is not null then
    alter table public.guia_visitas rename to laberinto_visitas;
    alter index if exists public.guia_visitas_ts_idx rename to laberinto_visitas_ts_idx;
    alter index if exists public.guia_visitas_origen_ts_idx rename to laberinto_visitas_origen_ts_idx;
  end if;
end $$;
revoke all on table public.laberinto_visitas from anon, authenticated;
