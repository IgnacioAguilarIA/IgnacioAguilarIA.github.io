# Lista de comprobación de sincronización real (cuenta de prueba)

Este procedimiento se ejecuta manualmente en la aplicación publicada porque los tests locales no tienen acceso a la sesión real de Supabase.

- [ ] Usar una cuenta de prueba sin datos importantes.
- [ ] Crear una comida temporal y añadir un alimento detallado con unidad/conversión válida.
- [ ] Marcar «Consumir», desmarcar y volver a marcar; recargar y comprobar que prevalezca la última acción.
- [ ] Revisar el historial: como máximo una entrada por usuario, alimento y fecha según la restricción existente.
- [ ] Activar modo Offline en DevTools, cambiar el estado y confirmar que la interfaz lo muestre pendiente, no como sincronizado.
- [ ] Volver Online y usar «Reintentar sincronización»; comprobar que la cola solo se limpia tras confirmación.
- [ ] En lo posible, cortar la respuesta de red después de enviar la petición; reintentar y comprobar que no duplica el historial.
- [ ] Iniciar sesión en una segunda cuenta de prueba y confirmar el aislamiento de comidas, alimentos propios, preferencias, recetas e historial.
- [ ] Verificar que los cambios de una cuenta no actualicen estados ni mensajes de sincronización de la otra.
- [ ] Eliminar los datos temporales de prueba y confirmar que los datos personales reales no cambiaron.

No compartir contraseñas, tokens de sesión, service_role, nombres de alimentos personales ni IDs privados al enviar resultados.

## Copia y restauración de Alimentación (Etapa E1)

Ejecutar solamente con una cuenta de prueba y con una copia JSON recuperable. No probar el modo reemplazo sobre la cuenta personal como primer ensayo.

- [ ] Exportar una copia completa y confirmar que incluye `backup_format: agenda-fich-full-backup`, `backup_version: 3`, las seis colecciones nutricionales y `nutrition_local`.
- [ ] Abrir el archivo JSON en un editor local y verificar que el total de comidas, detalles, alimentos propios, recetas e historial sea coherente con la cuenta de prueba. No compartir el contenido privado del archivo.
- [ ] Intentar importar un JSON que no sea una copia Agenda FICH con Alimentación seleccionada. Debe rechazarse antes de cualquier escritura.
- [ ] Con un duplicado de prueba, quitar una colección nutricional del JSON y elegir reemplazar. La app debe abortar y mantener intactos los datos anteriores.
- [ ] Importar una copia completa en modo reemplazo dentro de una cuenta de prueba y verificar que la vista previa muestre cantidades antes de confirmar.
- [ ] Tras la restauración, comparar cantidades y relaciones: comida ↔ detalle, detalle ↔ alimento personal, receta ↔ ingredientes e historial ↔ fecha/alimento.
- [ ] Crear intencionalmente un consumo pendiente en la cuenta de prueba, exportar e importar la copia, recuperar conexión y confirmar que los IDs pendientes se remapean y el reintento se resuelve sin duplicar el historial.
- [ ] Repetir la prueba con una segunda cuenta de prueba y confirmar que no se mezclen datos ni estados de sincronización.
- [ ] Recargar enseguida y abrir la misma cuenta en otro dispositivo/navegador. Verificar que los registros restaurados persistan en Supabase.
- [ ] No dar la restauración por transaccional: esta etapa reduce riesgos, pero sigue usando varias solicitudes. Interrumpirla intencionalmente solo en un entorno desechable hasta implementar y validar el RPC transaccional.

No enviar contraseñas, tokens, claves `service_role`, correos personales, alimentos privados ni el JSON completo del respaldo. Para informar resultados, alcanza con indicar qué prueba pasó/falló, el mensaje técnico sin datos personales y los conteos generales.
