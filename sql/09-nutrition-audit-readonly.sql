-- Diagnóstico de solo lectura de las tablas de Alimentación.
-- No lee filas personales ni modifica tablas, datos, permisos o políticas.
-- Ejecutar en Supabase SQL Editor y conservar las filas devueltas para revisar el esquema real.

with requested(table_name) as (
  values
    ('nutrition_meals'),
    ('food_catalog'),
    ('user_foods'),
    ('nutrition_meal_items'),
    ('nutrition_preferences'),
    ('nutrition_recipes'),
    ('nutrition_consumption_history')
),
rls_rows as (
  select
    'rls'::text as section,
    r.table_name::text as object_name,
    jsonb_build_object(
      'exists', c.oid is not null,
      'rls_enabled', coalesce(c.relrowsecurity, false),
      'force_rls', coalesce(c.relforcerowsecurity, false),
      'anon_select_grant', case when c.oid is not null then has_table_privilege('anon', c.oid, 'select') else false end,
      'authenticated_select_grant', case when c.oid is not null then has_table_privilege('authenticated', c.oid, 'select') else false end,
      'authenticated_insert_grant', case when c.oid is not null then has_table_privilege('authenticated', c.oid, 'insert') else false end,
      'authenticated_update_grant', case when c.oid is not null then has_table_privilege('authenticated', c.oid, 'update') else false end,
      'authenticated_delete_grant', case when c.oid is not null then has_table_privilege('authenticated', c.oid, 'delete') else false end
    ) as details
  from requested r
  left join pg_namespace n on n.nspname = 'public'
  left join pg_class c on c.relnamespace = n.oid and c.relname = r.table_name and c.relkind in ('r','p')
), column_rows as (
  select
    'columns'::text as section,
    c.table_name || '.' || c.column_name as object_name,
    jsonb_build_object(
      'data_type', c.data_type,
      'udt_name', c.udt_name,
      'is_nullable', c.is_nullable,
      'column_default', c.column_default
    ) as details
  from information_schema.columns c
  join requested r on r.table_name = c.table_name
  where c.table_schema = 'public'
), policy_rows as (
  select
    'policies'::text as section,
    p.tablename || '.' || p.policyname as object_name,
    jsonb_build_object(
      'permissive', p.permissive,
      'roles', p.roles,
      'command', p.cmd,
      'using', p.qual,
      'with_check', p.with_check
    ) as details
  from pg_policies p
  join requested r on r.table_name = p.tablename
  where p.schemaname = 'public'
), constraint_rows as (
  select
    'constraints'::text as section,
    c.relname || '.' || con.conname as object_name,
    jsonb_build_object(
      'type', con.contype,
      'definition', pg_get_constraintdef(con.oid, true)
    ) as details
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  join requested r on r.table_name = c.relname
  where n.nspname = 'public'
)
select section, object_name, details from rls_rows
union all
select section, object_name, details from column_rows
union all
select section, object_name, details from policy_rows
union all
select section, object_name, details from constraint_rows
order by section, object_name;
