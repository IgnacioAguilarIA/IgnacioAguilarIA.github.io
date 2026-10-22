# Prueba manual E32 — Plantillas semanales

Realizá esto en una rama de prueba y con dos cuentas de test en Supabase. No uses datos sensibles reales.

## Migración y acceso

- [ ] Ejecutar `sql/29-nutrition-weekly-plan-templates.sql` una vez.
- [ ] Ejecutar `sql/30-nutrition-weekly-plan-templates-postcheck.sql` y confirmar columna, restricción, RLS y políticas de cuenta.
- [ ] Iniciar sesión como Usuario A y abrir Planificar semana.
- [ ] Guardar una semana no vacía como plantilla.
- [ ] Volver a abrir la sección y confirmar que la plantilla se conserva después de recargar.
- [ ] Intentar guardar el mismo nombre con diferencias solo de mayúsculas/tildes; debe bloquearlo de forma clara.
- [ ] Verificar el límite de 12 plantillas y el aviso cuando se alcanza.

## Vista previa y aplicación

- [ ] Seleccionar una semana destino vacía y abrir la vista previa.
- [ ] Confirmar que el plan de destino no cambia hasta pulsar «Aplicar en esta semana».
- [ ] Aplicar y revisar días, categorías, horarios, notas, ingredientes, cantidades, metadatos de calidad/procedencia y datos nutricionales.
- [ ] Aplicar la misma plantilla otra vez; no debe crear duplicados.
- [ ] Preparar otro destino con una comida manual en un día y aplicar una plantilla: el día ocupado debe omitirse completo, sin modificar ni eliminar su comida.
- [ ] Eliminar una plantilla y confirmar que las comidas aplicadas anteriormente permanecen.

## Conflictos y cuentas

- [ ] Con una vista previa abierta, cambiar el destino en una segunda sesión y luego confirmar en la primera. Debe rechazar la propuesta obsoleta y no escribir nuevas filas.
- [ ] Simular una respuesta de red perdida después de que Supabase haya guardado los registros, y reintentar la misma operación. Debe reconocer los `plan_key` ya existentes y no duplicar.
- [ ] Cerrar sesión de Usuario A e iniciar con Usuario B. Las plantillas de A no deben aparecer.
- [ ] Comprobar con la API/RLS de prueba que Usuario B no pueda leer, alterar ni borrar el campo de preferencias de A mediante una petición manipulada.
- [ ] Probar ancho móvil 390 px y teclado/foco; no debe haber desbordamiento horizontal.

## Criterio de aceptación

Todos los puntos deben pasar antes de considerar certificada la integración de producción. Las pruebas automatizadas del repositorio no reemplazan esta comprobación con Supabase real.
