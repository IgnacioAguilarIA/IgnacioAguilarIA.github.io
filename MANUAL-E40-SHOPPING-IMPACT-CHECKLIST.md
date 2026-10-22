# Lista de verificación manual E40 — Impacto de compras

## Preparación
- [ ] Aplicar E40 en una rama de pruebas derivada de E39.
- [ ] Abrir la app con conexión y confirmar que sesión y semana se cargan normalmente.
- [ ] Abrir el editor semanal de Alimentación y una plantilla con varias comidas e ingredientes.

## Vista previa
- [ ] Generar la vista previa de aplicación.
- [ ] Comprobar que la revisión consolidada muestra el impacto estimado de compras.
- [ ] Verificar productos nuevos, cantidades actualizadas, productos reactivados y productos pendientes que quedarían archivados.
- [ ] Verificar avisos de productos ya comprados cuya cantidad cambiaría.
- [ ] Verificar que cantidades desconocidas no se muestran como cero.
- [ ] Verificar que el aviso de despensa indique si se aplicó o no el descuento de existencias.
- [ ] Confirmar que abrir, cerrar o desplegar detalles de la vista previa no escriba en el plan ni en la lista de compras.

## Concurrencia
- [ ] Con la vista previa abierta, modificar el estado o la cantidad de un producto desde otra sesión.
- [ ] Intentar confirmar la plantilla original.
- [ ] Comprobar que la app invalida la vista previa, no escribe el plan y pide generar una nueva revisión.
- [ ] Volver a previsualizar y comprobar que la estimación refleja el estado de lista actualizado.

## Aplicación y lista de compras
- [ ] Aplicar una plantilla después de una vista previa válida.
- [ ] Confirmar que se agregaron las comidas previstas y se conservaron las existentes.
- [ ] Confirmar que aplicar la plantilla no cambió directamente los productos de la lista de compras.
- [ ] Abrir la función existente **Lista de compras**, generar su propia vista previa y confirmar los cambios por separado.

## Accesibilidad y cuentas
- [ ] Probar modo claro y oscuro.
- [ ] Probar vista móvil y verificar ausencia de desbordamiento horizontal.
- [ ] Probar navegación por teclado y foco visible.
- [ ] En un entorno de desarrollo, verificar dos cuentas separadas para comprobar aislamiento de plan, lista y preferencias.
