-- Agenda FICH — Etapa A2: correcciones ajustadas al diagnóstico real de Supabase.
-- No modifica filas ni fuerza RLS para propietarios. Ajusta privilegios de tabla,
-- elimina exclusivamente cuatro policies restrictivas redundantes verificadas y
-- evita nuevos vínculos de alimentos personalizados entre cuentas.
-- Ejecutar SOLO después de revisar 11-nutrition-integrity-audit-readonly.sql.

begin;

do $preflight$
declare
  t text;
  v_cmd text;
  missing text[] := array[]::text[];
  pair record;
  mismatch boolean;
begin
  foreach t in array array[
    'food_catalog',
    'nutrition_meals',
    'nutrition_meal_items',
    'user_foods',
    'nutrition_preferences',
    'nutrition_recipes',
    'nutrition_consumption_history'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      missing := array_append(missing, 'public.' || t);
    end if;
  end loop;
  if cardinality(missing) > 0 then
    raise exception 'No se aplicó la Etapa A2. Faltan tablas: %.', array_to_string(missing, ', ');
  end if;

  select array_agg(v.table_name || '.' || v.column_name order by v.table_name, v.column_name)
    into missing
  from (values
    ('nutrition_meals','id'), ('nutrition_meals','user_id'),
    ('nutrition_meal_items','meal_id'), ('nutrition_meal_items','user_id'), ('nutrition_meal_items','user_food_id'),
    ('user_foods','id'), ('user_foods','user_id'),
    ('nutrition_preferences','user_id'), ('nutrition_recipes','user_id'),
    ('nutrition_consumption_history','user_id')
  ) as v(table_name,column_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name=v.table_name and c.column_name=v.column_name
  );
  if cardinality(missing) > 0 then
    raise exception 'No se aplicó la Etapa A2. Faltan columnas: %.', array_to_string(missing, ', ');
  end if;

  foreach t in array array[
    'food_catalog','nutrition_meals','nutrition_meal_items','user_foods',
    'nutrition_preferences','nutrition_recipes','nutrition_consumption_history'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=t and c.relrowsecurity
    ) then
      raise exception 'No se aplicó la Etapa A2: RLS no está habilitado en public.%.', t;
    end if;
    -- food_catalog es deliberadamente de solo lectura para authenticated.
    -- Las seis tablas con datos por cuenta sí deben tener policies CRUD.
    if t <> 'food_catalog' then
      foreach v_cmd in array array['SELECT','INSERT','UPDATE','DELETE'] loop
        if not exists (
          select 1 from pg_policies p
          where p.schemaname='public' and p.tablename=t and p.permissive='PERMISSIVE'
            and p.cmd in (v_cmd, 'ALL')
            and ('authenticated' = any(p.roles) or 'public' = any(p.roles))
        ) then
          raise exception 'No se aplicó la Etapa A2: falta una policy permisiva para % en public.%.', v_cmd, t;
        end if;
      end loop;
    end if;
  end loop;

  if not exists (
    select 1 from pg_policies p
    where p.schemaname='public' and p.tablename='food_catalog'
      and p.permissive='PERMISSIVE' and p.cmd in ('SELECT','ALL')
      and 'authenticated' = any(p.roles)
  ) then
    raise exception 'No se aplicó la Etapa A2: falta la policy de lectura autenticada de food_catalog.';
  end if;

  -- Confirmar explícitamente las seis guardas canónicas de aislamiento.
  foreach t in array array[
    'nutrition_meals','nutrition_meal_items','user_foods',
    'nutrition_preferences','nutrition_recipes','nutrition_consumption_history'
  ] loop
    if not exists (
      select 1 from pg_policies p
      where p.schemaname='public' and p.tablename=t
        and p.policyname=(t || '_account_scope_restrictive_guard')
        and p.permissive='RESTRICTIVE' and p.cmd='ALL'
        and 'public' = any(p.roles)
        and p.qual='(auth.uid() = user_id)'
        and p.with_check='(auth.uid() = user_id)'
    ) then
      raise exception 'No se aplicó la Etapa A2: falta o no coincide la guarda canónica de aislamiento para public.%.', t;
    end if;
  end loop;

  if to_regprocedure('public.delete_nutrition_meal_and_items(text)') is null then
    raise exception 'No se aplicó la Etapa A2: falta public.delete_nutrition_meal_and_items(text). Verificá la migración 08 antes de continuar.';
  end if;

  -- Solo se retirarán guards viejos si la policy canónica existe y es idéntica.
  for pair in
    select * from (values
      ('nutrition_meals','nutrition_meals_account_scope_guard','nutrition_meals_account_scope_restrictive_guard'),
      ('nutrition_meal_items','nutrition_meal_items_account_scope_guard','nutrition_meal_items_account_scope_restrictive_guard'),
      ('user_foods','user_foods_account_scope_guard','user_foods_account_scope_restrictive_guard'),
      ('nutrition_preferences','nutrition_preferences_account_scope_guard','nutrition_preferences_account_scope_restrictive_guard')
    ) as x(table_name, old_name, canonical_name)
  loop
    if exists (
      select 1 from pg_policies p
      where p.schemaname='public' and p.tablename=pair.table_name and p.policyname=pair.old_name
    ) then
      select exists (
        select 1
        from pg_policies d
        where d.schemaname='public' and d.tablename=pair.table_name and d.policyname=pair.old_name
          and not exists (
            select 1 from pg_policies c
            where c.schemaname='public' and c.tablename=pair.table_name and c.policyname=pair.canonical_name
              and c.permissive=d.permissive and c.cmd=d.cmd and c.roles=d.roles
              and c.qual is not distinct from d.qual
              and c.with_check is not distinct from d.with_check
              and c.permissive='RESTRICTIVE' and c.cmd='ALL'
          )
      ) into mismatch;
      if mismatch then
        raise exception 'No se aplicó la Etapa A2: la policy %.% no coincide exactamente con su equivalente %. No se modifica esa policy.', pair.table_name, pair.old_name, pair.canonical_name;
      end if;
    end if;
  end loop;
end;
$preflight$;

-- Quitar privilegios de anon y PUBLIC reduce el acceso a nivel de tabla.
-- Los permisos siguen sujetos a RLS. service_role conserva acceso explícito para
-- tareas administrativas del servidor; nunca debe exponerse su clave en el cliente.
revoke all privileges on table public.food_catalog from public, anon, authenticated;
grant select on table public.food_catalog to authenticated;
grant select on table public.food_catalog to service_role;

revoke all privileges on table public.nutrition_meals from public, anon;
revoke all privileges on table public.nutrition_meal_items from public, anon;
revoke all privileges on table public.user_foods from public, anon;
revoke all privileges on table public.nutrition_preferences from public, anon;
revoke all privileges on table public.nutrition_recipes from public, anon;
revoke all privileges on table public.nutrition_consumption_history from public, anon;

grant select, insert, update, delete on table
  public.nutrition_meals,
  public.nutrition_meal_items,
  public.user_foods,
  public.nutrition_preferences,
  public.nutrition_recipes,
  public.nutrition_consumption_history
  to authenticated;

grant all privileges on table
  public.nutrition_meals,
  public.nutrition_meal_items,
  public.user_foods,
  public.nutrition_preferences,
  public.nutrition_recipes,
  public.nutrition_consumption_history
  to service_role;

-- Limpiar solo policies duplicadas con equivalencia exacta ya verificada arriba.
drop policy if exists "nutrition_meals_account_scope_guard" on public.nutrition_meals;
drop policy if exists "nutrition_meal_items_account_scope_guard" on public.nutrition_meal_items;
drop policy if exists "user_foods_account_scope_guard" on public.user_foods;
drop policy if exists "nutrition_preferences_account_scope_guard" on public.nutrition_preferences;

-- La FK existente garantiza que user_food_id exista, pero no que pertenezca
-- a la misma cuenta que el detalle de comida. Estas policies verifican propiedad
-- para los INSERT/UPDATE nuevos, sin modificar filas antiguas.
drop policy if exists "nutrition_meal_items_user_food_owner_insert_guard" on public.nutrition_meal_items;
create policy "nutrition_meal_items_user_food_owner_insert_guard"
on public.nutrition_meal_items as restrictive for insert to authenticated
with check (
  auth.uid() = user_id
  and (
    user_food_id is null
    or exists (
      select 1 from public.user_foods f
      where f.id = nutrition_meal_items.user_food_id
        and f.user_id = auth.uid()
    )
  )
);

drop policy if exists "nutrition_meal_items_user_food_owner_update_guard" on public.nutrition_meal_items;
create policy "nutrition_meal_items_user_food_owner_update_guard"
on public.nutrition_meal_items as restrictive for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    user_food_id is null
    or exists (
      select 1 from public.user_foods f
      where f.id = nutrition_meal_items.user_food_id
        and f.user_id = auth.uid()
    )
  )
);

revoke all privileges on function public.delete_nutrition_meal_and_items(text) from public, anon;
grant execute on function public.delete_nutrition_meal_and_items(text) to authenticated;
grant execute on function public.delete_nutrition_meal_and_items(text) to service_role;

commit;
