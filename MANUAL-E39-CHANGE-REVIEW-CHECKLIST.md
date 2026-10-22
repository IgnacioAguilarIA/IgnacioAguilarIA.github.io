# Lista de comprobación manual E39 — Revisión de cambios en bloque

- [ ] Abrí Alimentación → Planificar semana → Plantillas semanales → Elegir comidas.
- [ ] Marcá varias comidas, asigná al menos una a otro día y generá la vista previa.
- [ ] Confirmá que la vista previa no haya escrito todavía ninguna comida.
- [ ] Revisá el resumen de comidas por agregar, ya aplicadas, días ocupados, comidas existentes conservadas, cantidades desconocidas y comidas con nutrición incompleta.
- [ ] Abrí el detalle por comida y revisá día de origen, día de destino, tipo y hora.
- [ ] En un día ocupado, comprobá que se indique qué comidas existentes se conservarán sin cambios o que se omitirá el día en modo seguro.
- [ ] Comprueba los avisos de ingredientes sin cantidad y nutrientes incompletos; no deben mostrarse como cero.
- [ ] Cambiá una casilla o un día de destino después de previsualizar. La vista previa anterior debe invalidarse.
- [ ] Generá una vista previa nueva y confirma que solo se agreguen las comidas elegidas.
- [ ] Vuelve a previsualizar la misma selección y verifica que no se creen duplicados.
- [ ] Repetí en móvil (390 px o similar), tema claro y tema oscuro, sin desbordamiento horizontal.
- [ ] En entorno de prueba, modifica el destino desde una segunda sesión entre vista previa y confirmación; debe rechazarse el cambio obsoleto.
- [ ] Comprueba la persistencia en tu Supabase real y el aislamiento con dos cuentas de prueba antes de publicar a todos.
