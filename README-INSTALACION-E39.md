# Instalar E39 sobre E38

1. Guardá una copia de seguridad de tu repositorio actual.
2. Extraé `AgendaFICH_Alimentacion_E39_patch.zip`.
3. En GitHub, reemplazá `index.html` y `js/63-nutrition-week-plan-editor.js` por los archivos del parche, respetando sus rutas.
4. Agregá `css/120-nutrition-week-template-change-review-e39.css` dentro de `css/`.
5. Incluí las pruebas y la documentación si mantenés los tests en el repositorio.
6. No ejecutes SQL: E39 no agrega migraciones ni modifica las tablas o políticas de Supabase.
7. Abrí la app con conexión y comprobá la vista previa de una plantilla, incluido el detalle desplegable de cambios y conflictos.

## Verificación manual recomendada

- Aplicá una selección parcial de una plantilla con al menos una comida reubicada.
- Revisá que el resumen muestre nuevas, ya presentes, días ocupados, comidas preservadas y avisos de datos incompletos.
- Expandí «Ver detalle de cada comida y sus posibles conflictos» y comprobá los días de origen/destino.
- Probá un día de destino ocupado: debe quedar claro qué comidas se conservarán o por qué se omite el día.
- Cambiá la selección o el día de destino después de previsualizar: la vista previa debe invalidarse y no debe guardar nada.
- Comprobá el tema claro y oscuro, y tamaños móviles.
- En un entorno de prueba, cambiá la planificación desde otra sesión entre vista previa y confirmación: la operación debe rechazarse y pedir una revisión nueva.

La automatización usa datos controlados. Confirmá persistencia y aislamiento entre cuentas contra tu propia instancia de Supabase antes de producción.
