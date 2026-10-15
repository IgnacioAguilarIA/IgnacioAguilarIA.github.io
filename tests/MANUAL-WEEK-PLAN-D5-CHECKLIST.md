# Lista de comprobación manual — Etapa D5

Usar primero una cuenta de prueba. No compartir claves ni datos personales.

1. Ejecutar `sql/19-nutrition-weekly-plan.sql` en Supabase SQL Editor. Debe terminar con `Success. No rows returned`.
2. Ejecutar `sql/20-nutrition-weekly-plan-postcheck.sql`. Confirmar: tabla del plan presente, RLS activado, `anon` y `PUBLIC` sin permisos, `authenticated` solo CRUD, política por cuenta presente y anomalías en cero.
3. Publicar los archivos del parche manteniendo las rutas. Recargar con conexión para que navegador/service worker reciban `js/63-nutrition-week-plan-editor.js` y `css/86-nutrition-week-plan-editor.css`.
4. En Alimentación, abrir `Planificar semana`, elegir una semana futura de prueba y pulsar `Copiar rutina habitual` si la semana está vacía. Confirmar que el mensaje de éxito aparece solo tras respuesta del servidor.
5. Editar horario/notas de una comida, recargar y confirmar persistencia. Luego cambiar de semana y volver: la planificación anterior debe seguir allí.
6. Añadir una comida manual sin plantilla; debe guardarse sin alterar la rutina habitual. Quitarla y verificar que no cambie el historial de consumos.
7. Abrir `Lista de compras` y elegir la misma semana; generar desde el plan fechado. Confirmar que solo se incluyan ingredientes detallados de esa semana. Una comida sin ingredientes debe seguir apareciendo en el plan, pero no generar ingredientes inventados.
8. Marcar producto como comprado, recargar y confirmar que sigue marcado. Volver a generar la lista y verificar que la marca se conserva y no se duplican claves. Añadir un producto manual y comprobar que también se conserva al regenerar.
9. Abrir la misma semana en otro dispositivo con la misma cuenta y comprobar que el plan y la lista coinciden.
10. Iniciar sesión con una segunda cuenta de prueba; no debe ver ni modificar el plan o la lista de la primera. Volver a la cuenta original y borrar solo los registros de prueba desde la interfaz.
11. Para comprobar el último estado de consumo, marcar/desmarcar un alimento, recargar y revisar historial sin duplicados. La prueba offline debe hacerse con una fila de prueba y confirmar que no se anuncia éxito antes de confirmación del servidor.

Si aparece un error, copiar el mensaje exacto y adjuntar el resultado CSV del SQL 20. Nunca compartir contraseñas, tokens, claves de sesión ni `service_role`.
