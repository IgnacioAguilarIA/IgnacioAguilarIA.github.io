-- AgendaFICH E32 — postcheck de solo lectura. No modifica datos.
select table_schema, table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='nutrition_preferences' and column_name='weekly_plan_templates';

select c.conname, pg_get_constraintdef(c.oid) as constraint_definition
from pg_constraint c
join pg_class t on t.oid=c.conrelid
join pg_namespace n on n.oid=t.relnamespace
where n.nspname='public' and t.relname='nutrition_preferences'
  and c.conname='nutrition_preferences_weekly_templates_shape_check';

select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='nutrition_preferences';

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename='nutrition_preferences'
order by policyname;
