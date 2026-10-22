# Lista manual E41 — Después de aplicar una plantilla, revisar compras

## Flujo normal

- [ ] Abrir Plantillas semanales y aplicar una plantilla a una semana de pruebas.
- [ ] Confirmar que se muestre el panel posterior al guardado.
- [ ] Confirmar que el mensaje diferencia con claridad «plan guardado» de «lista de compras aún sin modificar».
- [ ] Pulsar «Revisar compras».
- [ ] Verificar que el editor del plan se cierre antes de abrir el modal de compras.
- [ ] Comprobar que el selector de semana de compras corresponde al lunes de la semana aplicada.
- [ ] Comprobar que no se haya escrito en `nutrition_shopping_items` solo por abrir el panel.
- [ ] Generar la vista previa propia de compras y cancelar: la lista debe permanecer sin cambios.
- [ ] Repetir y confirmar la vista previa: solo entonces debe escribirse la actualización de compras.

## Accesibilidad y móvil

- [ ] Usar teclado para llegar al botón y activarlo.
- [ ] Verificar que no haya dos diálogos abiertos al mismo tiempo.
- [ ] Cerrar compras y comprobar que el foco vuelve al control que abre la planificación semanal.
- [ ] Revisar 390 px de ancho y tema claro/oscuro; no debe aparecer desplazamiento horizontal.
- [ ] Verificar el texto alternativo/status si compras no estuviera disponible.

## Prueba con dos sesiones (producción)

- [ ] Abrir el plan y compras en dos dispositivos/cuentas de prueba controladas.
- [ ] Cambiar la lista de compras en la segunda sesión antes de iniciar una vista previa en la primera.
- [ ] Verificar que una revisión activa no se cambie silenciosamente de semana y que se pida cancelar/revisar de nuevo cuando sea necesario.
- [ ] Confirmar que una cuenta no pueda leer o modificar compras de la otra.

Las pruebas de navegador incluidas automatizan la navegación con Supabase simulado; los puntos de producción requieren validación en tu instancia real.
