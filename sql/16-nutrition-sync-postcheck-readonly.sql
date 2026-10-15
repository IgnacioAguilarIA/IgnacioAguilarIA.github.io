-- Agenda FICH — D3 postcheck (SOLO LECTURA).
-- Produce conteos y permisos, nunca nombres de alimentos ni contenido personal.
-- Ejecutar después de 14-nutrition-minimum-privileges.sql y 15-nutrition-trigger-function-rpc-lockdown.sql.

WITH target_tables AS (
  SELECT unnest(ARRAY[
    'food_catalog', 'nutrition_meals', 'nutrition_meal_items', 'user_foods',
    'nutrition_preferences', 'nutrition_recipes', 'nutrition_consumption_history'
  ]::text[]) AS table_name
), table_status AS (
  SELECT
    'table_status'::text AS section,
    'public.' || t.table_name AS object_name,
    jsonb_build_object(
      'exists', c.oid IS NOT NULL,
      'rls_enabled', COALESCE(c.relrowsecurity, false),
      'force_rls', COALESCE(c.relforcerowsecurity, false),
      'authenticated_privileges', COALESCE((
        SELECT jsonb_agg(a.privilege_type ORDER BY a.privilege_type)
        FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
        JOIN pg_roles r ON r.oid = a.grantee
        WHERE r.rolname = 'authenticated'
      ), '[]'::jsonb),
      'anon_privileges', COALESCE((
        SELECT jsonb_agg(a.privilege_type ORDER BY a.privilege_type)
        FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
        JOIN pg_roles r ON r.oid = a.grantee
        WHERE r.rolname = 'anon'
      ), '[]'::jsonb),
      'public_privileges', COALESCE((
        SELECT jsonb_agg(a.privilege_type ORDER BY a.privilege_type)
        FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
        WHERE a.grantee = 0
      ), '[]'::jsonb)
    )::text AS details
  FROM target_tables t
  LEFT JOIN pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = t.table_name
), trigger_function_status AS (
  SELECT
    'trigger_function'::text AS section,
    'public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS object_name,
    jsonb_build_object(
      'returns_trigger', p.prorettype = 'trigger'::regtype,
      'security_definer', p.prosecdef,
      'anon_can_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated_can_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'service_role_can_execute', has_function_privilege('service_role', p.oid, 'EXECUTE'),
      'public_execute_acl', EXISTS (
        SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
        WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
      ),
      'attached_triggers', (
        SELECT count(*) FROM pg_trigger tr
        WHERE tr.tgfoid = p.oid AND NOT tr.tgisinternal
      )
    )::text AS details
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prorettype = 'trigger'::regtype
    AND EXISTS (
      SELECT 1
      FROM pg_trigger tr
      JOIN pg_class c ON c.oid = tr.tgrelid
      JOIN pg_namespace tn ON tn.oid = c.relnamespace
      WHERE tr.tgfoid = p.oid AND NOT tr.tgisinternal
        AND tn.nspname = 'public'
        AND c.relname = ANY (ARRAY[
          'food_catalog', 'nutrition_meals', 'nutrition_meal_items', 'user_foods',
          'nutrition_preferences', 'nutrition_recipes', 'nutrition_consumption_history'
        ]::text[])
    )
), data_integrity AS (
  SELECT
    'integrity_counts'::text AS section,
    'nutrition_relation_counts'::text AS object_name,
    jsonb_build_object(
      'meal_items_without_parent', (
        SELECT count(*)
        FROM public.nutrition_meal_items i
        LEFT JOIN public.nutrition_meals m ON m.id::text = i.meal_id
        WHERE m.id IS NULL
      ),
      'meal_items_with_owner_mismatch', (
        SELECT count(*)
        FROM public.nutrition_meal_items i
        JOIN public.nutrition_meals m ON m.id::text = i.meal_id
        WHERE m.user_id IS DISTINCT FROM i.user_id
      ),
      'meal_items_linked_to_other_users_food', (
        SELECT count(*)
        FROM public.nutrition_meal_items i
        JOIN public.user_foods f ON f.id = i.user_food_id
        WHERE i.user_food_id IS NOT NULL AND f.user_id IS DISTINCT FROM i.user_id
      )
    )::text AS details
)
SELECT section, object_name, details FROM table_status
UNION ALL
SELECT section, object_name, details FROM trigger_function_status
UNION ALL
SELECT section, object_name, details FROM data_integrity
ORDER BY section, object_name;
