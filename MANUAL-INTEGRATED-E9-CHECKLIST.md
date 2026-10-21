# Etapa E9 — checklist manual de integración y recuperación

> Ejecutá estas pruebas con una cuenta de prueba y datos descartables. No las uses inicialmente con información importante. E9 no requiere una migración SQL nueva, pero sí requiere E8 (SQL 27) instalado y validado (SQL 28).

## A. Guardado principal y detalle de alimentos

- [ ] Crear una comida con dos alimentos detallados, guardarla y recargar. Deben recuperarse la comida y ambos alimentos, una sola vez.
- [ ] Editar la comida y cambiar cantidad/unidad de un alimento. Guardar y recargar; verificar que quede la nueva selección sin entradas repetidas.
- [ ] Abrir el formulario, agregar alimentos y cambiar de cuenta antes de guardar. El formulario debe rechazar el envío bajo la sesión nueva.
- [ ] Simular o probar desconexión entre la confirmación de la comida y el guardado de sus detalles. La interfaz debe informar que la comida principal existe pero el detalle no quedó confirmado; no debe mostrar éxito completo.

## B. Duplicar comida

- [ ] Duplicar una comida con ingredientes, cambiar día, tipo y horario; comprobar que la original no cambia.
- [ ] Confirmar que los alimentos de la copia se inician con `consumed=false` y `consumed_at=null`.
- [ ] Si se pierde la respuesta durante la copia, dejar que la ventana mantenga el error, volver a intentar con la misma operación y comprobar que no aparece una segunda comida.
- [ ] Recargar antes de reintentar y abrir de nuevo la duplicación de la misma comida de origen. El diálogo debe recuperar el destino guardado en el diario; los campos quedan bloqueados hasta completar el intento.
- [ ] Intentar iniciar una duplicación diferente mientras hay otra pendiente. La aplicación debe advertir el conflicto y no reemplazar el diario.

## C. Repetir un día

- [ ] Copiar un día con varias comidas y confirmar que el plan origen no se modifica.
- [ ] Si el destino ya tiene comidas, confirmar que se agregan copias sin eliminar ni sobrescribir las existentes.
- [ ] Simular pérdida de respuesta tras guardar una comida del lote. Reabrir «Repetir un día»: origen y destino deben recuperarse y el reintento no debe duplicar la fila ya guardada.
- [ ] Provocar un error al guardar detalles de una copia. Verificar que el lote permanezca pendiente y que la app no haga una limpieza automática incierta.
- [ ] Confirmar que las comidas copiadas no crean registros de consumo en el historial ni descuentan existencias de la despensa.

## D. Deshacer eliminación

- [ ] Eliminar una comida con varios alimentos y pulsar «Deshacer» dentro del plazo disponible.
- [ ] Verificar que se restauren la comida y los alimentos con los IDs originales.
- [ ] Si una respuesta de restauración se pierde después de que Supabase haya escrito, pulsar «Reintentar restauración». La segunda ejecución debe detectar las filas ya restauradas y no duplicarlas ni borrarlas para compensar.
- [ ] Si ya existe una fila con el mismo ID pero datos diferentes, comprobar que la aplicación se detenga y no sobrescriba ese registro.

## E. Cuentas y regresión

- [ ] Con dos cuentas de prueba, cambiar de cuenta durante la carga o guardado. Ninguna operación debe continuar bajo la cuenta nueva.
- [ ] Probar creación, edición, consumo, desmarcado, historial, recetas, lista de compras y despensa después de las operaciones anteriores.
- [ ] Confirmar que Entrenamiento, Agenda, Calendario, autenticación y navegación siguen funcionando.
- [ ] Revisar consola del navegador y resultados de SQL 28 después de crear una comida nueva; `save_request_id` debe asignarse a los nuevos registros.

## Qué registrar si falla

Anotá el paso, la cuenta de prueba (sin compartir contraseñas ni tokens), el mensaje exacto y el ID de la comida si aparece. No repitas una operación que quedó en estado incierto con una clave nueva. Primero reanudá la operación pendiente o verificá el registro en Supabase.
