# Agenda FICH — Etapa D1: sincronización segura por alimento

## Alcance

Esta etapa corrige una carrera en la cola local de estados de consumo de Alimentación. Antes, `flushPending()` leía la cola completa una sola vez y, después de esperar respuestas de red, escribía esa copia antigua en `localStorage`. Si la entrada del mismo alimento se actualizaba mientras la solicitud estaba en vuelo, ese cambio más reciente podía ser sobrescrito o eliminado.

Cambios realizados en `js/54-nutrition-consumption.js`:

- Las operaciones directas y los reintentos de sincronización comparten un bloqueo por usuario y alimento.
- `flushPending()` vuelve a leer la entrada al adquirir el bloqueo y solo la elimina si la entrada sigue siendo exactamente la que Supabase confirmó.
- Ya no se escribe en bloque una instantánea obsoleta de toda la cola después de operaciones asíncronas.
- Si el historial no se confirma, se conserva la entrada para reintentar.
- Si cambia la cuenta durante la petición, la cola de la cuenta original se conserva.
- Si otra operación escribió un cambio más reciente, se mantiene y se programa otro intento.

## Pruebas automatizadas

Ejecutar desde la carpeta del proyecto:

```sh
node tests/nutrition-sync-hardening-d1.test.cjs
```

Las pruebas cubren la modificación de una entrada durante una respuesta de red, limpieza exacta de entradas confirmadas, cambio de usuario, fallo del historial y dos intentos de sincronización simultáneos.

Estas pruebas usan un Supabase simulado. No prueban la latencia ni las políticas de tu instancia real.

## Auditoría de Supabase real

El archivo `sql/13-nutrition-sync-audit-readonly.sql` es de solo lectura. Ejecutalo en Supabase SQL Editor, exportá el resultado a CSV y revisá los permisos efectivos, políticas RLS, restricciones, índices, funciones y triggers de Alimentación. No devuelve comidas, recetas ni datos personales.

## Pruebas manuales recomendadas en una cuenta de prueba

1. Crear una comida de prueba y añadir un alimento detallado.
2. Marcarlo como consumido, desmarcarlo y volver a marcarlo. Confirmar que el estado final coincide con la última acción y que no aparecen registros históricos duplicados para la misma fecha.
3. En DevTools, activar modo sin conexión, cambiar el estado de consumo y confirmar que la interfaz informa que está pendiente. Volver a conectar y verificar que desaparezca de la cola solo después de confirmación.
4. Repetir el caso con desconexión después de enviar la petición, cuando sea posible, porque el cliente puede no saber si el servidor llegó a procesarla. Confirmar que el reintento sea idempotente.
5. Iniciar sesión en una segunda cuenta de prueba y verificar que no se muestren comidas, favoritos, preferencias ni avisos de sincronización de la primera cuenta.
6. Recargar la página y comprobar que el historial refleje el estado final.

No compartas claves `service_role`, tokens de sesión, contraseñas ni datos personales al devolver el CSV. El diagnóstico es suficiente para la revisión de configuración.

## Hallazgo real de privilegios y siguiente paso

La auditoría real mostró permisos adicionales para `authenticated` (`TRUNCATE`, `TRIGGER`, `REFERENCES`, `MAINTAIN`) en las seis tablas personales. D2 añade una migración específica para reducirlos a CRUD y dejar `food_catalog` como solo lectura. Consultá `README-ETAPA-D2.md` y ejecutá esa migración únicamente tras revisar sus precondiciones.
