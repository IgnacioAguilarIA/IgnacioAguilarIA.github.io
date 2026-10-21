-- Agenda FICH — Etapa E4A: postcheck de solo lectura.
-- Ejecutar después de sql/25-nutrition-recipes-advanced.sql.

select 'recipe_columns'::text as check_group, column_name::text as object_name, data_type::text as detail
from information_schema.columns
where table_schema='public' and table_name='nutrition_recipes'
  and column_name in ('instructions','prep_time_minutes','cook_time_minutes','parent_recipe_id')
union all
select 'history_table'::text, table_name::text, 'table exists'::text
from information_schema.tables
where table_schema='public' and table_name='nutrition_recipe_preparation_history'
union all
select 'history_rls'::text, c.relname::text, (case when c.relrowsecurity then 'RLS enabled' else 'RLS DISABLED' end)::text
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='nutrition_recipe_preparation_history'
union all
select 'policy'::text, p.policyname::text, p.cmd::text
from pg_policies p
where p.schemaname='public' and p.tablename='nutrition_recipe_preparation_history'
union all
select 'rpc_execute'::text, routine_name::text, grantee::text
from information_schema.routine_privileges
where specific_schema='public' and routine_name='nutrition_record_recipe_preparation'
  and privilege_type='EXECUTE' and grantee in ('authenticated','anon','PUBLIC','service_role','postgres')
order by check_group, object_name, detail;
