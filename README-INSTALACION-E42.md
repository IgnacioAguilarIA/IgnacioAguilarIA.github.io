# Instalación de E42 sobre E41

1. Guardá una copia de seguridad del repositorio actual.
2. Extraé `AgendaFICH_Alimentacion_E42_patch.zip` en una carpeta temporal.
3. Reemplazá `index.html` en la raíz del repositorio.
4. Reemplazá `js/63-nutrition-week-plan-editor.js`.
5. Agregá `css/123-nutrition-week-template-post-apply-impact-e42.css` dentro de `css/`.
6. Conservá las rutas y nombres exactamente como están en el ZIP.
7. Publicá en una rama de prueba y abrí la app con conexión para que el navegador reciba el cache-busting actualizado.

## Qué comprobar manualmente

- Aplicá una plantilla con al menos un producto nuevo y uno cuya cantidad cambia.
- En el panel «Plan guardado», abrí «Ver desglose estimado de compras».
- Verificá los seis contadores y el detalle de productos, especialmente las diferencias de cantidad.
- Confirmá que abrir/cerrar el detalle no modifica ni la planificación ni la lista de compras.
- Pulsá «Revisar compras»: el editor semanal debe cerrarse y la lista debe abrirse en la misma semana.
- Verificá que la lista todavía requiere su propia vista previa y confirmación antes de escribir.
- Repetí la prueba en modo claro y oscuro y en un ancho de celular.

No hace falta ejecutar SQL nuevo. E42 no modifica tablas, columnas, políticas ni migraciones.

## Reversión

Restaurá la copia anterior de `index.html` y `js/63-nutrition-week-plan-editor.js`, y quitá `css/123-nutrition-week-template-post-apply-impact-e42.css`. No hay cambios de datos que deshacer.

## Límite de la validación

Las comprobaciones incluidas usan datos controlados y Supabase simulado. Antes de dar E42 por validada en producción, probá guardado/relectura, permisos por cuenta y sincronización en tu instancia real.
