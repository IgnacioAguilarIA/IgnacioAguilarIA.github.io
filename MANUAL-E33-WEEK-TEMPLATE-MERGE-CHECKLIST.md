# Lista manual E33 — Combinar plantilla en días ocupados

- [ ] Con una plantilla guardada y un día destino ocupado, dejá desactivada la casilla. La vista previa debe seguir omitiendo el día completo.
- [ ] Activá «Combinar también en días ocupados». La vista previa anterior debe desaparecer y no debe escribirse nada.
- [ ] Generá una vista previa nueva y revisá que diferencie los días omitidos de los días combinados y muestre cuántas comidas existentes se conservan.
- [ ] Confirmá una combinación. Verificá que la comida que ya existía permanezca idéntica y que solo se agreguen las comidas faltantes.
- [ ] Volvé a previsualizar y aplicar la misma plantilla. No deben crearse duplicados.
- [ ] Antes de confirmar, modificá la semana desde otra sesión. La operación debe rechazarse y pedir una nueva vista previa.
- [ ] Repetí en móvil (390 px o menos) y en escritorio; comprobá que no haya desbordamiento horizontal y que la casilla sea accesible por teclado.
- [ ] Regenerá la vista previa de compras por separado si querés reflejar las comidas añadidas.
- [ ] Probá con dos cuentas reales para confirmar el aislamiento de plantillas de Supabase antes de desplegar a producción.

Nota: los checks automatizados de E33 emplean un proveedor Supabase simulado; esta lista cubre el paso final en el entorno real.
