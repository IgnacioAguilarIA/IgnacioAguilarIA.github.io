-- Agenda FICH V98 — orden personalizado de comidas por usuario
-- Ejecutar después de 01-nutrition-food-catalog.sql.
-- No modifica ninguna tabla ni lógica de entrenamiento.

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
