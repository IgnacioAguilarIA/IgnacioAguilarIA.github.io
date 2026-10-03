# Agenda FICH V98 — Alimentación con catálogo propio + Open Food Facts

Esta versión amplía la sección de Alimentación sin modificar la lógica de Entrenamiento.

## Nuevo flujo de búsqueda

1. **Mis alimentos** del usuario.
2. **Catálogo propio** (`food_catalog`) con alimentos genéricos y equivalencias/sinónimos.
3. **Open Food Facts** como respaldo para productos comerciales y alimentos que no tengan una coincidencia clara en el catálogo.

Las coincidencias exactas del catálogo propio tienen prioridad para evitar resultados derivados o idiomas mezclados en búsquedas como `manzana`, `banana`, `arroz` o `pollo`.

## Persistencia

- `food_catalog`: catálogo genérico compartido, administrado desde Supabase.
- `user_foods`: copia personalizada de los alimentos usados/guardados por cada usuario.
- `nutrition_meal_items`: instantánea estructurada de los alimentos seleccionados dentro de cada comida.
- `nutrition_meals`: sigue siendo la tabla principal de las comidas y conserva sus macros totales.

Cuando un alimento externo o del catálogo se usa en una comida, se guarda automáticamente también en `user_foods`, por lo que futuras búsquedas son más rápidas y personales.

## Configuración de Supabase

Ejecutar `sql/01-nutrition-food-catalog.sql` desde el SQL Editor del proyecto de Supabase. El script crea las tablas, índices, RLS, triggers de búsqueda y un catálogo inicial de alimentos genéricos.

La app tiene fallback: si las tablas nuevas todavía no existen, la búsqueda sigue funcionando mediante Open Food Facts y la tabla existente `nutrition_meals` no deja de funcionar.

## Entrenamiento

No se modificó ninguna función ni archivo específico de la sección de Entrenamiento. Las modificaciones se concentran en Alimentación, su catálogo y la persistencia asociada.


## Ampliación del catálogo local

Se agrega `sql/02-nutrition-food-catalog-expansion.sql` con **418 alimentos genéricos adicionales** (total esperado: más de **500** alimentos en el catálogo inicial), organizados por categorías y con valores por 100 g de parte comestible. Ejecutar este archivo después de `sql/01-nutrition-food-catalog.sql` para ampliar una instalación existente.

También se incluye `data/food_catalog_expansion.csv` para inspección o importación manual. Los registros usan `source='curated'` y se insertan solo si todavía no existe el mismo nombre genérico, evitando duplicados.

## Búsqueda automática mientras se escribe

El campo de alimento ahora funciona como autocompletado: desde la segunda letra busca en el catálogo local en memoria y, después de una breve pausa al escribir, consulta Open Food Facts sin bloquear la interfaz.

El orden visual es **Mis alimentos → Catálogo de la aplicación → Open Food Facts**. Las sugerencias aceptan teclado (↑/↓, Enter y Esc), evitan duplicados exactos y mantienen el botón **Buscar en Open Food Facts** como búsqueda manual de respaldo. El índice local se carga una sola vez por sesión para que las siguientes búsquedas sean inmediatas.
