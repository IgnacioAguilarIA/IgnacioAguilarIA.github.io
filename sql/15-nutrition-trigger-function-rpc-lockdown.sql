-- Agenda FICH — D3: mínimo privilegio para funciones usadas exclusivamente por triggers.
-- Basado en la auditoría SQL 13 de la instancia real.
-- No modifica datos, tablas, triggers, políticas RLS ni filas.
-- Los triggers existentes siguen funcionando; se retira la ejecución directa por API.

BEGIN;

DO $preflight$
DECLARE
  v_fn record;
  v_count integer := 0;
BEGIN
  -- Solo considerar funciones de trigger unidas a triggers de tablas de Alimentación.
  FOR v_fn IN
    SELECT DISTINCT
      p.oid,
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      p.prorettype = 'trigger'::regtype AS returns_trigger,
      p.prosecdef AS security_definer
    FROM pg_proc p
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    JOIN pg_trigger tr ON tr.tgfoid = p.oid AND NOT tr.tgisinternal
    JOIN pg_class c ON c.oid = tr.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pn.nspname = 'public'
      AND n.nspname = 'public'
      AND c.relname = ANY (ARRAY[
        'food_catalog',
        'nutrition_meals',
        'nutrition_meal_items',
        'user_foods',
        'nutrition_preferences',
        'nutrition_recipes',
        'nutrition_consumption_history'
      ]::text[])
  LOOP
    v_count := v_count + 1;
    IF NOT v_fn.returns_trigger THEN
      RAISE EXCEPTION 'D3 cancelada: la función %.%(%) está asociada a un trigger, pero no retorna trigger.',
        v_fn.nspname, v_fn.proname, v_fn.identity_args;
    END IF;
    IF v_fn.security_definer THEN
      RAISE EXCEPTION 'D3 cancelada: %.%(%) es SECURITY DEFINER y requiere revisión manual antes de ajustar privilegios.',
        v_fn.nspname, v_fn.proname, v_fn.identity_args;
    END IF;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'D3 cancelada: no se encontraron funciones de trigger en las tablas esperadas de Alimentación.';
  END IF;
END;
$preflight$;

-- Revoca solo EXECUTE directo de PUBLIC/anon/authenticated en funciones de trigger.
-- Los privilegios de service_role no se modifican. La comprobación EXECUTE se realiza
-- al crear el trigger, no en cada ejecución del trigger ya instalado.
DO $revoke_trigger_execute$
DECLARE
  v_fn record;
BEGIN
  FOR v_fn IN
    SELECT DISTINCT
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_trigger tr ON tr.tgfoid = p.oid AND NOT tr.tgisinternal
    JOIN pg_class c ON c.oid = tr.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY (ARRAY[
        'food_catalog',
        'nutrition_meals',
        'nutrition_meal_items',
        'user_foods',
        'nutrition_preferences',
        'nutrition_recipes',
        'nutrition_consumption_history'
      ]::text[])
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      v_fn.nspname, v_fn.proname, v_fn.identity_args
    );
  END LOOP;
END;
$revoke_trigger_execute$;

DO $postflight$
DECLARE
  v_fn record;
BEGIN
  FOR v_fn IN
    SELECT DISTINCT
      p.oid,
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_trigger tr ON tr.tgfoid = p.oid AND NOT tr.tgisinternal
    JOIN pg_class c ON c.oid = tr.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY (ARRAY[
        'food_catalog',
        'nutrition_meals',
        'nutrition_meal_items',
        'user_foods',
        'nutrition_preferences',
        'nutrition_recipes',
        'nutrition_consumption_history'
      ]::text[])
      AND p.prorettype = 'trigger'::regtype
  LOOP
    IF has_function_privilege('anon', v_fn.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'D3 falló: anon aún puede ejecutar %.%(%). Se revierte la transacción.',
        v_fn.nspname, v_fn.proname, v_fn.identity_args;
    END IF;
    IF has_function_privilege('authenticated', v_fn.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'D3 falló: authenticated aún puede ejecutar directamente %.%(%). Se revierte la transacción.',
        v_fn.nspname, v_fn.proname, v_fn.identity_args;
    END IF;
  END LOOP;
END;
$postflight$;

COMMIT;
