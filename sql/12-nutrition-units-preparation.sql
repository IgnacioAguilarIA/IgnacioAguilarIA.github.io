-- Agenda FICH — Etapa B2: unidades, equivalencias explícitas y estado de preparación.
-- Migración aditiva e idempotente. No elimina ni modifica nutrientes históricos.
-- Ejecutar en Supabase SQL Editor ANTES de publicar los archivos de esta etapa.

begin;

alter table public.food_catalog
  add column if not exists preparation_state text not null default 'unspecified',
  add column if not exists density_g_per_ml numeric,
  add column if not exists grams_per_unit numeric,
  add column if not exists grams_per_portion numeric;

alter table public.user_foods
  add column if not exists preparation_state text not null default 'unspecified',
  add column if not exists density_g_per_ml numeric,
  add column if not exists grams_per_unit numeric,
  add column if not exists grams_per_portion numeric;

alter table public.nutrition_meal_items
  add column if not exists quantity_in_grams numeric,
  add column if not exists preparation_state text not null default 'unspecified',
  add column if not exists density_g_per_ml numeric,
  add column if not exists grams_per_unit numeric,
  add column if not exists grams_per_portion numeric;

alter table public.nutrition_recipes
  add column if not exists finished_weight_g numeric;

-- Constraints se agregan de forma segura si todavía no existen.
do $constraints$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.food_catalog'::regclass and conname='food_catalog_preparation_state_check') then
    alter table public.food_catalog add constraint food_catalog_preparation_state_check
      check (preparation_state in ('unspecified','raw','cooked','prepared'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.user_foods'::regclass and conname='user_foods_preparation_state_check') then
    alter table public.user_foods add constraint user_foods_preparation_state_check
      check (preparation_state in ('unspecified','raw','cooked','prepared'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.nutrition_meal_items'::regclass and conname='nutrition_meal_items_preparation_state_check') then
    alter table public.nutrition_meal_items add constraint nutrition_meal_items_preparation_state_check
      check (preparation_state in ('unspecified','raw','cooked','prepared'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.food_catalog'::regclass and conname='food_catalog_density_positive_check') then
    alter table public.food_catalog add constraint food_catalog_density_positive_check
      check (density_g_per_ml is null or density_g_per_ml > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.user_foods'::regclass and conname='user_foods_density_positive_check') then
    alter table public.user_foods add constraint user_foods_density_positive_check
      check (density_g_per_ml is null or density_g_per_ml > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.nutrition_meal_items'::regclass and conname='nutrition_meal_items_density_positive_check') then
    alter table public.nutrition_meal_items add constraint nutrition_meal_items_density_positive_check
      check (density_g_per_ml is null or density_g_per_ml > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.food_catalog'::regclass and conname='food_catalog_grams_per_unit_positive_check') then
    alter table public.food_catalog add constraint food_catalog_grams_per_unit_positive_check
      check (grams_per_unit is null or grams_per_unit > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.food_catalog'::regclass and conname='food_catalog_grams_per_portion_positive_check') then
    alter table public.food_catalog add constraint food_catalog_grams_per_portion_positive_check
      check (grams_per_portion is null or grams_per_portion > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.user_foods'::regclass and conname='user_foods_grams_per_unit_positive_check') then
    alter table public.user_foods add constraint user_foods_grams_per_unit_positive_check
      check (grams_per_unit is null or grams_per_unit > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.user_foods'::regclass and conname='user_foods_grams_per_portion_positive_check') then
    alter table public.user_foods add constraint user_foods_grams_per_portion_positive_check
      check (grams_per_portion is null or grams_per_portion > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.nutrition_meal_items'::regclass and conname='nutrition_meal_items_grams_per_unit_positive_check') then
    alter table public.nutrition_meal_items add constraint nutrition_meal_items_grams_per_unit_positive_check
      check (grams_per_unit is null or grams_per_unit > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.nutrition_meal_items'::regclass and conname='nutrition_meal_items_grams_per_portion_positive_check') then
    alter table public.nutrition_meal_items add constraint nutrition_meal_items_grams_per_portion_positive_check
      check (grams_per_portion is null or grams_per_portion > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.nutrition_meal_items'::regclass and conname='nutrition_meal_items_quantity_in_grams_check') then
    alter table public.nutrition_meal_items add constraint nutrition_meal_items_quantity_in_grams_check
      check (quantity_in_grams is null or quantity_in_grams >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.nutrition_recipes'::regclass and conname='nutrition_recipes_finished_weight_positive_check') then
    alter table public.nutrition_recipes add constraint nutrition_recipes_finished_weight_positive_check
      check (finished_weight_g is null or finished_weight_g > 0);
  end if;
end;
$constraints$;

-- No se copian conversiones actuales del catálogo a comidas históricas: eso
-- podría reinterpretar un registro antiguo usando metadatos editados después.
-- Solo se backfillea quantity_in_grams a partir de datos presentes en la propia
-- fila histórica, sin consultar el estado actual de food_catalog/user_foods.

-- Backfill solo conversiones conocidas: cantidades en gramos, o con factores
-- explícitos. Nunca se asume que 1 ml pesa 1 g.
update public.nutrition_meal_items
set quantity_in_grams = case
  when lower(trim(coalesce(unit,'g'))) in ('g','gram','grams','gramo','gramos') then greatest(0,quantity)
  when lower(trim(coalesce(unit,''))) in ('ml','milliliter','milliliters','mililitro','mililitros') and density_g_per_ml > 0 then greatest(0,quantity) * density_g_per_ml
  when lower(trim(coalesce(unit,''))) in ('unit','units','unidad','unidades','piece','pieces','pieza','piezas') and grams_per_unit > 0 then greatest(0,quantity) * grams_per_unit
  when lower(trim(coalesce(unit,''))) in ('portion','portions','porción','porciones','porcion','racion','raciones') and grams_per_portion > 0 then greatest(0,quantity) * grams_per_portion
  else null end
where quantity_in_grams is null;

comment on column public.food_catalog.preparation_state is 'Estado al que corresponden los valores nutricionales: unspecified, raw, cooked o prepared.';
comment on column public.food_catalog.density_g_per_ml is 'Densidad explícita en g/ml; NULL significa que no hay conversión fiable.';
comment on column public.food_catalog.grams_per_unit is 'Peso en gramos de una unidad individual; NULL significa desconocido.';
comment on column public.food_catalog.grams_per_portion is 'Peso en gramos de una porción habitual; NULL significa desconocido.';
comment on column public.user_foods.preparation_state is 'Estado del alimento al que corresponden los valores nutricionales.';
comment on column public.user_foods.density_g_per_ml is 'Densidad explícita en g/ml; NULL significa que no hay conversión fiable.';
comment on column public.user_foods.grams_per_unit is 'Peso en gramos de una unidad individual; NULL significa desconocido.';
comment on column public.user_foods.grams_per_portion is 'Peso en gramos de una porción habitual; NULL significa desconocido.';
comment on column public.nutrition_meal_items.grams_per_portion is 'Peso en gramos de una porción habitual; NULL significa desconocido.';
comment on column public.nutrition_meal_items.quantity_in_grams is 'Equivalencia calculada al guardar; NULL cuando no se puede convertir de manera fiable.';
comment on column public.nutrition_meal_items.preparation_state is 'Estado del alimento al registrar esta comida.';
comment on column public.nutrition_recipes.finished_weight_g is 'Peso final preparado medido manualmente; NULL usa el peso estimado por suma de ingredientes.';

commit;
