-- Agenda FICH — Auditoría D1 de sincronización (SOLO LECTURA).
-- No cambia tablas, filas, grants, RLS, funciones ni triggers.
-- Ejecutar en Supabase SQL Editor y exportar el resultado como CSV.
-- No incluye datos personales ni el contenido de comidas/recetas.

WITH target_tables AS (
  SELECT unnest(ARRAY[
    'food_catalog',
    'nutrition_meals',
    'nutrition_meal_items',
    'user_foods',
    'nutrition_preferences',
    'nutrition_recipes',
    'nutrition_consumption_history'
  ]::text[]) AS table_name
), audit AS (
  SELECT
    'table_rls'::text AS section,
    'public.' || t.table_name AS object_name,
    jsonb_build_object(
      'exists', c.oid IS NOT NULL,
      'rls_enabled', COALESCE(c.relrowsecurity, false),
      'force_rls', COALESCE(c.relforcerowsecurity, false),
      'relation_kind', c.relkind
    )::text AS details
  FROM target_tables t
  LEFT JOIN pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = t.table_name

  UNION ALL

  SELECT
    'column'::text,
    'public.' || c.table_name || '.' || c.column_name,
    jsonb_build_object(
      'data_type', c.data_type,
      'udt_name', c.udt_name,
      'nullable', c.is_nullable,
      'default', c.column_default
    )::text
  FROM information_schema.columns c
  JOIN target_tables t ON t.table_name = c.table_name
  WHERE c.table_schema = 'public'

  UNION ALL

  SELECT
    'policy'::text,
    'public.' || p.tablename || '.' || p.policyname,
    jsonb_build_object(
      'command', p.cmd,
      'permissive', p.permissive,
      'roles', p.roles,
      'using', p.qual,
      'with_check', p.with_check
    )::text
  FROM pg_policies p
  JOIN target_tables t ON t.table_name = p.tablename
  WHERE p.schemaname = 'public'

  UNION ALL

  SELECT
    'table_grant'::text,
    'public.' || t.table_name || '.' || COALESCE(r.rolname, 'PUBLIC'),
    jsonb_build_object(
      'privilege', a.privilege_type,
      'grantable', a.is_grantable,
      'grantor', grantor.rolname
    )::text
  FROM target_tables t
  JOIN pg_namespace n ON n.nspname = 'public'
  JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = t.table_name
  CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
  LEFT JOIN pg_roles r ON r.oid = a.grantee
  LEFT JOIN pg_roles grantor ON grantor.oid = a.grantor
  WHERE COALESCE(r.rolname, 'PUBLIC') IN ('PUBLIC', 'anon', 'authenticated', 'service_role')

  UNION ALL

  SELECT
    'constraint'::text,
    'public.' || c.relname || '.' || con.conname,
    jsonb_build_object(
      'type', con.contype,
      'definition', pg_get_constraintdef(con.oid, true),
      'validated', con.convalidated,
      'deferrable', con.condeferrable,
      'initially_deferred', con.condeferred
    )::text
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN target_tables t ON t.table_name = c.relname
  WHERE n.nspname = 'public'

  UNION ALL

  SELECT
    'index'::text,
    'public.' || tablename || '.' || indexname,
    jsonb_build_object('definition', indexdef)::text
  FROM pg_indexes
  JOIN target_tables t ON t.table_name = pg_indexes.tablename
  WHERE schemaname = 'public'

  UNION ALL

  SELECT
    'nutrition_function'::text,
    'public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    jsonb_build_object(
      'security_definer', p.prosecdef,
      'volatility', p.provolatile,
      'owner', pg_get_userbyid(p.proowner),
      'config', p.proconfig,
      'acl', p.proacl
    )::text
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proname ILIKE '%nutrition%' OR p.proname = 'delete_nutrition_meal_and_items')

  UNION ALL

  SELECT
    'trigger'::text,
    'public.' || c.relname || '.' || tr.tgname,
    jsonb_build_object(
      'enabled', tr.tgenabled,
      'definition', pg_get_triggerdef(tr.oid, true)
    )::text
  FROM pg_trigger tr
  JOIN pg_class c ON c.oid = tr.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN target_tables t ON t.table_name = c.relname
  WHERE n.nspname = 'public' AND NOT tr.tgisinternal
)
SELECT section, object_name, details
FROM audit
ORDER BY section, object_name;
