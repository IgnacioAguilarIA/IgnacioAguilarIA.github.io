-- Agenda FICH — D2: privileges mínimos para tablas de Alimentación.
-- Basado en la auditoría de Supabase exportada el 2026-10-12.
--
-- Qué corrige:
--   * Las tablas personales tenían, además de CRUD, TRUNCATE, TRIGGER,
--     REFERENCES y MAINTAIN concedidos a authenticated.
--   * RLS no sustituye los privilegios de tabla; por ejemplo, TRUNCATE no
--     está sujeto a RLS.
--
-- Esta migración NO lee, actualiza ni elimina filas de la aplicación.
-- No cambia las policies RLS ni los privilegios de service_role.
-- Se aborta y revierte si el esquema/policies esperados no están presentes o
-- si los privilegios efectivos no quedan limitados a lo esperado.

BEGIN;

DO $preflight$
DECLARE
  v_table text;
  v_cmd text;
  v_missing text[] := ARRAY[]::text[];
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'food_catalog',
    'nutrition_meals',
    'nutrition_meal_items',
    'user_foods',
    'nutrition_preferences',
    'nutrition_recipes',
    'nutrition_consumption_history'
  ] LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      v_missing := array_append(v_missing, 'public.' || v_table);
    ELSIF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = v_table
        AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'D2 cancelada: RLS no está habilitado en public.%. No se cambió ningún privilegio.', v_table;
    END IF;
  END LOOP;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'D2 cancelada: faltan tablas: %. No se cambió ningún privilegio.', array_to_string(v_missing, ', ');
  END IF;

  -- El catálogo es de solo lectura para la app.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'food_catalog'
      AND p.permissive = 'PERMISSIVE'
      AND p.cmd IN ('SELECT', 'ALL')
      AND 'authenticated' = ANY(p.roles)
  ) THEN
    RAISE EXCEPTION 'D2 cancelada: falta la policy SELECT autenticada en public.food_catalog.';
  END IF;

  -- Las seis tablas personales deben conservar políticas CRUD permisivas para authenticated.
  FOREACH v_table IN ARRAY ARRAY[
    'nutrition_meals',
    'nutrition_meal_items',
    'user_foods',
    'nutrition_preferences',
    'nutrition_recipes',
    'nutrition_consumption_history'
  ] LOOP
    FOREACH v_cmd IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename = v_table
          AND p.permissive = 'PERMISSIVE'
          AND p.cmd IN (v_cmd, 'ALL')
          AND 'authenticated' = ANY(p.roles)
      ) THEN
        RAISE EXCEPTION 'D2 cancelada: falta una policy permisiva % para authenticated en public.%. No se cambió ningún privilegio.', v_cmd, v_table;
      END IF;
    END LOOP;
  END LOOP;
END;
$preflight$;

-- Revocar también de PUBLIC y anon explícitamente, sin tocar service_role.
-- En las seis tablas personales se vuelve a conceder solo CRUD.
REVOKE ALL PRIVILEGES ON TABLE public.food_catalog
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.food_catalog TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE
  public.nutrition_meals,
  public.nutrition_meal_items,
  public.user_foods,
  public.nutrition_preferences,
  public.nutrition_recipes,
  public.nutrition_consumption_history
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.nutrition_meals,
  public.nutrition_meal_items,
  public.user_foods,
  public.nutrition_preferences,
  public.nutrition_recipes,
  public.nutrition_consumption_history
  TO authenticated;

DO $postflight$
DECLARE
  v_table text;
  v_privilege text;
BEGIN
  -- Confirmar CRUD y ausencia de permisos sensibles para authenticated.
  FOREACH v_table IN ARRAY ARRAY[
    'nutrition_meals',
    'nutrition_meal_items',
    'user_foods',
    'nutrition_preferences',
    'nutrition_recipes',
    'nutrition_consumption_history'
  ] LOOP
    IF NOT has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT')
       OR NOT has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
       OR NOT has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
       OR NOT has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE') THEN
      RAISE EXCEPTION 'D2 falló verificación: authenticated no tiene exactamente el CRUD necesario en public.%. Se revierte la transacción.', v_table;
    END IF;

    FOREACH v_privilege IN ARRAY ARRAY['TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN'] LOOP
      IF has_table_privilege('authenticated', format('public.%I', v_table), v_privilege) THEN
        RAISE EXCEPTION 'D2 falló verificación: authenticated aún tiene % en public.%. Se revierte la transacción.', v_privilege, v_table;
      END IF;
    END LOOP;

    FOREACH v_privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN'] LOOP
      IF has_table_privilege('anon', format('public.%I', v_table), v_privilege) THEN
        RAISE EXCEPTION 'D2 falló verificación: anon aún tiene % en public.%. Se revierte la transacción.', v_privilege, v_table;
      END IF;
    END LOOP;
  END LOOP;

  -- El catálogo queda solo lectura para authenticated y cerrado para anon.
  IF NOT has_table_privilege('authenticated', 'public.food_catalog', 'SELECT') THEN
    RAISE EXCEPTION 'D2 falló verificación: authenticated perdió SELECT en public.food_catalog. Se revierte la transacción.';
  END IF;
  FOREACH v_privilege IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN'] LOOP
    IF has_table_privilege('authenticated', 'public.food_catalog', v_privilege) THEN
      RAISE EXCEPTION 'D2 falló verificación: authenticated aún tiene % en public.food_catalog. Se revierte la transacción.', v_privilege;
    END IF;
  END LOOP;
  FOREACH v_privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN'] LOOP
    IF has_table_privilege('anon', 'public.food_catalog', v_privilege) THEN
      RAISE EXCEPTION 'D2 falló verificación: anon aún tiene % en public.food_catalog. Se revierte la transacción.', v_privilege;
    END IF;
  END LOOP;
END;
$postflight$;

COMMIT;
