# Configuración del catálogo de alimentos

1. Abrí el proyecto de Supabase de Agenda FICH.
2. Entrá a **SQL Editor**.
3. Pegá y ejecutá `01-nutrition-food-catalog.sql`.
4. Recargá la Agenda FICH.

El script crea:
- `food_catalog`: catálogo genérico compartido.
- `user_foods`: alimentos guardados automáticamente por cada usuario.
- `nutrition_meal_items`: instantánea estructurada de los alimentos seleccionados dentro de cada comida.

También crea RLS para que los usuarios solamente puedan ver/modificar sus propios alimentos y detalles de comida. `food_catalog` queda en lectura para usuarios autenticados.

La aplicación sigue funcionando aunque todavía no hayas ejecutado el SQL: en ese caso continúa usando `nutrition_meals` y Open Food Facts, y deja la persistencia nueva como una función opcional.

## D3 — permisos de funciones de trigger

- Ejecutá `15-nutrition-trigger-function-rpc-lockdown.sql` después de revisar la auditoría SQL 13. Revoca la ejecución directa de funciones de trigger de Alimentación para `PUBLIC`, `anon` y `authenticated`, sin modificar filas ni los triggers existentes.
- Después ejecutá `16-nutrition-sync-postcheck-readonly.sql`; devuelve permisos efectivos, RLS, funciones de trigger y conteos de relaciones inconsistentes, sin exponer contenido de comidas o recetas.

## Etapa D7 — calidad y procedencia nutricional

1. Ejecutá `21-nutrition-quality-provenance.sql` antes de publicar los archivos D7. Es una migración aditiva: agrega campos de procedencia/estado en catálogo, alimentos propios y detalle de comidas; los registros anteriores quedan `legacy_unverified` y no se tratan como verificados.
2. Ejecutá `22-nutrition-quality-postcheck.sql` después para comprobar columnas, RLS, privilegios y contadores de integridad.
3. Los CSV de D7 incluyen fuente, estado de calidad y campos faltantes disponibles en las instantáneas. Los datos históricos no se reescriben a partir del catálogo actual.

## Etapa E3 — despensa personal

`23-nutrition-pantry.sql` crea el inventario, movimientos y guardas de descuento de comidas planificadas. Requiere `nutrition_weekly_plan_items` de E2. La escritura de cantidades se hace mediante RPC transaccionales con comprobación de cuenta; la interfaz no tiene permisos directos para modificar stock o historial. Ejecutar el archivo una vez y luego inspeccionar `24-nutrition-pantry-postcheck.sql` (solo lectura). No ejecutar sobre una base sin las tablas requeridas de E2.


### E32 — Plantillas semanales

`29-nutrition-weekly-plan-templates.sql` agrega `weekly_plan_templates` a `nutrition_preferences`, con límites de tamaño y cantidad, y conserva el aislamiento RLS existente por cuenta. Requiere `06-nutrition-account-sync.sql`. Después, inspeccioná `30-nutrition-weekly-plan-templates-postcheck.sql` (solo lectura). La aplicación puede seguir usando el editor semanal si la migración falta, pero el panel de plantillas mostrará un mensaje y no guardará nada.
