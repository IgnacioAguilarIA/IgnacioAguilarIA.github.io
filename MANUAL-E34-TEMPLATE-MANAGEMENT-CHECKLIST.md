# Lista manual E34 — gestión de plantillas

- [ ] Abrir Plantillas semanales en celular y escritorio.
- [ ] Expandir Detalles: confirmar el número de días, comidas, ingredientes, cantidades por revisar y comidas con nutrición incompleta.
- [ ] Renombrar una plantilla y comprobar que mantiene el ID de plantilla, fecha de creación, IDs de sus comidas y snapshots.
- [ ] Intentar guardar un nombre vacío y uno de más de 80 caracteres; deben rechazarse sin escribir.
- [ ] Intentar renombrar con otro nombre existente usando diferencias solo de mayúsculas o tildes; debe rechazarse.
- [ ] Duplicar una plantilla. Confirmar que el nombre tenga `(copia)`, que el contenido sea equivalente y que el ID de plantilla y todos los IDs de elementos sean distintos.
- [ ] Duplicar otra vez y confirmar que el nombre sea único (por ejemplo, `(copia 2)`).
- [ ] Alcanzar el límite de 12 plantillas en una cuenta de prueba y comprobar que duplicar quede deshabilitado y que la validación también rechace la operación.
- [ ] Desde una segunda sesión, cambiar las preferencias entre la carga y el guardado. La primera sesión debe rechazar el cambio desactualizado.
- [ ] Confirmar que las comidas ya aplicadas no se alteren al renombrar, duplicar o eliminar una plantilla.
- [ ] Revisar modo claro/oscuro, foco visible, movimiento reducido y anchos de 320, 390 y 768 px.
- [ ] Verificar en Supabase real la separación entre dos cuentas distintas antes de publicar a todos los usuarios.
