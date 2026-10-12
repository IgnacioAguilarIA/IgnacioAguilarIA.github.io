-- Agenda FICH V98 — Etapa 4: recetas e historial de consumo con fecha real.
-- Ejecutar una vez en Supabase SQL Editor después de las migraciones de Alimentación 01 y 05/06.
-- No modifica rutinas, ejercicios ni sus tablas.

create extension if not exists pgcrypto;

create table if not exists public.nutrition_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text not null default '',
  servings numeric not null default 1 check (servings > 0),
  total_weight_g numeric not null default 0 check (total_weight_g >= 0),
  calories_per_100g numeric not null default 0 check (calories_per_100g >= 0),
  protein_per_100g numeric not null default 0 check (protein_per_100g >= 0),
  carbs_per_100g numeric not null default 0 check (carbs_per_100g >= 0),
  fat_per_100g numeric not null default 0 check (fat_per_100g >= 0),
  fiber_per_100g numeric not null default 0 check (fiber_per_100g >= 0),
  ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nutrition_recipes_user_updated_idx
  on public.nutrition_recipes(user_id, updated_at desc);

create table if not exists public.nutrition_consumption_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consumed_date date not null,
  meal_id text not null default '',
  meal_item_id text not null,
  meal_title text not null default 'Comida',
  meal_type text not null default '',
  meal_time text,
  food_name text not null default 'Alimento',
  brand text not null default '',
  quantity numeric not null default 0,
  unit text not null default 'g',
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  item_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint nutrition_consumption_history_once_per_day unique(user_id, meal_item_id, consumed_date)
);

create index if not exists nutrition_consumption_history_user_date_idx
  on public.nutrition_consumption_history(user_id, consumed_date desc);

alter table public.nutrition_recipes enable row level security;
alter table public.nutrition_consumption_history enable row level security;

drop policy if exists "nutrition_recipes_own_select" on public.nutrition_recipes;
create policy "nutrition_recipes_own_select" on public.nutrition_recipes
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "nutrition_recipes_own_insert" on public.nutrition_recipes;
create policy "nutrition_recipes_own_insert" on public.nutrition_recipes
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "nutrition_recipes_own_update" on public.nutrition_recipes;
create policy "nutrition_recipes_own_update" on public.nutrition_recipes
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "nutrition_recipes_own_delete" on public.nutrition_recipes;
create policy "nutrition_recipes_own_delete" on public.nutrition_recipes
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "nutrition_consumption_history_own_select" on public.nutrition_consumption_history;
create policy "nutrition_consumption_history_own_select" on public.nutrition_consumption_history
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "nutrition_consumption_history_own_insert" on public.nutrition_consumption_history;
create policy "nutrition_consumption_history_own_insert" on public.nutrition_consumption_history
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "nutrition_consumption_history_own_update" on public.nutrition_consumption_history;
create policy "nutrition_consumption_history_own_update" on public.nutrition_consumption_history
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "nutrition_consumption_history_own_delete" on public.nutrition_consumption_history;
create policy "nutrition_consumption_history_own_delete" on public.nutrition_consumption_history
  for delete to authenticated using (auth.uid() = user_id);

-- Permisos explícitos para los roles que usan la aplicación.
grant select, insert, update, delete on public.nutrition_recipes to authenticated;
grant select, insert, update, delete on public.nutrition_consumption_history to authenticated;
