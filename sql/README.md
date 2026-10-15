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
