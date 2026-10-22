# Lista manual E37 — Cambiar el día de destino de comidas

Hacer la primera prueba en una rama de GitHub y con una semana de datos que pueda modificarse.

- [ ] Guardar una plantilla que tenga por lo menos dos comidas en días diferentes.
- [ ] Abrir Plantillas semanales → Elegir comidas y confirmar que cada selector empieza en el día original de la comida.
- [ ] Seleccionar solo una comida y cambiar su destino (por ejemplo, Lunes → Viernes). Confirmar que el resumen muestre el traslado y que aún no se haya escrito nada.
- [ ] Generar la vista previa. Confirmar que la comida aparece bajo el día nuevo y conserva horario, tipo, ingredientes, cantidades, nutrientes y metadatos disponibles.
- [ ] Cambiar el selector después de la vista previa. Confirmar que la vista previa anterior se invalida y no se puede aplicar hasta generar una nueva.
- [ ] Regenerar la vista previa y confirmar. Verificar que la comida se agregue en el día elegido y que las comidas existentes no se borren ni cambien.
- [ ] Reasignar una segunda comida al mismo destino. Confirmar que ambas se agreguen al final del orden existente sin reemplazar los registros previos.
- [ ] Intentar aplicar una comida de la misma plantilla a otro día en la misma semana después de que ya se aplicó. El sistema debe detectar el conflicto y no mover ni duplicar silenciosamente el registro.
- [ ] Comprobar alimentos con cantidades o nutrientes desconocidos: deben seguir como desconocidos, no convertirse en cero.
- [ ] Simular o provocar un cambio de destino desde otra sesión después de la vista previa. Confirmar que se rechace la operación obsoleta y se mantenga el cambio remoto.
- [ ] Probar en móvil (~390 px), escritorio, tema claro y oscuro; comprobar teclado, foco visible, etiquetas accesibles y ausencia de desplazamiento horizontal.
- [ ] Con Supabase real, verificar que la cuenta correcta puede leer/escribir el plan y que otra cuenta no puede acceder a sus datos.
