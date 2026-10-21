# Etapa E9 — auditoría integrada y reintentos seguros

## Objetivo

Esta etapa revisa operaciones que usan más de un paso en Alimentación y evita tratar una respuesta perdida como si confirmara un fallo definitivo. Se conserva el alcance de Alimentación; no se modifica deliberadamente Entrenamiento, Agenda ni Calendario.

## Cambios incluidos

- `js/49-nutrition-persistence.js`: el guardado de alimentos detallados exige una cuenta activa y acepta explícitamente la cuenta dueña que inició el flujo. Rechaza una sesión cambiada, un identificador de comida vacío o una lista inválida; ya no devuelve `skipped:true` como éxito en esos casos.
- `js/03-inline-script-03.js`: pasa el propietario capturado al guardar el detalle de la comida. Si la sesión cambia entre guardar la cabecera y los alimentos, el intento queda incompleto y se informa.
- `js/67-nutrition-meal-save-safety-e8.js`: amplía la protección E8 con un diario local de operaciones multi-paso. El diario valida cuenta, tipo, ámbito, clave UUID y tamaño; solo permite una operación pendiente por tipo y cuenta y no deja sobrescribir una instantánea pendiente con otra.
- `js/53-nutrition-meal-copy.js`: duplicar una comida conserva su instantánea y usa una clave idempotente para la fila principal. El diario de recuperación permite reabrir el origen y reintentar la misma copia; los errores al refrescar la vista se separan del resultado del guardado para no reportar como fallida una copia que ya se confirmó. El diario se retira únicamente después de confirmar también los alimentos detallados.
- `js/59-nutrition-routine-tools.js`: repetir un día captura de antemano las comidas y detalles en un lote recuperable, valida el alcance/cuenta/claves de la instantánea, asigna una clave estable a cada comida y guarda mediante `upsert` idempotente. Si una parte falla, conserva el lote y no borra filas cuya respuesta pudo haberse perdido. Al reabrir la función, recupera origen y destino y reutiliza las mismas claves. «Deshacer eliminación» restituye la comida con su ID original, reconcilia los detalles por ID, inserta solo filas faltantes y no realiza borrados compensatorios ante una respuesta incierta; se detiene si encuentra datos existentes que difieren de la instantánea.

Los alimentos copiados comienzan sin marcarse como consumidos. Una copia no modifica la comida de origen y no crea entradas nuevas de consumo. Las cantidades, unidades, procedencia y estados de preparación de los ingredientes se conservan en la instantánea.

## Instalación

1. Hacé una copia de seguridad de Alimentación.
2. Confirmá que la migración E8 `sql/27-nutrition-meal-save-idempotency.sql` ya está instalada y que `sql/28-nutrition-meal-save-idempotency-postcheck.sql` informa columna UUID, índice único válido, RLS habilitado y permisos esperados. El CSV que compartiste muestra esas condiciones, por lo que **E9 no requiere una migración SQL nueva**.
3. Reemplazá en GitHub los cinco archivos de runtime listados al final, respetando las rutas. No hace falta modificar `index.html`, CSS ni SQL para E9.
4. Ejecutá las suites automatizadas y completá el checklist manual con una cuenta de prueba.

El postcheck informado también muestra cero comidas con `save_request_id`. Eso no es un error estructural, pero significa que todavía hace falta probar un guardado nuevo en la instancia real y comprobar que la columna se llena.

## Pruebas y límites

La regresión local cubre el diario multi-paso, la protección del borrador, el aislamiento por cuenta, la secuencia plan semanal → compras → despensa y consumo → informe, duplicación individual, repetición de día y restauración de borrados. Se simula una escritura seguida de una respuesta perdida y se verifica que el reintento recupere el mismo ID. En esta entrega pasan 77 pruebas automatizadas y 68 archivos JavaScript pasan la comprobación de sintaxis. Las pruebas no se conectan a tu Supabase real y no certifican el comportamiento de red ni los permisos efectivos de producción.

## Archivos de runtime

- `js/03-inline-script-03.js`
- `js/49-nutrition-persistence.js`
- `js/53-nutrition-meal-copy.js`
- `js/59-nutrition-routine-tools.js`
- `js/67-nutrition-meal-save-safety-e8.js`

Checklist: `tests/MANUAL-INTEGRATED-E9-CHECKLIST.md`.
