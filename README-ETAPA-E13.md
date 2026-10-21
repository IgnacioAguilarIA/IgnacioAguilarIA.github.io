# Etapa E13 — Alimentación guiada y divulgación progresiva

## Objetivo

Reducir la cantidad de información que aparece simultáneamente en teléfonos, facilitar la primera experiencia y conservar el acceso a todas las herramientas avanzadas. La reorganización es de interfaz: no modifica cálculos nutricionales, datos guardados ni operaciones de Supabase.

## Cambios

- **Acción principal única en móvil.** “Agregar comida” queda destacado. Objetivos, historial, planificación semanal, compras, despensa e informes se agrupan dinámicamente bajo “Más herramientas”. Los módulos anteriores pueden seguir agregando sus botones; un `MutationObserver` los incorpora automáticamente al grupo sin perder sus eventos.
- **Detalle nutricional plegable en móvil.** Las cifras detalladas de calorías, proteínas, carbohidratos y grasas —planificadas y consumidas— quedan detrás de “Ver detalle nutricional”. El resumen del día y las dos barras de progreso continúan a la vista.
- **Objetivos opcionales.** Las tarjetas de progreso y su explicación se agrupan en “Objetivos del día”. En escritorio los detalles siguen abiertos para conservar la vista completa.
- **Tipos de comida en una fila horizontal en móvil.** Se muestran como chips táctiles que se pueden desplazar, con una indicación explícita para descubrir las demás opciones. No se elimina ninguna categoría.
- **Guía contextual de primera comida.** Solo aparece cuando el día está vacío y no hay comidas conocidas en la caché de la cuenta. En ese caso reemplaza el mensaje vacío anterior para evitar duplicarlo. El botón de la guía activa el botón existente “Agregar comida”.
- **Accesibilidad.** Los selectores de día y tipo de comida exponen `aria-pressed`, las agrupaciones tienen etiquetas accesibles y se respetan las preferencias de movimiento reducido y alto contraste.
- **Descripción más breve.** El encabezado explica en una frase la función principal de Alimentación.

## Archivos modificados/nuevos

- `index.html` — estructura semántica y referencia de E13.
- `js/68-nutrition-guided-layout-e13.js` — divulgación progresiva, agrupación de herramientas y guía de primera comida.
- `css/95-nutrition-guided-layout-e13.css` — estilos limitados al panel de Alimentación.
- `tests/nutrition-guided-layout-e13.test.cjs` — pruebas estructurales.
- `tests/e13_progressive_disclosure_browser_audit.py` — auditoría Chromium con datos simulados.

## Instalación desde E12

Reemplazá `index.html` y agregá estos dos archivos respetando sus rutas:

- `js/68-nutrition-guided-layout-e13.js`
- `css/95-nutrition-guided-layout-e13.css`

No hace falta ejecutar SQL ni sustituir módulos de Entrenamiento, Agenda o Calendario. Hacé una copia local de la versión actual antes de publicar el cambio.

## Validación ejecutada

- `node --test tests/*.test.cjs`: **100 pruebas aprobadas**.
- `python tests/e13_progressive_disclosure_browser_audit.py --screenshots`: **sin fallos en 320×740, 390×844, 768×1024 y 1366×768**.
- Auditorías de regresión E6, E7, E10 y E12: aprobadas.
- 69 archivos JavaScript sin errores de sintaxis.
- 95 hojas CSS con llaves equilibradas.
- 529 IDs del HTML sin duplicados y todas las referencias locales resueltas.

Las pruebas Chromium simulan comidas y botones de herramientas; no llaman a Supabase. No sustituyen la comprobación final en un teléfono físico.

## Prueba manual recomendada

Ver `tests/MANUAL-GUIDED-LAYOUT-E13-CHECKLIST.md`.
