# Gran ampliacion del catalogo local

Esta migracion agrega 491 alimentos nuevos al catalogo local, llevando el catalogo total esperado a aproximadamente 998 registros despues de ejecutar las migraciones anteriores.

- Todos los valores son referencias por 100 g de parte comestible.
- `source = curated-reference-2026` indica que son datos de referencia curados para el catalogo; los productos comerciales de marca siguen delegandose a Open Food Facts.
- La migracion es incremental y evita duplicar nombres normalizados que ya existan.
- No modifica ninguna tabla ni logica de entrenamiento.

Como referencia metodologica, USDA FoodData Central publica descargas de Foundation Foods y otros conjuntos de composicion nutricional, con valores por alimento y documentacion de campos.

Para ejecutar: Supabase -> SQL Editor -> pegar/ejecutar `03-nutrition-food-catalog-large-expansion.sql`.
