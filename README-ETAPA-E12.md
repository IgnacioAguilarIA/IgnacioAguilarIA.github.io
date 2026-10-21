# Etapa E12 — búsqueda y filtros profesionales en Alimentación

## Objetivo

Facilitar el uso de Alimentación cuando se acumulan alimentos propios, recetas y consumos históricos, sin cambiar el contenido guardado ni las fórmulas nutricionales.

## Novedades

- **Mis recetas:** búsqueda sin distinguir mayúsculas ni acentos; busca en el nombre, notas, ingredientes e instrucciones. Incluye filtros para recetas con/sin instrucciones, variantes y recetas originales.
- **Mis alimentos:** búsqueda por nombre, marca, procedencia, etiquetas e ingredientes y filtro por preparación (crudo, cocido, preparado o sin especificar).
- **Historial de consumo:** búsqueda por alimento, marca, nombre de la comida, horario, fecha y algunos datos de la instantánea; filtro por categoría de comida con alias en español e inglés.
- **Estados vacíos diferenciados:** separa “todavía no hay registros” de “no hay resultados con estos filtros”. Los diálogos incluyen una acción para limpiar los filtros.
- **Mejora de rendimiento de la interacción:** los filtros se aplican a los registros cargados en memoria, sin repetir una llamada a Supabase en cada tecla. El período del historial sigue siendo el que seleccionó el usuario.
- **Aislamiento de vistas por cuenta:** las cachés de recetas y alimentos se vacían al abrir una nueva vista antes de iniciar una nueva consulta, evitando mostrar fugazmente los elementos de una cuenta anterior mientras carga la cuenta activa.

## Archivos cambiados

- `js/58-nutrition-advanced.js`
- `css/94-nutrition-browse-filters-e12.css` (nuevo)
- `index.html` (incluye la hoja E12 después de E11)
- `tests/nutrition-browse-filters-e12.test.cjs` (pruebas unitarias/estructurales)
- `tests/e12_browse_filters_browser_audit.py` (pruebas en Chromium con catálogo simulado)

## Instalación

Si ya tenés E11 instalada, reemplazá el archivo `js/58-nutrition-advanced.js`, el `index.html` y agregá `css/94-nutrition-browse-filters-e12.css` en esas rutas exactas. No requiere SQL ni cambios en `index.html` distintos a la referencia CSS ya incluida en este paquete.

No se cambian tablas, datos, favoritos guardados, recetas ni consumos. Los filtros son de visualización solamente.

## Validación

- Ejecutar todas las pruebas Node: `node --test tests/*.test.cjs`.
- Ejecutar comprobación de sintaxis de JavaScript: `node --check js/58-nutrition-advanced.js`.
- Prueba de interacción Chromium: `python tests/e12_browse_filters_browser_audit.py --screenshots`.
- Completar `tests/MANUAL-BROWSE-FILTERS-E12-CHECKLIST.md` con una cuenta de prueba real. Las pruebas simuladas no verifican la conexión de producción de Supabase.

## Límites conocidos

El filtro actúa sobre los resultados que ya devuelve cada consulta. El historial rápido continúa limitado al rango seleccionado (7, 30 o 90 días) y al límite configurado en la persistencia; no busca meses que no se hayan cargado. Los informes del módulo de calidad conservan sus filtros propios por fecha y categoría.


## Resultado de validación

- **96 pruebas Node** aprobadas en la suite completa del proyecto.
- **28/28 comprobaciones de interacción Chromium** aprobadas para los filtros E12 en móvil y escritorio, con datos simulados.
- **7 vistas responsive E6** aprobadas, incluyendo diálogos a altura reducida de 320×400.
- **14/14 combinaciones E10** de tema claro/oscuro y viewport aprobadas.
- **68 archivos JavaScript** sin errores de sintaxis; 94 CSS con llaves equilibradas; 523 IDs HTML sin duplicados; 162 referencias locales sin archivos faltantes.

Informes JSON: `tests/artifacts/e12/browse-filters-browser-audit.json`, `tests/artifacts/e12/e6-regression-viewport-audit.json` y `tests/artifacts/e12/e10-regression-professional-audit.json`.

Estas pruebas verifican código y modales con datos de muestra; no reemplazan la comprobación final en una sesión real de Supabase ni las pruebas en un teléfono físico.
