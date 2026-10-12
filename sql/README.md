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
