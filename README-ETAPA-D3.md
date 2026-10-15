# Agenda FICH — Etapa D3: verificación final de privilegios de Alimentación

## Resultado del CSV de SQL 13

El CSV adjunto confirma que la migración D2 quedó aplicada de forma coherente:

- RLS habilitado en las siete tablas de Alimentación.
- `authenticated`: solo `SELECT` en `food_catalog` y `SELECT/INSERT/UPDATE/DELETE` en las seis tablas personales.
- No aparecen grants de tabla para `anon` ni para `PUBLIC`.
- Las políticas por cuenta verifican `auth.uid() = user_id`; el detalle de comida además comprueba la propiedad de la comida padre y de los alimentos personalizados vinculados.
- La función `delete_nutrition_meal_and_items(text)` es `SECURITY INVOKER`, usa `search_path=""` y está concedida a `authenticated` y `service_role`.
- Se conserva la restricción única del historial `(user_id, meal_item_id, consumed_date)`.

El privilegio amplio de `service_role` es esperado para operaciones administrativas de servidor. Su clave nunca debe aparecer en el frontend.

## Hallazgo residual y ajuste D3

El CSV mostró `EXECUTE` para `PUBLIC`, `anon` y `authenticated` en `touch_nutrition_preferences_updated_at()`, una función de trigger. SQL 13 filtra la lista de funciones y no reporta todos los helpers de trigger; por eso D3 inspecciona todas las funciones asociadas a triggers de las siete tablas de Alimentación.

La migración revoca la ejecución directa de estas funciones para `PUBLIC`, `anon` y `authenticated`, sin tocar datos, tablas, políticas ni los triggers existentes. Si encuentra un trigger `SECURITY DEFINER`, se aborta para permitir una revisión manual en lugar de cambiarlo automáticamente. Los permisos de `service_role` no se modifican.

## Pasos

1. Guardá una copia de seguridad reciente.
2. En Supabase SQL Editor, ejecutá `sql/15-nutrition-trigger-function-rpc-lockdown.sql` una sola vez.
3. Ejecutá `sql/16-nutrition-sync-postcheck-readonly.sql` y exportá el resultado CSV.
4. Confirmá que RLS siga habilitado, los permisos de tabla conserven el alcance esperado, `anon`/`authenticated` no puedan ejecutar directamente las funciones de trigger y los tres contadores de integridad sean cero.

## Validación funcional pendiente

El CSV de SQL 13 es una auditoría de esquema y privilegios; no prueba por sí solo los flujos reales del navegador. Para cerrar la sincronización, usá una cuenta de prueba:

1. Registrá una comida con un alimento de prueba y recargá para comprobar persistencia.
2. Marcá el alimento como consumido, desmarcalo, recargá y verifica que el estado final corresponda a la última acción.
3. Repetí la operación mientras bloqueás la red del navegador; recuperá la conexión y usá el reintento de Alimentación.
4. Revisa el historial para asegurarte de que no aparezcan filas repetidas.
5. Iniciá sesión con una segunda cuenta de prueba y verifica que no pueda consultar ni modificar los datos de la primera.

No compartas contraseñas, tokens de sesión ni claves `service_role`. Estos cambios se limitan a Alimentación; no alteran Entrenamiento, Agenda ni navegación.
