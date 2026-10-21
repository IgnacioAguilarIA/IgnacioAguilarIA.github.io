-- Etapa E3: postcheck de solo lectura. No modifica datos ni ejecuta funciones RPC.
select 'nutrition_pantry_items' as object_name,
       to_regclass('public.nutrition_pantry_items') is not null as exists,
       coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.nutrition_pantry_items')),false) as rls_enabled
union all
select 'nutrition_pantry_movements', to_regclass('public.nutrition_pantry_movements') is not null,
       coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.nutrition_pantry_movements')),false)
union all
select 'nutrition_pantry_consumption_runs', to_regclass('public.nutrition_pantry_consumption_runs') is not null,
       coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.nutrition_pantry_consumption_runs')),false);

select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public' and tablename in (
  'nutrition_pantry_items','nutrition_pantry_movements','nutrition_pantry_consumption_runs'
)
order by tablename, policyname;

select routine_schema, routine_name, privilege_type, grantee
from information_schema.routine_privileges
where routine_schema='public' and routine_name in (
  'nutrition_pantry_record_movement','nutrition_pantry_update_item_details','nutrition_pantry_consume_planned_meal'
)
order by routine_name, grantee, privilege_type;
