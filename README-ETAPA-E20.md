# Etapa E20 — Accesibilidad funcional del autocompletado de Alimentación

## Objetivo

Completar el soporte de teclado y lector de pantalla de los dos autocompletados de Alimentación: **nombre de la comida** y **búsqueda del catálogo de alimentos**. Se conserva el diseño y el proveedor de datos existente; no se altera el registro, la sincronización ni los cálculos nutricionales.

## Cambios realizados

- Los dos campos publican el contrato accesible de `combobox`: `aria-autocomplete`, `aria-haspopup`, `aria-controls` y `aria-expanded`.
- Las sugerencias se presentan como `listbox`, agrupadas con nombres accesibles; cada resultado declara `role="option"`, un identificador estable, `aria-selected` y `tabindex="-1"` para mantener el foco en el campo mientras se navega con flechas.
- `ArrowDown` y `ArrowUp` actualizan tanto el resaltado visual como `aria-activedescendant` y la opción seleccionada para tecnologías de asistencia.
- `Enter` conserva la selección del resultado y cierra el popup; `Escape` cierra el menú y limpia la referencia a la opción activa.
- La carga y el estado sin coincidencias viven en una región `role="status"` separada de la lista de opciones, con anuncios corteses. Así, un mensaje informativo no se confunde con un alimento seleccionable.
- Se añade una capa visual localizada para el estado activo, foco visible, alto contraste y movimiento reducido.
- Se añade un parámetro de versión a la URL del runtime actualizado para reducir el riesgo de que el navegador reutilice una copia en caché.

## Archivos para instalar

1. Reemplazar `index.html`.
2. Reemplazar `js/50-nutrition-food-autocomplete.js`.
3. Agregar `css/102-nutrition-autocomplete-accessibility-e20.css`.

No hay cambios SQL, migraciones Supabase, ni nuevos datos que cargar. La etapa modifica el runtime de autocompletado ya existente; no crea un servicio o una dependencia nueva.

## Pruebas de esta etapa

- 9 pruebas automatizadas Node específicas de E20; **142/142 pruebas Node** de todo el proyecto aprobadas en la regresión completa.
- 5 verificaciones funcionales en Chromium con proveedores de prueba: contrato de combobox, roles de opciones/grupos, navegación con flechas, selección con `Enter`, cierre con `Escape` y estado vacío accesible, cubriendo ambos campos de búsqueda.
- La auditoría visual E19 sigue aprobada en 8/8 combinaciones de tamaño de pantalla/tema, y la auditoría de preferencias E18 sigue aprobada en 8/8 combinaciones.
- El informe consolidado y los reportes detallados se guardan en `tests/artifacts/e20/`, `tests/artifacts/e19/` y `tests/artifacts/e18/`.
- Las pruebas de navegador usan datos controlados y no afirman haber validado la disponibilidad real de Supabase ni del servicio externo.

## Comprobación manual recomendada

Ver `tests/MANUAL-AUTOCOMPLETE-ACCESSIBILITY-E20-CHECKLIST.md`. Comprobar teclado y lector de pantalla en un navegador de escritorio, y validar interacción táctil en el teléfono real.
