# Etapa E21 — Fiabilidad del autocompletado de Alimentación

## Alcance

Correcciones acotadas a Alimentación. No hay cambios en Entrenamiento, SQL, navegación global ni escritura de datos en Supabase.

## Cambios

- El autocompletado transporta la procedencia, el estado de calidad, los campos nutricionales ausentes y la fecha de verificación desde `food_catalog` y `user_foods`.
- Tanto la consulta directa como el adaptador de búsqueda local detectan los nutrientes principales realmente ausentes. Un cero numérico explícito sigue siendo un valor válido; un `NULL`, campo vacío o valor no numérico se marca como dato faltante.
- Los resultados con datos incompletos muestran una advertencia en lugar de presentar sus macros como ceros confirmados.
- Elegir una sugerencia en «Nombre de la comida» solo completa el título. Ya no selecciona un ingrediente, cambia la cantidad ni abre el catálogo automáticamente.
- La selección con teclado se conserva cuando llegan resultados adicionales. La deduplicación distingue estados crudo/cocido, unidades, porciones y equivalencias conocidas.
- Se añade un estilo local para las advertencias nutricionales y las variantes, respetando alto contraste y movimiento reducido.
- Se actualizan los parámetros de caché del CSS y el JavaScript del autocompletado.

## Archivos modificados

- `index.html`
- `js/50-nutrition-food-autocomplete.js`
- `js/49-nutrition-persistence.js`
- `css/102-nutrition-autocomplete-accessibility-e20.css`
- `tests/e20_autocomplete_accessibility_browser_audit.py`
- `tests/nutrition-autocomplete-quality-e21.test.cjs`
- `README-ETAPA-E21.md`

## Validación

- Ejecutar `node --test tests/*.test.cjs`.
- Ejecutar `python tests/e20_autocomplete_accessibility_browser_audit.py` en un entorno que tenga Chromium y Playwright disponibles.
- La auditoría de navegador usa respuestas simuladas. No acredita una conexión real con Supabase ni pruebas táctiles en un teléfono.
- Antes de publicar, comprobar manualmente que la base de Supabase tenga las columnas de trazabilidad agregadas en la migración `sql/21-nutrition-quality-provenance.sql` (estas columnas ya son utilizadas por el módulo de persistencia existente).
