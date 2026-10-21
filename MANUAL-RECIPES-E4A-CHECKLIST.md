# Checklist manual — Etapa E4A: recetas avanzadas

Realizar primero en una cuenta de prueba y con un respaldo recuperable.

## Supabase

- [ ] Ejecutar `sql/25-nutrition-recipes-advanced.sql` una sola vez, sin errores.
- [ ] Ejecutar `sql/26-nutrition-recipes-advanced-postcheck.sql`.
- [ ] Confirmar columnas `instructions`, `prep_time_minutes`, `cook_time_minutes` y `parent_recipe_id`.
- [ ] Confirmar que `nutrition_recipe_preparation_history` existe con RLS habilitado.
- [ ] Confirmar la policy de lectura del historial, limitada por `auth.uid() = user_id`.
- [ ] Confirmar `EXECUTE` para `authenticated` en `nutrition_record_recipe_preparation`.
- [ ] No deben aparecer permisos directos de `INSERT`, `UPDATE` o `DELETE` del historial para `authenticated`.

## Recetas e instrucciones

- [ ] Crear una receta con al menos tres ingredientes, pasos numerados, tiempo de preparación y tiempo de cocción.
- [ ] Guardar, cerrar, volver a abrir y comprobar que ingredientes, cantidades, pasos y tiempos persisten.
- [ ] Confirmar que una receta antigua sin instrucciones sigue apareciendo y puede editarse.
- [ ] Intentar guardar 41 pasos o un tiempo superior a 1440 minutos; la aplicación debe rechazar la entrada con un mensaje entendible.
- [ ] Comprobar en móvil que el editor sigue siendo legible con el teclado abierto.

## Variantes

- [ ] Crear una variante de una receta existente.
- [ ] Cambiar nombre, ingrediente o tiempo en la variante; confirmar que la original no cambió.
- [ ] Comprobar que la variante aparece identificada como derivada de la receta original.
- [ ] Con una segunda cuenta, intentar enlazar una receta propia a un `parent_recipe_id` de la primera cuenta; el servidor debe rechazarlo.
- [ ] Eliminar la receta original en la cuenta de prueba y comprobar que la variante sobrevive y su enlace padre queda vacío.

## Modo de cocina

- [ ] Abrir “Cocinar paso a paso”, avanzar y volver atrás; el contador y la barra de progreso deben coincidir con el paso actual.
- [ ] Terminar y volver a la lista de recetas.
- [ ] En navegador compatible con Wake Lock y contexto seguro, comprobar que se solicita mantener la pantalla activa.
- [ ] Salir del modo y confirmar que se libera la solicitud; en navegadores no compatibles, el modo debe seguir funcionando con un aviso.
- [ ] Verificar que la receta guardada no se modifica por navegar los pasos.

## Historial de preparaciones

- [ ] Registrar una preparación con fecha, porciones, peso final opcional y notas.
- [ ] Abrir el historial global y el historial de esa receta; confirmar que la entrada aparece con la fecha y los datos informados.
- [ ] Editar después la receta y verificar que la entrada histórica conserve los pasos, ingredientes y nutrientes de la versión preparada.
- [ ] Borrar la receta de prueba y verificar que la instantánea histórica continúe en el historial global.
- [ ] Simular un reintento con la misma `operation_key`: debe devolver el registro anterior sin crear otra fila.
- [ ] Confirmar que el historial no descuenta stock ni crea registros en el historial de consumo.
- [ ] Con la segunda cuenta, comprobar que no puede leer el historial ni registrar una preparación con el ID de receta de la primera cuenta.

## Regresión de Alimentación y otras secciones

- [ ] Crear, editar, eliminar y seleccionar alimentos para una comida.
- [ ] Abrir el planificador y la lista de compras de E2; comprobar que siguen cargando.
- [ ] Abrir la despensa E3; comprobar que stock y movimientos siguen cargando.
- [ ] Marcar un consumo real y verificar que el historial de consumo anterior sigue separado del historial de preparaciones.
- [ ] Probar inicio de sesión, navegación y las secciones Entrenamiento, Agenda y Calendario sin modificar sus datos.
