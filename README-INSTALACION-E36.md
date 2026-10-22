# Instalación incremental E36

1. Hacé una copia de seguridad de tu rama actual E35.
2. Extraé el ZIP `AgendaFICH_Alimentacion_E36_patch.zip`.
3. Copiá `AgendaFICH_E36_patch/index.html` a la raíz del repositorio, reemplazando el existente.
4. Copiá `AgendaFICH_E36_patch/js/63-nutrition-week-plan-editor.js` a `js/`, reemplazando el existente.
5. Copiá `AgendaFICH_E36_patch/css/117-nutrition-week-template-selection-e36.css` a `css/`.
6. No ejecutes SQL: E36 no cambia el esquema de Supabase.
7. Publicá primero en una rama de prueba. Abrí una plantilla, desmarcá una comida, generá la vista previa y confirma. Verificá que solo se copie esa comida, que las comidas existentes no cambien y que la comida no seleccionada no aparezca en destino.
8. Cambiá la selección tras generar una vista previa: esta debe invalidarse y requerir una nueva.
9. En una segunda sesión, modificá el destino entre preview y confirmación; la operación debe rechazarse sin sobrescribir los cambios recientes.

El parche incluye archivos de prueba y documentación. Los únicos archivos de ejecución que hay que reemplazar/agregar son los tres enumerados en los pasos 3–5. No se modifican los archivos de ejecución de Entrenamiento.
