-- Agenda FICH — Etapa D7: procedencia y calidad de los datos nutricionales.
-- Migración aditiva e idempotente. No modifica comidas ni historial existentes.
-- Ejecutar en Supabase SQL Editor ANTES de publicar los archivos D7.

begin;

alter table public.food_catalog
  add column if not exists source_url text,
  add column if not exists data_source_label text not null default 'Origen no registrado',
  add column if not exists nutrition_quality_status text not null default 'legacy_unverified',
  add column if not exists nutrition_missing_fields text[] not null default '{}'::text[],
  add column if not exists nutrition_verified_at timestamptz;

alter table public.user_foods
  add column if not exists data_source_label text not null default 'Origen no registrado',
  add column if not exists data_source_url text,
  add column if not exists nutrition_quality_status text not null default 'legacy_unverified',
  add column if not exists nutrition_missing_fields text[] not null default '{}'::text[],
  add column if not exists nutrition_verified_at timestamptz;

alter table public.nutrition_meal_items
  add column if not exists data_source_label text not null default 'Origen no registrado',
  add column if not exists data_source_url text,
  add column if not exists nutrition_quality_status text not null default 'legacy_unverified',
  add column if not exists nutrition_missing_fields text[] not null default '{}'::text[],
  add column if not exists nutrition_verified_at timestamptz;

-- Etiquetar explícitamente la procedencia histórica sin inferir que los valores
-- cero son correctos ni que fueron verificados. Se conservan todas las filas.
update public.food_catalog
set data_source_label = case
      when lower(coalesce(source,'')) like '%open food facts%' or lower(coalesce(source,'')) like '%open_food_facts%' then 'Open Food Facts'
      when lower(coalesce(source,'')) in ('curated','catalog','internal') then 'Catálogo interno'
      else coalesce(nullif(trim(source),''), 'Origen no registrado')
    end
where data_source_label = 'Origen no registrado' and nullif(trim(source),'') is not null;

update public.user_foods
set data_source_label = case
      when lower(coalesce(source,'')) like '%open food facts%' or lower(coalesce(source,'')) like '%open_food_facts%' then 'Open Food Facts'
      when lower(coalesce(source,'')) in ('manual','manual_unverified','user_food') then 'Carga manual'
      else coalesce(nullif(trim(source),''), 'Origen no registrado')
    end
where data_source_label = 'Origen no registrado' and nullif(trim(source),'') is not null;

update public.nutrition_meal_items
set data_source_label = case
      when lower(coalesce(source,'')) like '%open food facts%' or lower(coalesce(source,'')) like '%open_food_facts%' then 'Open Food Facts'
      when lower(coalesce(source,'')) in ('manual','manual_unverified','user_food') then 'Carga manual o alimento propio'
      else coalesce(nullif(trim(source),''), 'Origen no registrado')
    end
where data_source_label = 'Origen no registrado' and nullif(trim(source),'') is not null;

-- Constraints con nombres deterministas para que la migración se pueda repetir.
do $constraints$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.food_catalog'::regclass and conname='food_catalog_nutrition_quality_status_check') then
    alter table public.food_catalog add constraint food_catalog_nutrition_quality_status_check
      check (nutrition_quality_status in ('source_complete','user_verified','manual_unverified','incomplete','legacy_unverified'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.user_foods'::regclass and conname='user_foods_nutrition_quality_status_check') then
    alter table public.user_foods add constraint user_foods_nutrition_quality_status_check
      check (nutrition_quality_status in ('source_complete','user_verified','manual_unverified','incomplete','legacy_unverified'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.nutrition_meal_items'::regclass and conname='nutrition_meal_items_nutrition_quality_status_check') then
    alter table public.nutrition_meal_items add constraint nutrition_meal_items_nutrition_quality_status_check
      check (nutrition_quality_status in ('source_complete','user_verified','manual_unverified','incomplete','legacy_unverified'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.food_catalog'::regclass and conname='food_catalog_source_url_http_check') then
    alter table public.food_catalog add constraint food_catalog_source_url_http_check
      check (source_url is null or source_url ~* '^https?://');
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.user_foods'::regclass and conname='user_foods_data_source_url_http_check') then
    alter table public.user_foods add constraint user_foods_data_source_url_http_check
      check (data_source_url is null or data_source_url ~* '^https?://');
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.nutrition_meal_items'::regclass and conname='nutrition_meal_items_data_source_url_http_check') then
    alter table public.nutrition_meal_items add constraint nutrition_meal_items_data_source_url_http_check
      check (data_source_url is null or data_source_url ~* '^https?://');
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.user_foods'::regclass and conname='user_foods_verified_at_check') then
    alter table public.user_foods add constraint user_foods_verified_at_check
      check (nutrition_quality_status <> 'user_verified' or nutrition_verified_at is not null);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.nutrition_meal_items'::regclass and conname='nutrition_meal_items_verified_at_check') then
    alter table public.nutrition_meal_items add constraint nutrition_meal_items_verified_at_check
      check (nutrition_quality_status <> 'user_verified' or nutrition_verified_at is not null);
  end if;
end;
$constraints$;

comment on column public.food_catalog.data_source_label is 'Etiqueta legible de la procedencia del dato nutricional.';
comment on column public.food_catalog.source_url is 'URL http(s) de la fuente original si se conoce.';
comment on column public.food_catalog.nutrition_quality_status is 'source_complete: campos principales presentes en la fuente; user_verified: revisado por usuario; manual_unverified: carga manual no verificada; incomplete: faltan campos; legacy_unverified: dato antiguo sin trazabilidad confirmada.';
comment on column public.food_catalog.nutrition_missing_fields is 'Nutrientes que la fuente no informó; no deben interpretarse como ceros.';
comment on column public.food_catalog.nutrition_verified_at is 'Momento de confirmación por parte del usuario, si corresponde.';
comment on column public.user_foods.data_source_label is 'Etiqueta legible de la procedencia del dato nutricional.';
comment on column public.user_foods.data_source_url is 'URL http(s) de la fuente original si se conoce.';
comment on column public.user_foods.nutrition_quality_status is 'Calidad y estado de verificación del dato nutricional.';
comment on column public.user_foods.nutrition_missing_fields is 'Nutrientes que la fuente no informó; no deben interpretarse como ceros.';
comment on column public.user_foods.nutrition_verified_at is 'Momento de confirmación de la etiqueta por parte del usuario.';
comment on column public.nutrition_meal_items.data_source_label is 'Procedencia copiada en la instantánea del alimento al guardar la comida.';
comment on column public.nutrition_meal_items.data_source_url is 'URL http(s) copiada desde la fuente original del alimento, si se conoce.';
comment on column public.nutrition_meal_items.nutrition_quality_status is 'Estado de calidad de la instantánea nutricional en el momento de guardar.';
comment on column public.nutrition_meal_items.nutrition_missing_fields is 'Nutrientes no informados por la fuente en el momento de guardar.';
comment on column public.nutrition_meal_items.nutrition_verified_at is 'Momento de verificación de la instantánea, si se confirmó.';

commit;
