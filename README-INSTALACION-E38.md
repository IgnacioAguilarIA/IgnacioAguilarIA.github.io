# Instalación E38

## Antes de empezar

1. Hacé una copia de seguridad de tu repositorio en E37.
2. Descomprimí el parche `AgendaFICH_Alimentacion_E38_patch.zip`.
3. Conservá las carpetas y rutas originales al copiar archivos.

## Archivos necesarios

- Reemplazar `index.html`.
- Reemplazar `js/63-nutrition-week-plan-editor.js`.
- Agregar `css/119-nutrition-week-template-bulk-target-e38.css` dentro de `css/`.

No hace falta ejecutar SQL ni cambiar políticas de Supabase.

## Comprobación manual sugerida

1. Abrí Alimentación → Planificar semana → Plantillas semanales → Elegir comidas.
2. Marcá dos o más comidas y asignales un mismo día con «Día común para las comidas seleccionadas» + «Asignar día a seleccionadas».
3. Verificá que todos los selectores individuales y el resumen reflejen el cambio.
4. Pulsá «Restaurar días originales» y verificá que cada comida vuelva a su propio día guardado (pueden ser días distintos).
5. Generá una vista previa y luego cambiá un día con la acción en bloque: la vista previa debe desaparecer y se debe solicitar una nueva.
6. Confirmá que no se escriban cambios hasta generar y confirmar una vista previa válida.
7. Repetí la prueba en un celular y en tema claro/oscuro.

## Alcance

No modifica las plantillas guardadas hasta aplicar su flujo normal; las acciones en bloque ajustan el borrador local de selección. No modifica SQL ni archivos de ejecución de Entrenamiento.

La suite automatizada utiliza datos simulados. Antes de producción, verificá el guardado de la plantilla contra tu Supabase real y la separación entre dos cuentas.
