# Etapa E3 — checklist manual de despensa

## Antes de probar

1. En Supabase, confirmá que las etapas E2 estén instaladas: `nutrition_weekly_plan_items`, `nutrition_shopping_items` y las tablas de recetas utilizadas por la aplicación.
2. Exportá un respaldo de Alimentación y usá una cuenta de prueba para hacer los primeros ensayos.
3. Ejecutá `sql/23-nutrition-pantry.sql` en el SQL Editor de Supabase. Después ejecutá `sql/24-nutrition-pantry-postcheck.sql` y revisá que las tres tablas existan con RLS activo y las funciones estén concedidas solo a `authenticated`.
4. Publicá los archivos de runtime del paquete E3 y recargá la aplicación completamente.

## Pruebas funcionales

1. Abrí Alimentación → Despensa. Creá un lote de arroz de 500 g y verificá que aparezca en Inventario con la cantidad inicial.
2. Sumá 250 g y luego retirá 100 g. El stock esperado es 650 g. Abrí Movimientos y comprobá que se registraron los tres eventos con antes/después correctos.
3. Intentá retirar más cantidad de la disponible. Supabase debe rechazar la operación y el inventario no debe quedar negativo.
4. Creá un lote de leche de 0,5 L y planificá una receta que requiera 400 ml. En Faltantes debería calcular que no hace falta comprar leche. El inventario no debe descontarse por abrir esa vista.
5. Cambiá la necesidad a 700 ml: debe mostrar 200 ml como faltante. Generá la lista de compras y verificá que use el faltante, no la cantidad total.
6. Marcá el producto de la lista como comprado y aceptá agregarlo a la despensa. Debe aparecer como lote nuevo. Reintentá el mismo registro en un escenario de prueba: no debe duplicar la cantidad.
7. Cargá dos artículos con el mismo nombre pero estados crudo y cocido. El inventario de uno no debe cubrir la compra del otro. Repetí con gramos y mililitros.
8. Creá un lote vencido y otro que vence en los próximos siete días. La pantalla debe alertar y el lote vencido no debe reducir los faltantes.
9. En Uso de comidas, elegí una comida fechada con ingredientes y confirmá el uso. El sistema debe descontar lotes coincidentes (los que vencen antes primero), guardar los movimientos y mostrar cualquier ingrediente sin stock suficiente.
10. Volvé a confirmar la misma comida planificada. No debe descontar stock una segunda vez. Para corregir, registrá un movimiento explícito desde Ajustar stock.
11. Repetí la comprobación con una segunda cuenta autenticada. No deben verse ni modificarse artículos o movimientos de la primera cuenta.
12. Probá móvil: abrir/cerrar diálogo, teclado abierto, pestañas, formularios y botones táctiles.

## Reglas y límites intencionales

- Las existencias no se descuentan al planificar ni al generar la lista de compras.
- Solo al marcar una compra y aceptar se registra un lote de inventario. Si la cantidad o unidad de compra es desconocida, el sistema no inventa una cantidad.
- Solo se convierten g ↔ kg y ml ↔ L. Unidad/pieza, porción y paquete se mantienen separados; no hay conversión automática de volumen a masa.
- Las coincidencias de inventario requieren nombre, marca y preparación compatibles. No se adivina que un alimento con otro nombre o estado es equivalente.
- Los artículos vencidos y archivados no cubren necesidades. Los datos se conservan para consultar el historial.
- Cada comida fechada solo se puede descontar una vez automáticamente. La llamada de servidor es transaccional; si falla, no debería dejar una parte de los movimientos aplicados.
- Las pruebas locales no sustituyen la confirmación de RLS, RPC, transacciones y permisos reales en Supabase.
