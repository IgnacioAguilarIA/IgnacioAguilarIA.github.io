# Agenda FICH — Etapa E8: guardado idempotente y recuperación de comidas

## Objetivo

Evitar que un reintento de guardado después de una respuesta incierta de red cree una segunda fila para la misma comida, y permitir recuperar el borrador en el mismo navegador después de recargar la página. Se limita a Alimentación.

## Cambios

- Cada nuevo borrador recibe un UUID de operación estable.
- La creación usa `upsert` por `(user_id, save_request_id)` y un índice único en Supabase. Reintentar con la misma clave devuelve la misma comida en vez de insertar otra fila.
- Antes de contactar Supabase se guarda localmente una copia del formulario y de los alimentos estructurados, asociada a la cuenta activa y al día.
- Si el navegador se recarga o el resultado de una petición queda incierto, al volver a abrir una comida nueva se puede recuperar ese borrador y reintentar con la misma clave.
- La marca local se elimina solo tras confirmar el guardado de la comida y el guardado de sus alimentos estructurados. Si falla la sincronización de detalle, el borrador permanece disponible.
- Un borrador pendiente de otra cuenta/día o una clave distinta no se sobrescribe silenciosamente.
- Se refuerza el guardado frente a cambios de cuenta mientras el formulario está abierto.
- No cambia cálculos nutricionales, historial de consumo, tablas de Entrenamiento, Agenda ni Calendario.

## Archivos

Si ya está instalada E7, reemplazar `js/03-inline-script-03.js`, agregar `js/67-nutrition-meal-save-safety-e8.js`, y agregar `sql/27-nutrition-meal-save-idempotency.sql` más `sql/28-nutrition-meal-save-idempotency-postcheck.sql` al repositorio.

El `index.html` incluido agrega una referencia al módulo 67. No agregues esa referencia dos veces.

## Instalación de Supabase — obligatoria

1. Exportá una copia de seguridad antes de cambiar la base.
2. Ejecutá una vez `sql/27-nutrition-meal-save-idempotency.sql` en Supabase SQL Editor.
3. Ejecutá `sql/28-nutrition-meal-save-idempotency-postcheck.sql` y comprobá que `save_request_id_uuid_exists`, `unique_idempotency_index_valid`, `rls_enabled` y los permisos `authenticated_can_select/insert/update` sean `true`, y `duplicate_nonnull_keys` sea `0`.
4. Subí el código después de que la migración haya terminado correctamente.

La migración es aditiva: las comidas anteriores quedan con `save_request_id = NULL`. No elimina ni reescribe datos anteriores y se cancela si la tabla no existe o si RLS no está activo. No se ejecutó contra una instancia Supabase real durante el desarrollo de esta entrega.

## Pruebas automatizadas

- `tests/nutrition-meal-save-idempotency-e8.test.cjs`: valida la clave, el almacenamiento y la recuperación por cuenta/día, el rechazo de borradores incompatibles, la limpieza solo de la operación confirmada, el `upsert` y la migración.
- Ejecutar la regresión completa desde la raíz con `node --test tests/*.test.cjs`.

## Pruebas manuales requeridas

Ver `tests/MANUAL-MEAL-SAVE-E8-CHECKLIST.md`. Hay que probar una pérdida real de conexión y confirmar el resultado en Supabase; las suites locales no pueden certificar la disponibilidad ni los permisos actuales de producción.
