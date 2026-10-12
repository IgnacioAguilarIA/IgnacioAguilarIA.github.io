-- Agenda FICH — Endurecimiento de producción de Alimentación.
-- Ejecutar SOLO después de revisar 09-nutrition-audit-readonly.sql y confirmar
-- que las migraciones de Alimentación 01, 06 y 07 ya están aplicadas.
-- Solo actualiza RLS/policies; no modifica filas ni borra datos.

begin;

do $$
declare
  missing_tables text[] := array[]::text[];
  missing_permissive text[] := array[]::text[];
  missing_columns text[] := array[]::text[];
  t text;
begin
  foreach t in array array[
    'nutrition_meals',
    'user_foods',
    'nutrition_meal_items',
    'nutrition_preferences',
    'nutrition_recipes',
    'nutrition_consumption_history'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      missing_tables := array_append(missing_tables, t);
    end if;
  end loop;
  if cardinality(missing_tables) > 0 then
    raise exception 'No se aplicó el endurecimiento de Alimentación. Faltan tablas: %. Revisá primero 09-nutrition-audit-readonly.sql y las migraciones 01/05/06/07.', array_to_string(missing_tables, ', ');
  end if;

  select array_agg(required.table_name || '.' || required.column_name order by required.table_name, required.column_name)
    into missing_columns
  from (values
    ('nutrition_meals', 'id'),
    ('nutrition_meals', 'user_id'),
    ('nutrition_meal_items', 'meal_id'),
    ('nutrition_meal_items', 'user_id'),
    ('nutrition_meal_items', 'consumed'),
    ('nutrition_meal_items', 'consumed_at'),
    ('user_foods', 'user_id'),
    ('nutrition_preferences', 'user_id'),
    ('nutrition_recipes', 'user_id'),
    ('nutrition_consumption_history', 'user_id')
  ) as required(table_name, column_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = required.table_name
      and c.column_name = required.column_name
  );

  if cardinality(missing_columns) > 0 then
    raise exception 'No se aplicó el endurecimiento de Alimentación. Faltan columnas requeridas: %. Revisá las migraciones 01/05/06/07.', array_to_string(missing_columns, ', ');
  end if;

  -- Una policy RESTRICTIVE no concede permisos por sí misma. Verificamos que las
  -- migraciones base hayan dejado al menos una policy PERMISSIVE por tabla, para
  -- evitar bloquear por completo el acceso al reemplazar nombres equivocados.
  select array_agg(required.table_name order by required.table_name)
    into missing_permissive
  from unnest(array[
    'nutrition_meals',
    'user_foods',
    'nutrition_meal_items',
    'nutrition_preferences',
    'nutrition_recipes',
    'nutrition_consumption_history'
  ]) as required(table_name)
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = required.table_name
      and p.permissive = 'PERMISSIVE'
  );

  if cardinality(missing_permissive) > 0 then
    raise exception 'No se aplicó el endurecimiento de Alimentación. Faltan policies permisivas base en: %. Revisá las migraciones 06/07 antes de continuar.', array_to_string(missing_permissive, ', ');
  end if;
end $$;

alter table public.nutrition_meals enable row level security;
alter table public.user_foods enable row level security;
alter table public.nutrition_meal_items enable row level security;
alter table public.nutrition_preferences enable row level security;
alter table public.nutrition_recipes enable row level security;
alter table public.nutrition_consumption_history enable row level security;

-- RESTRICTIVE se combina con las políticas permisivas existentes y evita que
-- una política amplia anterior permita cruzar los límites de user_id.
drop policy if exists "nutrition_meals_account_scope_restrictive_guard" on public.nutrition_meals;
create policy "nutrition_meals_account_scope_restrictive_guard"
on public.nutrition_meals as restrictive
for all to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_foods_account_scope_restrictive_guard" on public.user_foods;
create policy "user_foods_account_scope_restrictive_guard"
on public.user_foods as restrictive
for all to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "nutrition_meal_items_account_scope_restrictive_guard" on public.nutrition_meal_items;
create policy "nutrition_meal_items_account_scope_restrictive_guard"
on public.nutrition_meal_items as restrictive
for all to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "nutrition_preferences_account_scope_restrictive_guard" on public.nutrition_preferences;
create policy "nutrition_preferences_account_scope_restrictive_guard"
on public.nutrition_preferences as restrictive
for all to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "nutrition_recipes_account_scope_restrictive_guard" on public.nutrition_recipes;
create policy "nutrition_recipes_account_scope_restrictive_guard"
on public.nutrition_recipes as restrictive
for all to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "nutrition_consumption_history_account_scope_restrictive_guard" on public.nutrition_consumption_history;
create policy "nutrition_consumption_history_account_scope_restrictive_guard"
on public.nutrition_consumption_history as restrictive
for all to public
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Además del user_id del detalle, la comida padre debe pertenecer a esa cuenta.
-- La política general de cuenta también limita DELETE; el RPC atómico limpia los
-- detalles antes de borrar la comida padre, sin abrir acceso a filas ajenas.
drop policy if exists "nutrition_meal_items_owned_meal_insert_guard" on public.nutrition_meal_items;
create policy "nutrition_meal_items_owned_meal_insert_guard"
on public.nutrition_meal_items as restrictive
for insert to public
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.nutrition_meals as m
    where m.id::text = nutrition_meal_items.meal_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "nutrition_meal_items_owned_meal_update_guard" on public.nutrition_meal_items;
create policy "nutrition_meal_items_owned_meal_update_guard"
on public.nutrition_meal_items as restrictive
for update to public
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.nutrition_meals as m
    where m.id::text = nutrition_meal_items.meal_id
      and m.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.nutrition_meals as m
    where m.id::text = nutrition_meal_items.meal_id
      and m.user_id = auth.uid()
  )
);

-- Eliminación atómica de una comida y sus detalles. Si alguna sentencia falla,
-- Postgres revierte ambas dentro de la transacción del RPC. Se ejecuta como el
-- usuario autenticado para que continúen aplicándose las políticas RLS.
create or replace function public.delete_nutrition_meal_and_items(p_meal_id text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Se requiere una sesión autenticada para eliminar una comida.';
  end if;

  if not exists (
    select 1
    from public.nutrition_meals as m
    where m.id::text = p_meal_id
      and m.user_id = v_user_id
  ) then
    return false;
  end if;

  delete from public.nutrition_meal_items as i
  where i.meal_id = p_meal_id
    and i.user_id = v_user_id;

  delete from public.nutrition_meals as m
  where m.id::text = p_meal_id
    and m.user_id = v_user_id;
  get diagnostics v_deleted = row_count;

  return v_deleted = 1;
end;
$function$;

revoke all on function public.delete_nutrition_meal_and_items(text) from public;
grant execute on function public.delete_nutrition_meal_and_items(text) to authenticated;

commit;
