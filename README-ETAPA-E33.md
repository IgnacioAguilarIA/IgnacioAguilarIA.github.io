# AgendaFICH E33 — Combinar plantillas semanales con días ocupados

## Objetivo

E32 guardaba y aplicaba plantillas semanales, pero omitía por completo cualquier día de destino que ya tuviera comidas. Esa opción sigue siendo el comportamiento predeterminado. E33 añade una opción explícita para combinar la plantilla con esos días, agregando solo las comidas faltantes y conservando cada comida que ya existía.

## Qué incorpora

- Casilla opcional **«Combinar también en días ocupados»**, desactivada por defecto.
- La vista previa informa cuántas comidas se agregarán, cuántos días ocupados se combinarán, qué comidas de plantilla ya estaban aplicadas y qué días se omitirán.
- El modo combinar agrega las comidas de plantilla que faltan junto a las ya existentes; no actualiza, reemplaza ni elimina registros.
- Cambiar la opción invalida la vista previa anterior y exige generarla otra vez antes de confirmar.
- La confirmación vuelve a consultar el plan y rechaza una vista previa obsoleta si hubo cambios concurrentes.
- Las claves de operación de plantilla siguen siendo estables para evitar duplicados en reintentos.
- Diseño adaptable, foco visible, compatibilidad con movimiento reducido y colores forzados.

## Alcance técnico

- Modificado: `js/63-nutrition-week-plan-editor.js`.
- Modificado: `index.html` para cargar la nueva hoja y renovar la versión de caché del editor.
- Agregado: `css/114-nutrition-week-template-merge-e33.css`.
- Agregadas pruebas unitarias y de navegador E33; ajustados los tests históricos que comprueban la versión de caché del editor.
- **No requiere migraciones SQL nuevas.** Utiliza la estructura E32 existente para las plantillas semanales.
- No se modificaron scripts SQL ni archivos existentes de JavaScript/CSS de Entrenamiento.

## Pruebas

El registro de validación entregado (`E33-VALIDACION.txt`) detalla los resultados. Las pruebas automatizadas y de navegador usan datos simulados; la comprobación con la instancia real de Supabase y dos cuentas reales sigue siendo un paso manual antes de publicar en producción.
