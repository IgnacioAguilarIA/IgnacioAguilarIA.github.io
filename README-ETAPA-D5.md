# Agenda FICH — Etapa D5: planificación semanal con fechas reales

## Qué incorpora
- Nuevo botón **Planificar semana**, separado de la rutina habitual.
- Cada plan pertenece a un lunes de calendario y contiene comidas fechadas, horario, categoría y notas.
- Permite añadir comidas manuales o seleccionar una comida de la rutina habitual para copiar su título, hora, ingredientes y nutrientes como instantánea.
- **Copiar rutina habitual** crea el plan fechado solo si la semana está vacía; nunca reemplaza una planificación existente.
- Permite editar o quitar comidas de la semana sin modificar la rutina habitual ni los registros históricos.
- La lista de compras D4 ahora se genera desde los ingredientes detallados de la semana fechada elegida, no desde la rutina repetida genérica.
- El modelo guarda instantáneas de ingredientes/nutrientes para que futuras ediciones de la rutina no cambien lo que ya se planificó.
- La lista de compras distingue `quantity_known` de cero real; una cantidad desconocida no se suma a una cantidad conocida ni se muestra como cero inventado.
- Aislamiento de usuario con RLS, permisos CRUD mínimos, clave única por usuario/semana/plan y vínculo de plantilla con `ON DELETE SET NULL`.

## Instalación
1. Guardá una copia de seguridad de la versión anterior.
2. En Supabase SQL Editor ejecutá `sql/19-nutrition-weekly-plan.sql` una sola vez. Además de crear el plan fechado, añade la columna `quantity_known` a la tabla de compras que ya existe; no borra ni reescribe artículos.
3. Ejecutá `sql/20-nutrition-weekly-plan-postcheck.sql`, exportá el resultado y adjuntalo si algún permiso o contador no coincide.
4. Subí los archivos respetando sus rutas, incluido `index.html`, `js/62-nutrition-week-planner-shopping.js`, `js/63-nutrition-week-plan-editor.js` y `css/86-nutrition-week-plan-editor.css`.
5. Abrí **Alimentación → Planificar semana**. Importá la rutina habitual o añadí unas comidas de prueba. Después abrí **Lista de compras → Generar desde el plan**.

## Importante
- La tabla nueva no modifica las comidas habituales ni el historial existente.
- La planificación semanal guarda instantáneas. Si editás ingredientes de una plantilla más tarde, un plan ya creado no se actualiza hasta que lo edites/cambies por otra plantilla.
- Si se elimina una plantilla original, `source_meal_id` pasa a null; la instantánea queda disponible.
- No se suman gramos y mililitros ni se inventan ingredientes. Comidas sin `nutrition_meal_items` detallados se pueden planificar, pero no generan artículos automáticamente; añadí los productos manualmente si corresponde.
- La generación de lista usa upserts por clave estable y preserva artículos comprados/manuales. Las operaciones de varias filas no son una transacción única; si se interrumpen, la aplicación indica el error y se puede reintentar sin duplicar claves generadas.

## Pruebas locales
```sh
node tests/nutrition-week-planner-d5.test.cjs
node tests/nutrition-week-planner-d4.test.cjs
```
Pruebas reales pendientes: crear una semana de prueba, validar persistencia entre dispositivos con la misma cuenta, verificar aislamiento con una segunda cuenta y comprobar que la lista de compras refleja solo esa semana. El CSV SQL 18 confirmó que la lista de compras estaba vacía antes de esta ampliación; aun así, la prueba funcional de nuevas filas sigue pendiente.

## Alcance protegido
Solo se agrega una tabla nueva y recursos de Alimentación. No se cambian los módulos de Entrenamiento, Agenda, autenticación ni navegación, ni se actualizan registros nutricionales existentes.
