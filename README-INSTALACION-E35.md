# Instalación de E35 sobre E34

1. Guardá una copia de seguridad del repositorio E34.
2. Extraé `AgendaFICH_Alimentacion_E35_patch.zip` y copiá los archivos respetando sus rutas.
3. Reemplazá `index.html` y `js/63-nutrition-week-plan-editor.js`.
4. Agregá `css/116-nutrition-week-template-comparison-e35.css` dentro de `css/`.
5. Los archivos de `tests/` y los README son documentación/pruebas; no son necesarios para ejecutar la interfaz, aunque conviene versionarlos.
6. No se requiere SQL adicional. E35 compara las plantillas almacenadas por E32/E34 y no modifica la estructura de Supabase.
7. Publicá primero en una rama de prueba, recargá la PWA para que descargue el editor con `?v=e35` y verificá tema claro, tema oscuro y pantalla móvil.

## Prueba manual rápida
- Abrí Plantillas semanales y elegí «Comparar» en una plantilla.
- Elegí una segunda plantilla. Comprobá que el panel muestre iguales/diferentes y comidas exclusivas de cada plantilla.
- Elegí dos plantillas iguales: debe indicar que no hay diferencias de contenido.
- Limpiá la selección: el panel debe cerrarse y devolver el foco al control correspondiente.
- Comprobá que la comparación no cambie las comidas del plan ni guarde preferencias.
- Repetí en móvil de 390 px, en tema claro y oscuro.

## Entrenamiento
La etapa está limitada al editor semanal de Alimentación, su hoja de estilos nueva y el HTML de carga. No se cambian archivos JavaScript/CSS existentes de Entrenamiento.
