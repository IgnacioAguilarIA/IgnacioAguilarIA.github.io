# Etapa E37 — Asignación de día de destino por comida

E37 amplía la aplicación selectiva de E36: al elegir comidas de una plantilla semanal, cada comida tiene un selector de día de destino. La hora y el tipo de comida se conservan; solo se cambia el día.

## Comportamiento

- Cada selector comienza en el día original de la comida.
- El resumen indica cuántas comidas seleccionadas se moverán a un día diferente.
- La vista previa detalla el traslado (por ejemplo, `Avena: Lunes → Viernes`) y organiza las cantidades por día de destino.
- Cambiar la selección o un día de destino invalida la vista previa anterior. No se escribe nada hasta confirmar una vista previa nueva.
- Las comidas existentes en el destino se conservan. Las comidas seleccionadas se agregan al final del orden del día.
- Se conservan ingredientes, snapshots nutricionales, procedencia y calidad; los valores desconocidos siguen siendo desconocidos.
- Si la misma comida de la plantilla ya fue aplicada en otro día de esa semana, la operación se bloquea en lugar de moverla o duplicarla silenciosamente. Si se detecta un cambio concurrente, se solicita una nueva vista previa.
- No modifica el contenido de la plantilla original. No necesita migraciones SQL nuevas.

## Archivos modificados o añadidos

- `index.html`: carga el nuevo CSS y actualiza la versión de caché del editor.
- `js/63-nutrition-week-plan-editor.js`: valida, previsualiza y aplica días de destino personalizados.
- `css/118-nutrition-week-template-target-day-e37.css`: controles adaptables, foco visible, tema claro/oscuro, contraste forzado y movimiento reducido.
- `tests/nutrition-week-template-target-day-e37.test.cjs` y `tests/e37_week_template_target_day_browser_audit.py`: pruebas de lógica y de navegador.

## Validación y límites

La suite local y las auditorías automáticas se ejecutan con datos controlados. No equivalen a una certificación del Supabase real de producción; antes de publicar, hacer la lista manual incluida en `tests/MANUAL-E37-WEEK-TEMPLATE-TARGET-DAY-CHECKLIST.md`. E37 no modifica archivos JavaScript/CSS existentes de Entrenamiento ni añade SQL.

Informe de validación y hashes: `E37-VALIDACION.txt` y `E37-MANIFEST.txt`.
