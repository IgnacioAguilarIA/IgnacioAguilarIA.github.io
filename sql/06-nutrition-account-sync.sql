-- Agenda FICH V98 — Etapa 3: preferencias nutricionales sincronizadas y aislamiento por cuenta.
-- Ejecutar en Supabase SQL Editor después de 01 y con la tabla base nutrition_meals ya existente.
-- Esta migración crea nutrition_preferences si falta, por lo que no depende de haber ejecutado 04 primero.
-- No crea ni modifica tablas de Entrenamiento.

-- Crear la tabla de preferencias si todavía no existe (era creada por la migración 04).
create table if not exists public.nutrition_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  meal_order text[] not null default array['pre','post','lunch','snack','dinner','sleep']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_preferences_meal_order_length check (cardinality(meal_order)=6)
);

create or replace function public.touch_nutrition_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_nutrition_preferences_updated_at on public.nutrition_preferences;
create trigger trg_nutrition_preferences_updated_at
before update on public.nutrition_preferences
for each row execute function public.touch_nutrition_preferences_updated_at();

-- Políticas permisivas para que cada usuario gestione su propia fila. Se mantienen
-- junto con las políticas restrictivas de abajo; RLS requiere ambas clases.
alter table public.nutrition_preferences enable row level security;

drop policy if exists "nutrition_preferences_own_select" on public.nutrition_preferences;
create policy "nutrition_preferences_own_select"
on public.nutrition_preferences for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "nutrition_preferences_own_insert" on public.nutrition_preferences;
create policy "nutrition_preferences_own_insert"
on public.nutrition_preferences for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "nutrition_preferences_own_update" on public.nutrition_preferences;
create policy "nutrition_preferences_own_update"
on public.nutrition_preferences for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "nutrition_preferences_own_delete" on public.nutrition_preferences;
create policy "nutrition_preferences_own_delete"
on public.nutrition_preferences for delete
to authenticated
using (auth.uid() = user_id);

alter table public.nutrition_preferences
  add column if not exists nutrition_goals jsonb,
  add column if not exists favorite_foods jsonb,
  add column if not exists recent_foods jsonb;

-- También aseguramos las columnas usadas por el selector «Consumir»; si 05 ya se
-- ejecutó, estas instrucciones no cambian nada.
alter table public.nutrition_meal_items
  add column if not exists consumed boolean not null default false;
alter table public.nutrition_meal_items
  add column if not exists consumed_at timestamptz;

-- Las políticas RESTRICTIVE se combinan con las políticas existentes y evitan que
-- una política permisiva anterior habilite leer/modificar datos de otra cuenta.
alter table public.nutrition_meals enable row level security;
alter table public.nutrition_meal_items enable row level security;
alter table public.user_foods enable row level security;
alter table public.nutrition_preferences enable row level security;

drop policy if exists "nutrition_meals_account_scope_guard" on public.nutrition_meals;
create policy "nutrition_meals_account_scope_guard"
on public.nutrition_meals as restrictive for all to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "nutrition_meal_items_account_scope_guard" on public.nutrition_meal_items;
create policy "nutrition_meal_items_account_scope_guard"
on public.nutrition_meal_items as restrictive for all to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_foods_account_scope_guard" on public.user_foods;
create policy "user_foods_account_scope_guard"
on public.user_foods as restrictive for all to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "nutrition_preferences_account_scope_guard" on public.nutrition_preferences;
create policy "nutrition_preferences_account_scope_guard"
on public.nutrition_preferences as restrictive for all to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
