# E40 — Estimación del impacto en la lista de compras

## Objetivo

La revisión consolidada de plantillas semanales ahora incluye una estimación de cómo cambiaría la lista de compras si se aplicara la propuesta de comidas. Esto conecta la planificación con las compras sin convertir la vista previa en una escritura.

## Qué incorpora

- Calcula una proyección a partir del plan actual más las comidas propuestas.
- Resume productos nuevos, actualizados, reactivados, pendientes que se archivarían, productos ya comprados cuya cantidad cambiaría y cantidades desconocidas.
- Detalla las cantidades anteriores y proyectadas cuando se pueden comparar con seguridad.
- Si el módulo de despensa está disponible, incluye las faltas estimadas después de considerar existencias; si no está disponible, lo informa y conserva una proyección completa sin descontar stock.
- Antes de confirmar la aplicación de una plantilla, vuelve a leer la firma de la lista de compras. Si la lista cambió desde la vista previa, bloquea la operación y solicita generar una vista previa nueva.
- La función de estimación es de solo lectura: no cambia el plan, la lista de compras, la despensa ni las preferencias.
- El aspecto visual está aislado en una hoja CSS nueva, adaptable a móvil y con soporte para temas claro/oscuro, foco visible, movimiento reducido y colores forzados.

## Comportamiento importante

La proyección utiliza el plan actual más las comidas que se propone añadir. No modifica la lista de compras en el acto de aplicar una plantilla. Una vez confirmada la planificación, abrí **Lista de compras** y utilizá el flujo existente para generar/revisar y confirmar los cambios de la lista.

Las cantidades desconocidas no se tratan como cero. Una advertencia sobre cantidad, despensa o conflicto comprado requiere revisión; no se inventa una cantidad para completar el cálculo.

## Archivos de ejecución modificados

- `index.html`: actualiza la versión de caché del módulo de compras y del editor semanal, y carga el CSS E40.
- `js/62-nutrition-week-planner-shopping.js`: añade la estimación de impacto y la firma de lista de solo lectura.
- `js/63-nutrition-week-plan-editor.js`: incorpora la estimación a la revisión de la plantilla y bloquea la confirmación si cambió la lista desde la vista previa.
- `css/121-nutrition-week-template-shopping-impact-e40.css`: nuevos estilos aislados.

No hay migraciones SQL nuevas. No se modifican archivos de ejecución de Entrenamiento.

## Pruebas

- `tests/nutrition-week-template-shopping-impact-e40.test.cjs`
- `tests/e40_week_template_shopping_impact_browser_audit.py`
- `tests/artifacts/e40/weekly-template-shopping-impact-browser-audit.json`
- `tests/MANUAL-E40-SHOPPING-IMPACT-CHECKLIST.md`
- `tests/artifacts/e40/weekly-template-change-review-mobile-light.png`
- `tests/artifacts/e40/weekly-template-change-review-mobile.png`

La auditoría de navegador usa proveedores controlados. No certifica por sí sola la conexión a la instancia real de Supabase.
