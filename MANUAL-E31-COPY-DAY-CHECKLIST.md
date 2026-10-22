# E31 — Lista de comprobación manual

Realizar primero en una rama de prueba, con una copia de seguridad y sin datos críticos.

## Flujo normal

- [ ] Abrir Alimentación → Planificar semana.
- [ ] Elegir un día de origen que tenga varias comidas y otro día que ya tenga al menos una comida.
- [ ] Pulsar `Copiar día completo`; comprobar que el selector origen deshabilita días vacíos y que el destino no permite el mismo día.
- [ ] Generar la vista previa. Revisar títulos, horarios, cantidades desconocidas, advertencias nutricionales y conteo de comidas/ingredientes.
- [ ] Cerrar la vista previa sin confirmar y verificar en Supabase que no se haya escrito ningún registro.
- [ ] Volver a previsualizar y confirmar. Comprobar que cada comida se copie una sola vez y que las comidas anteriores del destino permanezcan intactas.
- [ ] Abrir las copias y confirmar que ingredientes, nutrientes, metadatos de procedencia y valores desconocidos se mantengan como en la fuente.
- [ ] Confirmar que las copias son editables de forma independiente y que eliminar una copia no elimina su fuente.
- [ ] Comprobar que el mensaje final recuerde regenerar/revisar la vista previa de compras si hace falta.

## Cambios concurrentes y reintentos

- [ ] Abrir la vista previa en un dispositivo.
- [ ] Cambiar una comida del origen o destino en otra sesión/dispositivo antes de confirmar.
- [ ] Confirmar la copia en la primera sesión y verificar que la operación se rechace sin escribir; la semana debe recargarse y solicitar una nueva vista previa.
- [ ] En una rama de prueba, simular un error de red después de que Supabase acepte la operación; al reintentar la misma vista previa, confirmar que el sistema reconoce las claves ya guardadas y no crea duplicados.

## Cuenta, seguridad y diseño

- [ ] Verificar con dos cuentas que los datos de una cuenta no aparezcan ni puedan copiarse dentro de la otra.
- [ ] Confirmar que RLS proteja `nutrition_weekly_plan_items` y que el cliente solo copie filas de la cuenta y semana actuales.
- [ ] Probar teclado: Tab/Shift+Tab, apertura/cierre del panel, foco de retorno al botón y lector de pantalla.
- [ ] Probar en un celular de aproximadamente 320–390 px, con modo oscuro y texto ampliado; comprobar que no haya desplazamiento horizontal.
- [ ] Repetir la operación en Supabase real y revisar que la lista de compras no cambie automáticamente antes de una nueva vista previa y confirmación.

## Criterio de aceptación

La lista de origen no se modifica; el destino nunca se reemplaza; cada fuente genera exactamente una copia por operación; los metadatos y los datos desconocidos permanecen intactos; si el origen/destino cambia tras la vista previa, no se realizan escrituras; los permisos se mantienen aislados por usuario.
