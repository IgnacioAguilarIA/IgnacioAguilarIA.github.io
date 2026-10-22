# Etapa E38 — Acciones en bloque para destinos de comidas seleccionadas

## Objetivo

Reducir los pasos necesarios al reorganizar varias comidas de una plantilla semanal, conservando el control individual de cada destino y la vista previa no destructiva que ya existe en E37.

## Cambios

- Añade un selector de día común a las comidas marcadas y una acción «Asignar día a seleccionadas».
- Añade «Restaurar días originales» para restablecer las comidas marcadas a su `day_offset` guardado en la plantilla.
- Actualiza al instante los selectores individuales y el resumen de cuántas comidas se apartan del día original.
- Deshabilita las acciones en bloque cuando no hay selección o cuando no producirían cambios.
- Invalida cualquier vista previa cuando se aplica una acción en bloque: requiere una nueva vista previa antes de confirmar el guardado.
- Cambiar un destino individual sincroniza el selector de día común con ese destino, evitando que el control de la acción en bloque muestre una referencia confusa.
- Añade estilos responsive y soporte de foco visible, tema claro, movimiento reducido y colores forzados.

## Seguridad de los datos

Asignar/restaurar destinos modifica solamente el borrador local de selección. No escribe en la planificación ni en las preferencias. El guardado continúa pasando por la lógica E32–E37 existente, con validación de selección, detección de cambios de destino y protección contra duplicados y conflictos concurrentes.

## Archivos modificados

- `index.html`: agrega el CSS E38 y cambia la versión de caché del editor a `e38`.
- `js/63-nutrition-week-plan-editor.js`: añade la interfaz y las acciones en bloque dentro del selector de comidas de plantillas.
- `css/119-nutrition-week-template-bulk-target-e38.css`: nuevo estilo aislado.
- Pruebas: añade cobertura estática y de navegador E38; actualiza las referencias de versión del editor en pruebas históricas.

No se modificó SQL, ni archivos JavaScript/CSS existentes de Entrenamiento.

## Validación

- `node --test tests/*.test.cjs`: 185/185 aprobadas.
- Auditoría de navegador E38: 33/33.
- Regresiones seleccionadas: E37 26/26, E36 21/21, E35 33/33, E34 25/25, E33 19/19, E32 13/13, E31 18/18, E30 29/29, E29 20/20, E28 12/12, E27 15/15 y auditorías previas de accesibilidad/visual.
- 76 archivos JavaScript sin errores de sintaxis y 194 referencias locales de `index.html` existentes.

Las pruebas de navegador emplean datos controlados y no certifican Supabase real. Para producción, comprobar operaciones de plantilla con dos sesiones/cuentas en el entorno del proyecto.
