# Etapa E14 — Estados visuales y recuperación clara

## Objetivo

Unificar cómo Alimentación comunica carga, vacío, éxito, avisos y errores. La prioridad es que el usuario no confunda una consulta fallida con una lista vacía y tenga una acción segura cuando existe un camino de reintento. No se cambian los cálculos nutricionales, el esquema de Supabase ni las funciones de otras secciones.

## Cambios

- **Estado de carga de comidas explícito.** `loadNutritionMeals` distingue éxito, sesión ausente y errores tanto de respuesta de Supabase como de excepciones de red. El evento `agenda:nutrition-meals-loaded` incluye estado, cuenta, día, error resumido y si se pudo usar una caché existente.
- **Error de carga del día sin falsos vacíos.** Si falla la consulta, Alimentación muestra una tarjeta de error clara. Cuando hay comidas en caché, aclara que pueden estar desactualizadas; cuando no, no afirma que el día esté vacío. La guía de primera comida se oculta mientras el estado de carga sea desconocido.
- **Reintento seguro de la carga del día.** El botón vuelve a utilizar `selectNutritionDay` y la carga existente; verifica que la cuenta siga siendo la misma, se deshabilita mientras reintenta y refleja si falta conexión. No inserta ni borra registros.
- **Estados coherentes en los diálogos.** Los estados existentes de recetas, alimentos propios, historial, estadísticas, calidad, rutinas y planificación reciben una clasificación visual común: cargando, éxito, vacío, aviso o error. El texto original se conserva.
- **Reintentos solo donde existe una ruta segura.** Historial, recetas, alimentos propios, estadísticas, informe de calidad y repetir día usan controles existentes para volver a intentar. No se agregan botones genéricos a guardados o eliminaciones que no tengan una ruta de reintento demostrablemente segura.
- **Accesibilidad.** Los estados conservan anuncios `aria-live`, indican `aria-busy` durante carga, respetan movimiento reducido y alto contraste, y el botón de reintento móvil tiene un mínimo de 44 px.
- **Ámbito limitado.** El observador trabaja solo con selectores y diálogos nutricionales. Los estados de Entrenamiento, Agenda y Calendario no se decoran ni se cambian.

## Archivos modificados/nuevos

- `index.html` — referencia a la hoja y el módulo E14.
- `js/03-inline-script-03.js` — estado explícito de la carga de comidas.
- `js/68-nutrition-guided-layout-e13.js` — evita mostrar el onboarding o el mensaje vacío mientras la carga remota falló.
- `js/69-nutrition-feedback-states-e14.js` — clasificación visual, reintentos y estado de error del día.
- `css/96-nutrition-feedback-states-e14.css` — presentación de estados y controles de reintento.
- `tests/nutrition-feedback-states-e14.test.cjs` — pruebas estructurales.
- `tests/e14_feedback_states_browser_audit.py` — auditoría Chromium con datos sintéticos.

## Instalación desde E13

1. Hacé una copia de tu proyecto actual.
2. Reemplazá `index.html`, `js/03-inline-script-03.js` y `js/68-nutrition-guided-layout-e13.js`.
3. Agregá `js/69-nutrition-feedback-states-e14.js` y `css/96-nutrition-feedback-states-e14.css` respetando sus rutas.
4. No hace falta ejecutar SQL ni reemplazar módulos de Entrenamiento, Agenda o Calendario.

## Validación ejecutada

- Las 30 suites Node se ejecutaron en tres grupos: **108 pruebas aprobadas en total** (63 + 33 + 12). La suite E14 se volvió a ejecutar después del ajuste de tabletas y pasó.
- Se probó el error de carga, la supresión del falso estado vacío, el reintento mediante el selector de día, reintento de historial, ausencia de decoración fuera de Alimentación, ausencia de desbordamiento y botón táctil de 44 px.
- `python tests/e14_feedback_states_browser_audit.py`: **4 de 4 viewports aprobados tras el ajuste final** (320×740, 390×844, 768×1024, 1366×768). Se comprobó también que el botón de reintento mida 44 px en móvil y tableta táctil, que no haya desbordamiento y que los estados de Entrenamiento permanezcan intactos.
- Las regresiones anteriores E6, E7, E12 y E13 se validaron en ejecuciones separadas durante esta etapa.
- Las pruebas usan datos sintéticos y no llaman a Supabase; no sustituyen una prueba con cuenta real.

## Prueba manual recomendada

Ver `tests/MANUAL-FEEDBACK-STATES-E14-CHECKLIST.md`.
