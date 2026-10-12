# Alimentación — Etapa B2

Esta etapa incorpora unidades con equivalencias explícitas y etiquetado del estado de preparación.

## Antes de publicar los archivos
1. Hacé un backup reciente desde la app/Supabase.
2. En Supabase SQL Editor ejecutá `sql/12-nutrition-units-preparation.sql` una sola vez. Es idempotente y no elimina filas. El backfill solo asigna `quantity_in_grams` cuando hay una equivalencia segura (gramos, densidad conocida, gramos por unidad conocidos o gramos por porción conocidos).
3. Verificá que Supabase responda `Success. No rows returned`.
4. Publicá el ZIP completo conservando la estructura de carpetas.

## Comportamiento
- Los nutrientes del catálogo siguen expresados por 100 g.
- `ml` solo aparece si existe densidad positiva en g/ml.
- `unidad` y `porción` solo aparecen si se conoce su peso en gramos.
- No se supone que 100 ml = 100 g.
- El estado crudo/cocido/preparado se guarda como etiqueta y no convierte nutrientes por sí solo. Los valores por 100 g deben corresponder al estado elegido.
- En recetas se puede indicar el peso final medido tras cocinar. Si se deja vacío, se usa la suma estimada de los ingredientes convertidos a gramos.
- Las comidas antiguas en gramos se backfillean sin recalcular sus nutrientes. Las filas históricas en ml/unidades/porciones solo reciben equivalencia si la propia fila ya contiene el factor explícito; no se copian conversiones actuales del catálogo a registros antiguos. Las filas sin conversión fiable se mantienen con peso equivalente desconocido y no se recalculan en silencio.

## Pruebas locales
Con Node.js, ejecutá `node tests/nutrition-stage-b2.test.cjs` desde la carpeta del proyecto.

Esta migración y las pruebas locales no sustituyen una prueba visual en tu dispositivo ni una verificación completa con dos cuentas de Supabase.
