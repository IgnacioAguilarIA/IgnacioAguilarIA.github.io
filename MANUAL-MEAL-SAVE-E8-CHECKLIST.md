# E8 — checklist manual de guardado y recuperación

## Preparación segura

- Usar una cuenta de prueba y el mismo navegador/dispositivo.
- Confirmar que hay una copia de seguridad recuperable.
- Ejecutar `sql/27-nutrition-meal-save-idempotency.sql` una sola vez y revisar `sql/28-nutrition-meal-save-idempotency-postcheck.sql`.

## Pruebas

1. Crear una comida nueva con uno o más alimentos estructurados y guardarla. Verificar que aparece una sola fila en `nutrition_meals`, con un `save_request_id` UUID, y que los detalles aparecen en `nutrition_meal_items`.
2. Pulsar Guardar repetidamente mientras se guarda. Debe bloquearse el doble envío y quedar una sola comida.
3. Con una cuenta de prueba, activar/desactivar la conexión o usar DevTools para simular una respuesta interrumpida al guardar. No hacerlo con datos importantes. Reintentar manteniendo la ventana abierta: la misma clave no debe duplicar la comida.
4. Repetir en una comida de prueba y recargar/cerrar el navegador después de un intento cuyo resultado no quedó claro. Al abrir “Agregar comida” para el mismo día y la misma cuenta, debe ofrecer recuperar el borrador anterior. Aceptar y volver a guardar; la comida debe quedar una sola vez y debe conservar los alimentos estructurados.
5. Una vez confirmado el guardado completo, abrir otra comida nueva el mismo día. No debe ofrecer el borrador anterior; se debe permitir un nuevo UUID.
6. Cambiar de cuenta mientras el formulario está abierto. El envío desde el formulario anterior debe bloquearse y no asociar su borrador a la cuenta nueva.
7. Provocar un error al guardar los alimentos estructurados después de confirmar la comida principal. La interfaz debe conservar el borrador y permitir reintentar sin crear una segunda comida.
8. Revisar el postcheck: RLS activo, índice único válido, permisos de SELECT/INSERT/UPDATE de `authenticated`, cero claves duplicadas.
9. Abrir Entrenamiento, Agenda y Calendario y confirmar que el comportamiento y la navegación siguen igual.

## Criterio de aprobación

No basta con que el mensaje diga “guardado”: verificar filas reales en Supabase después de cada escenario, incluyendo el mismo `id` al reintentar una clave y exactamente una fila por operación. El desarrollo local no puede certificar esta prueba de producción.
