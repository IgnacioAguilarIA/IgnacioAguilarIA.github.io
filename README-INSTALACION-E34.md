# Instalación de E34

Aplicá el parche **sobre E33**. Conservá una copia de seguridad antes de reemplazar archivos.

## Archivos de ejecución

1. Reemplazar `index.html`.
2. Reemplazar `js/63-nutrition-week-plan-editor.js`.
3. Agregar `css/115-nutrition-week-template-management-e34.css` dentro de `css/`.

No copies la carpeta `AgendaFICH_E34_patch` anidada como una carpeta nueva dentro del repositorio; copiá sus contenidos respetando las rutas relativas. Los archivos de `tests/` y la documentación son opcionales para ejecutar la aplicación, pero conviene guardarlos para reproducir las pruebas.

## Supabase

No se necesita una migración nueva. La función usa el campo `weekly_plan_templates` existente en `nutrition_preferences` (E32) y la escritura condicional por la revisión `updated_at` que ya utiliza la aplicación.

## Comprobación recomendada

1. Abrí Planificar semana → Plantillas semanales.
2. Abrí **Detalles** y comprobá los días, los ingredientes y los avisos de cantidades/nutrición incompletas.
3. Renombrá una plantilla. Verificá que conserve su contenido y fecha original.
4. Duplicá otra plantilla. Confirmá que aparezca con nombre único y contenido equivalente.
5. Volvé a duplicarla y revisá el sufijo `(copia 2)`.
6. Probá un nombre vacío, uno de más de 80 caracteres y un nombre repetido con diferencias de mayúsculas/tildes; ninguno debe guardarse.
7. En otra sesión, cambiá las preferencias y luego intentá renombrar o duplicar desde la primera sesión. La operación desactualizada debe rechazarse y no sobrescribir el cambio remoto.
8. Aplicá una plantilla después de renombrarla/duplicarla y verifica que no se alteren las comidas ya planificadas.

## Reversión

Restaurá `index.html` y `js/63-nutrition-week-plan-editor.js` de E33 y dejá de cargar `css/115-nutrition-week-template-management-e34.css`. No hace falta revertir SQL ni borrar datos.
