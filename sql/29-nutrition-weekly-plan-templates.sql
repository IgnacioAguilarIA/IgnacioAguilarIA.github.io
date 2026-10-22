-- AgendaFICH E32 — Plantillas semanales guardadas por cuenta.
-- Ejecutar una vez en Supabase SQL Editor después de sql/06-nutrition-account-sync.sql.
-- Añade un campo JSONB pequeño a las preferencias existentes; no modifica filas de comidas ni tablas de Entrenamiento.
begin;
do $$
begin
  if to_regclass('public.nutrition_preferences') is null then
    raise exception 'No existe public.nutrition_preferences. Ejecutá primero sql/06-nutrition-account-sync.sql.';
  end if;
end $$;

alter table public.nutrition_preferences
  add column if not exists weekly_plan_templates jsonb not null default '[]'::jsonb;

alter table public.nutrition_preferences
  drop constraint if exists nutrition_preferences_weekly_templates_shape_check;
alter table public.nutrition_preferences
  add constraint nutrition_preferences_weekly_templates_shape_check
  check (
    case when jsonb_typeof(weekly_plan_templates) = 'array'
      then jsonb_array_length(weekly_plan_templates) <= 12
        and octet_length(weekly_plan_templates::text) <= 245760
      else false end
  );

-- Asegura que las plantillas sigan sometidas a las políticas RLS de la fila de preferencias.
alter table public.nutrition_preferences enable row level security;
commit;
