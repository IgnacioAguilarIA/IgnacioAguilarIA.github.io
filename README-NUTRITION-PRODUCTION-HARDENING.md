# Alimentación — Etapa A1: estabilización y diagnóstico

Esta entrega parte exclusivamente del ZIP original recibido para esta tarea. El alcance se limita a la lógica de Alimentación y a SQL/documentación de esa sección. No se editaron HTML, CSS, navegación, autenticación ni módulos específicos de Agenda o Entrenamiento.

## Cambios de esta etapa

- Serialización de guardados de alimentos detallados por cuenta y comida: dos guardados simultáneos ya no leen la misma versión y se pisan entre sí.
- Guardas de identidad por cuenta en lecturas/escrituras de alimentos, recetas, historial, búsqueda y operaciones nutricionales asíncronas. Una respuesta de una cuenta anterior no debe contaminar la interfaz de la sesión nueva.
- Cola de consumos pendiente aislada por usuario, sincronización de un solo proceso por cuenta y reintento si el estado de consumo se guardó pero falló el historial.
- El formulario de comida bloquea dobles envíos, informa fallos y deja la ventana abierta con la selección si los alimentos detallados no se sincronizan.
- La exportación pagina las tablas nutricionales y aborta si la sesión cambia. Si falla la lectura de alguna tabla necesaria, no genera un archivo parcial que pueda confundirse con una copia íntegra.
- La restauración de las operaciones nutricionales se detiene si cambia la cuenta durante una solicitud y usa el ID de la cuenta que inició esa restauración.
- La migración `08-nutrition-production-hardening.sql` valida tablas, columnas y policies permisivas requeridas antes de alterar RLS. Añade policies restrictivas con nombres nuevos, sin eliminar las policies permisivas que dan acceso, y un RPC transaccional para borrar una comida y sus detalles conjuntamente.
- `09-nutrition-audit-readonly.sql` inspecciona presencia de tablas, columnas, RLS, permisos, policies y restricciones sin leer filas personales ni cambiar la base.

## Orden de comprobación en Supabase

1. Ejecutar **solo** `09-nutrition-audit-readonly.sql` en SQL Editor y guardar sus resultados.
2. Confirmar que el esquema y las policies coincidan con las migraciones de Alimentación. Para esta versión deben existir las migraciones base `01`, `05`, `06` y `07`.
3. Solo si el diagnóstico confirma el esquema esperado, ejecutar `08-nutrition-production-hardening.sql`. El script aborta antes de cambiar nada si faltan tablas, columnas o policies permisivas base. No quitar estas validaciones para forzarlo.
4. Probar en cuentas de prueba distintas: comidas, alimentos propios, recetas, preferencias, consumos, historial, exportación y eliminación atómica de comida/detalles. También intentar consultas con el `user_id` de la otra cuenta; RLS debe impedir leer o alterar esos datos.
5. Probar reconexión con consumos pendientes y confirmar que el estado de sincronización no muestre éxito hasta que Supabase confirme también el historial.

## Pruebas locales ejecutadas

`tests/nutrition-stage-a.test.cjs` contiene seis pruebas con un cliente Supabase simulado: guardados simultáneos, cambio de cuenta durante una escritura, fallo de inserción, cambio de cuenta durante búsqueda externa, validaciones de la migración y cancelación de respaldos incompletos. También se verificó la sintaxis de JavaScript y CSS.

Las pruebas locales y los mocks **no sustituyen** la ejecución contra el proyecto real de Supabase, ni una prueba visual en celulares.

## Límites pendientes

- No se ejecutó ninguna migración contra tu Supabase real ni se probaron dos cuentas reales. No puedo certificar el aislamiento en producción hasta revisar el resultado del diagnóstico y probar permisos con cuentas de prueba.
- La eliminación de una comida y sus detalles queda atómica tras aplicar la migración 08. La restauración de una copia completa todavía usa varias solicitudes y no es una única transacción de base de datos; esa protección definitiva requiere una función transaccional del lado servidor diseñada y probada contra el esquema real. Hasta entonces, no uses “reemplazar” con la única copia de tus datos; primero ensayá en una cuenta de prueba.
- Las etapas B y C (unidades, crudo/cocido, edición más amplia, repetir días, CSV, estadísticas y pulido accesible) todavía no se implementaron; se posponen hasta cerrar la estabilidad de producción.

## Análisis del CSV real de Supabase y Etapa A2

El CSV exportado después de `09-nutrition-audit-readonly.sql` confirma:

- RLS está habilitado en las siete tablas revisadas. `FORCE ROW LEVEL SECURITY` está desactivado; la aplicación cliente usa los roles `anon`/`authenticated`, por lo que lo importante es que todas las operaciones cliente sigan protegidas por policies. A2 no activa FORCE RLS para no alterar innecesariamente el comportamiento de roles propietarios.
- `anon` tiene privilegios efectivos a nivel de tabla en las siete tablas consultadas. Aunque las policies actuales no muestran una policy permisiva de usuario anónimo, A2 revoca permisos innecesarios de `PUBLIC` y `anon` y da a `authenticated` solo lectura en `food_catalog` y CRUD en las seis tablas propias. `service_role` conserva permisos explícitos para uso de servidor; su clave nunca debe enviarse al navegador.
- Hay cuatro guards restrictivos duplicados con el mismo predicado: `nutrition_meals_account_scope_guard`, `nutrition_meal_items_account_scope_guard`, `user_foods_account_scope_guard` y `nutrition_preferences_account_scope_guard`. A2 solo los elimina si confirma que la policy canónica existe y es idéntica en tipo, alcance, comando y expresiones.
- `nutrition_meal_items.user_food_id` tiene FK a `user_foods(id)`, pero esa FK sola no asegura que ambos registros pertenezcan a la misma cuenta. A2 agrega guards restrictivos de INSERT/UPDATE para evitar nuevos vínculos entre cuentas; no cambia filas existentes.
- `nutrition_consumption_history` posee `UNIQUE (user_id, meal_item_id, consumed_date)`, y `user_foods` posee `UNIQUE (user_id, fingerprint)`, que ayudan a evitar duplicados por usuario.
- `nutrition_meal_items.meal_id` es `text` y no presenta una FK directa a `nutrition_meals.id` (UUID). No se convierte la columna ni se añade una FK a ciegas: primero se deben revisar los contadores de filas sin padre o con propietario discordante que devuelve `11-nutrition-integrity-audit-readonly.sql`.

### Procedimiento recomendado

1. Ejecutar `sql/11-nutrition-integrity-audit-readonly.sql` en SQL Editor y exportar la tabla de resultados. Solo entrega nombres de comprobaciones y contadores, no nombres de alimentos, IDs personales ni contenido de recetas.
2. Si los contadores `missing_parent`, `parent_owned_by_other_account` o `user_food_owned_by_other_account` son mayores que cero, detenerse y revisar esos casos antes de aplicar A2. No borrar datos automáticamente.
3. Si las anomalías de integridad son cero, revisar `anon_select` y permisos de `service_role`; luego ejecutar `sql/10-nutrition-supabase-findings-fix.sql` en Supabase. La migración hace comprobaciones previas y usa una transacción, pero la ejecución real solo queda confirmada cuando Supabase devuelve éxito.
4. Volver a ejecutar `sql/11-nutrition-integrity-audit-readonly.sql`; comprobar que los permisos de `anon` ya no estén y que la función de eliminación exista y solo sea ejecutable por los roles esperados.
5. Antes de usar con datos importantes, probar comidas, alimentos propios, recetas, preferencias, consumo/historial y borrar una comida en dos cuentas de prueba. El CSV de esquema no demuestra por sí mismo el aislamiento efectivo entre dos sesiones reales.

La Etapa A2 no modifica datos almacenados ni los módulos específicos de Agenda o Entrenamiento. Las migraciones y consultas SQL deben ejecutarse manualmente en el proyecto real; no se han aplicado desde aquí.
