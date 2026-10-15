-- Agenda FICH D5: plan de comidas por semana calendario, separado de la rutina recurrente.
-- No modifica ni migra registros existentes. Ejecutar una vez en Supabase SQL Editor.
begin;
-- En D4 la tabla existe; esta columna distingue cantidad desconocida de cero real.
alter table public.nutrition_shopping_items
  add column if not exists quantity_known boolean not null default true;

create table if not exists public.nutrition_weekly_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  day_offset smallint not null check (day_offset between 0 and 6),
  meal_type text not null check (meal_type in ('desayuno','media_manana','almuerzo','merienda','cena','colacion')),
  title text not null check (length(btrim(title)) between 1 and 160),
  planned_time text null check (planned_time is null or planned_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  notes text not null default '' check (length(notes) <= 2000),
  source_meal_id uuid null references public.nutrition_meals(id) on delete set null,
  plan_key text not null check (length(btrim(plan_key)) between 1 and 600),
  sort_order integer not null default 0,
  ingredients_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients_snapshot) = 'array'),
  nutrition_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(nutrition_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_weekly_plan_user_week_key unique (user_id, week_start, plan_key)
);
create index if not exists nutrition_weekly_plan_user_week_day_idx
  on public.nutrition_weekly_plan_items (user_id, week_start, day_offset, planned_time, sort_order);
alter table public.nutrition_weekly_plan_items enable row level security;
revoke all privileges on table public.nutrition_weekly_plan_items from public, anon, authenticated;
grant select, insert, update, delete on table public.nutrition_weekly_plan_items to authenticated;
grant all privileges on table public.nutrition_weekly_plan_items to service_role;
drop policy if exists nutrition_weekly_plan_items_account_scope on public.nutrition_weekly_plan_items;
create policy nutrition_weekly_plan_items_account_scope
  on public.nutrition_weekly_plan_items as permissive for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (source_meal_id is null or exists (
      select 1 from public.nutrition_meals m
      where m.id = source_meal_id and m.user_id = auth.uid()
    ))
  );
commit;
