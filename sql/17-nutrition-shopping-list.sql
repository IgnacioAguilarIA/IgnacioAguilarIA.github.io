-- Agenda FICH — Etapa D4: lista de compras por usuario y semana.
-- Agrega una tabla nueva; no modifica comidas, alimentos ni historial existente.
-- Ejecutar una vez en Supabase SQL Editor después de revisar el comentario de seguridad.

begin;

create table if not exists public.nutrition_shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  item_key text not null check (length(btrim(item_key)) between 1 and 600),
  name text not null check (length(btrim(name)) between 1 and 240),
  brand text not null default '',
  quantity numeric(12,3) not null default 1 check (quantity >= 0 and quantity <= 1000000),
  unit text not null default 'unit' check (length(btrim(unit)) between 1 and 32),
  preparation_state text not null default 'unspecified' check (preparation_state in ('raw','cooked','prepared','unspecified')),
  category text not null default 'Otros' check (length(btrim(category)) between 1 and 80),
  checked boolean not null default false,
  source text not null default 'manual' check (source in ('generated','manual')),
  source_meals text[] not null default array[]::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_shopping_items_user_week_key unique (user_id, week_start, item_key)
);

create index if not exists nutrition_shopping_items_user_week_active_idx
  on public.nutrition_shopping_items (user_id, week_start, active, checked, category);

alter table public.nutrition_shopping_items enable row level security;

-- Privilegios mínimos: solo operaciones CRUD autenticadas; ningún acceso de anon/PUBLIC.
revoke all privileges on table public.nutrition_shopping_items from public, anon, authenticated;
grant select, insert, update, delete on table public.nutrition_shopping_items to authenticated;
grant all privileges on table public.nutrition_shopping_items to service_role;

-- Reejecutable sin duplicar la policy.
drop policy if exists nutrition_shopping_items_account_scope on public.nutrition_shopping_items;
create policy nutrition_shopping_items_account_scope
  on public.nutrition_shopping_items
  as permissive
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
