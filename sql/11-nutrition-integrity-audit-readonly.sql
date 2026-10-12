-- Agenda FICH — auditoría de integridad posterior al diagnóstico de esquema.
-- Solo devuelve metadatos y CONTADORES agregados. No devuelve nombres de alimentos,
-- recetas, IDs de usuarios ni filas personales, y no modifica la base.
-- Exportar el resultado en CSV y revisarlo ANTES de aplicar sql/10.

with requested(table_name) as (
  values
    ('food_catalog'), ('nutrition_meals'), ('nutrition_meal_items'), ('user_foods'),
    ('nutrition_preferences'), ('nutrition_recipes'), ('nutrition_consumption_history')
),
privilege_rows as (
  select 'privileges'::text as section, r.table_name::text as object_name,
    jsonb_build_object(
      'exists', c.oid is not null,
      'anon_select', case when c.oid is not null then has_table_privilege('anon', c.oid, 'select') else false end,
      'authenticated_select', case when c.oid is not null then has_table_privilege('authenticated', c.oid, 'select') else false end,
      'authenticated_insert', case when c.oid is not null then has_table_privilege('authenticated', c.oid, 'insert') else false end,
      'authenticated_update', case when c.oid is not null then has_table_privilege('authenticated', c.oid, 'update') else false end,
      'authenticated_delete', case when c.oid is not null then has_table_privilege('authenticated', c.oid, 'delete') else false end,
      'service_role_select', case when c.oid is not null then has_table_privilege('service_role', c.oid, 'select') else false end,
      'service_role_insert', case when c.oid is not null then has_table_privilege('service_role', c.oid, 'insert') else false end,
      'service_role_update', case when c.oid is not null then has_table_privilege('service_role', c.oid, 'update') else false end,
      'service_role_delete', case when c.oid is not null then has_table_privilege('service_role', c.oid, 'delete') else false end,
      'table_acl', coalesce(c.relacl::text, '(default ACL; expand via aclexplode if needed)')
    ) as details
  from requested r
  left join pg_namespace n on n.nspname='public'
  left join pg_class c on c.relnamespace=n.oid and c.relname=r.table_name and c.relkind in ('r','p')
), integrity_rows as (
  select 'integrity'::text as section, 'nutrition_meal_items.missing_parent'::text as object_name,
    jsonb_build_object('count', count(*)) as details
  from public.nutrition_meal_items i
  where not exists (select 1 from public.nutrition_meals m where m.id::text=i.meal_id)
  union all
  select 'integrity', 'nutrition_meal_items.parent_owned_by_other_account',
    jsonb_build_object('count', count(*))
  from public.nutrition_meal_items i
  where exists (
    select 1 from public.nutrition_meals m
    where m.id::text=i.meal_id and m.user_id <> i.user_id
  )
  union all
  select 'integrity', 'nutrition_meal_items.user_food_owned_by_other_account',
    jsonb_build_object('count', count(*))
  from public.nutrition_meal_items i
  where i.user_food_id is not null and exists (
    select 1 from public.user_foods f
    where f.id=i.user_food_id and f.user_id <> i.user_id
  )
  union all
  select 'integrity', 'nutrition_meal_items.user_food_reference_missing',
    jsonb_build_object('count', count(*))
  from public.nutrition_meal_items i
  where i.user_food_id is not null and not exists (
    select 1 from public.user_foods f where f.id=i.user_food_id
  )
  union all
  select 'integrity', 'nutrition_consumption_history.duplicate_key_count',
    jsonb_build_object('count', count(*))
  from (
    select user_id, meal_item_id, consumed_date
    from public.nutrition_consumption_history
    group by user_id, meal_item_id, consumed_date
    having count(*) > 1
  ) d
), function_rows as (
  select 'functions'::text as section,
    'public.delete_nutrition_meal_and_items(text)'::text as object_name,
    jsonb_build_object(
      'exists', p.oid is not null,
      'security_definer', coalesce(p.prosecdef,false),
      'anon_execute', case when p.oid is not null then has_function_privilege('anon',p.oid,'execute') else false end,
      'authenticated_execute', case when p.oid is not null then has_function_privilege('authenticated',p.oid,'execute') else false end,
      'service_role_execute', case when p.oid is not null then has_function_privilege('service_role',p.oid,'execute') else false end
    ) as details
  from (select to_regprocedure('public.delete_nutrition_meal_and_items(text)') as oid) x
  left join pg_proc p on p.oid=x.oid
), duplicate_policy_rows as (
  select 'policies'::text as section,
    pairs.table_name || '.' || pairs.policy_name as object_name,
    jsonb_build_object(
      'exists', p.policyname is not null,
      'permissive', p.permissive,
      'roles', p.roles,
      'command', p.cmd,
      'using', p.qual,
      'with_check', p.with_check
    ) as details
  from (values
    ('nutrition_meals','nutrition_meals_account_scope_guard'),
    ('nutrition_meals','nutrition_meals_account_scope_restrictive_guard'),
    ('nutrition_meal_items','nutrition_meal_items_account_scope_guard'),
    ('nutrition_meal_items','nutrition_meal_items_account_scope_restrictive_guard'),
    ('user_foods','user_foods_account_scope_guard'),
    ('user_foods','user_foods_account_scope_restrictive_guard'),
    ('nutrition_preferences','nutrition_preferences_account_scope_guard'),
    ('nutrition_preferences','nutrition_preferences_account_scope_restrictive_guard'),
    ('nutrition_meal_items','nutrition_meal_items_user_food_owner_insert_guard'),
    ('nutrition_meal_items','nutrition_meal_items_user_food_owner_update_guard')
  ) as pairs(table_name,policy_name)
  left join pg_policies p on p.schemaname='public' and p.tablename=pairs.table_name and p.policyname=pairs.policy_name
)
select section, object_name, details from privilege_rows
union all select section, object_name, details from integrity_rows
union all select section, object_name, details from function_rows
union all select section, object_name, details from duplicate_policy_rows
order by section, object_name;
