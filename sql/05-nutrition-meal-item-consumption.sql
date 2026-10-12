-- Estado de consumo por alimento dentro de cada comida.
-- Ejecutar después de las migraciones 01-04.
alter table public.nutrition_meal_items
  add column if not exists consumed boolean not null default false;

alter table public.nutrition_meal_items
  add column if not exists consumed_at timestamptz;

create index if not exists idx_meal_items_consumed
  on public.nutrition_meal_items(user_id, meal_id, consumed);
