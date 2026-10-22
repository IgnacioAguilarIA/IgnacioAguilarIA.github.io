# E39 — Revisión consolidada de cambios de plantillas semanales

E39 agrega una revisión detallada, por comida, a la vista previa existente para aplicar plantillas de Alimentación. La revisión resume cuántas comidas se agregarán, ya están aplicadas o se omitirán; cuántos días de destino están ocupados; cuántas comidas existentes se preservarán; y cuántos ingredientes o resúmenes nutricionales requieren revisión.

Antes de confirmar, se puede desplegar el detalle de cada comida: día de origen y destino, tipo de comida, hora, estado de aplicación, comidas existentes que se conservarán y advertencias por cantidades desconocidas o nutrientes incompletos. En días omitidos, la revisión señala explícitamente el motivo y los registros que quedarán intactos. La vista previa sigue siendo de solo lectura y los datos desconocidos no se convierten en cero.

## Seguridad y compatibilidad

- La revisión se calcula a partir de la misma vista previa validada; no efectúa escrituras.
- La confirmación continúa revisando la firma del plan y la versión de la plantilla antes de guardar.
- Las comidas ya aplicadas no se cuentan como nuevas ni se duplican.
- Los días ocupados aparecen en el resumen tanto cuando se combinan como cuando se omiten por la configuración segura.
- El detalle es plegable para no saturar la pantalla y usa texto escapado mediante `textContent`.
- El CSS contempla tema claro/oscuro, foco visible, movimiento reducido, colores forzados y vistas móviles.
- No requiere SQL nuevo ni cambia la estructura de Supabase.
- No modifica los archivos de ejecución de Entrenamiento.

## Archivos principales

- `index.html`: carga el nuevo CSS E39 y cambia la versión de caché del editor semanal a `e39`.
- `js/63-nutrition-week-plan-editor.js`: añade el cálculo de revisión y el render del detalle de cambios.
- `css/120-nutrition-week-template-change-review-e39.css`: nueva capa visual localizada.
- `tests/nutrition-week-template-change-review-e39.test.cjs`: pruebas puras para los resúmenes, conflictos, datos incompletos y ausencia de mutaciones.
- `tests/e39_week_template_change_review_browser_audit.py`: auditoría real en Chromium con proveedor Supabase simulado.

## Validación

- `node --test tests/*.test.cjs`: 186/186.
- Auditoría E39 en navegador: 42/42.
- Regresiones E38, E37 y E36: 33/33, 26/26 y 21/21.
- E35, E34, E33, E32 y E31: 33/33, 25/25, 19/19, 13/13 y 18/18.
- E30, E29, E28, E27, E26, E25, E24 y E23: 29/29, 20/20, 12/12, 15/15, 9/9, 5/5, 8/8 y 7/7.
- E20, E19, E18 y E17: 7/7, 8/8, 8/8 y 8/8.
- Sintaxis Node: 76/76 archivos JavaScript.
- Referencias estáticas locales en `index.html`: 195, sin recursos ausentes.

La auditoría visual histórica E16 no terminó durante esta ejecución porque Chromium quedó bloqueado al iniciar el caso; por ese motivo no se la cuenta como aprobada para esta entrega. Las pruebas de E39 y las regresiones específicas de plantillas sí finalizaron sin fallos.

Las pruebas de navegador usan datos controlados y un proveedor Supabase simulado. La conexión y seguridad de la instancia real deben verificarse manualmente antes de dar la entrega por certificada en producción.
