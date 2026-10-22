# Lista manual de validación — Alimentación E28

Realizá estos pasos primero en una rama de prueba.

## Recuperar productos archivados

- [ ] Abrir la lista de compras de una semana que tenga al menos un producto archivado.
- [ ] Confirmar que «Ver archivados» muestre el número correcto y no incluya los archivados en el progreso.
- [ ] Restaurar un producto; debe volver a la lista activa como pendiente, sin marcarse como comprado.
- [ ] Confirmar que el resumen y el contador de archivados se actualicen tras la respuesta del servidor.
- [ ] Probar la semana sin archivados: el acceso a archivados debe desaparecer.

## Editar productos manuales

- [ ] Agregar un producto manual y editar nombre, cantidad, unidad y categoría.
- [ ] Confirmar que se actualiza el mismo registro (mismo ID e `item_key`) y no se crea un duplicado.
- [ ] Abrir edición, cambiar un campo y cancelar. El servidor y el listado deben conservar los valores anteriores.
- [ ] Marcar un producto manual como comprado: la opción «Editar» debe desaparecer mientras esté comprado.
- [ ] Los productos generados desde el plan no deben ofrecer edición manual.
- [ ] Probar cantidad vacía, negativa y superior al máximo: no debe guardarse.

## Protección ante concurrencia y cuentas

- [ ] Abrir edición en un dispositivo y cambiar el mismo producto desde otro antes de guardar. E28 debe rechazar la edición obsoleta y volver a cargar lo guardado por el servidor.
- [ ] Cambiar de semana durante la navegación: nunca debe editar un registro de otra semana.
- [ ] Con dos cuentas de prueba, verificar que cada cuenta solo puede recuperar/editar sus propios productos, según las políticas RLS de Supabase.
- [ ] Confirmar en Supabase que los errores de escritura se muestran como error y nunca como guardado confirmado.

## Móvil y PWA

- [ ] En un teléfono, abrir el editor y desplazarse hasta ver Guardar y Cancelar, con el teclado abierto y cerrado.
- [ ] Verificar que no haya desbordamiento horizontal, que el foco sea visible y que los botones puedan tocarse con comodidad.
- [ ] Si la PWA muestra recursos viejos, volver a abrir con conexión y comprobar que `js/62-nutrition-week-planner-shopping.js?v=e28` y `css/109-nutrition-shopping-recovery-e28.css?v=e28` sean las referencias servidas.

No ejecutes migraciones SQL por esta etapa: E28 no cambia el esquema de datos.
