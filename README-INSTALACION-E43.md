# Instalación de E43 sobre E42

1. Hacé una copia de seguridad de tu repositorio y de los archivos que vas a reemplazar.
2. Extraé `AgendaFICH_Alimentacion_E43_patch.zip` respetando las rutas relativas del ZIP.
3. Reemplazá `index.html`.
4. Reemplazá `js/63-nutrition-week-plan-editor.js`.
5. Agregá `css/124-nutrition-week-template-post-apply-export-e43.css` dentro de `css/`.
6. Publicá la rama de prueba y recargá la PWA con conexión para obtener la nueva versión en caché.

No se requiere SQL nuevo.

## Prueba funcional sugerida

1. Aplicá una plantilla semanal con un producto nuevo y otro cuya cantidad cambie.
2. En el recibo posterior al guardado, abrí «Ver desglose estimado de compras».
3. Pulsá **Copiar informe** y comprobá que el texto mencione la semana, las cantidades anterior/proyectada y la advertencia de que es una estimación.
4. Pulsá **Descargar CSV** y comprobá que el archivo contiene las diferencias y no solo los productos visibles en la pantalla.
5. Confirmá que ninguna compra se marque ni se sincronice al copiar o descargar.
6. Abrí «Revisar compras» y verificá que la lista oficial siga requiriendo su propia vista previa y confirmación.

## Reversión

Restaurá la copia anterior de `index.html` y `js/63-nutrition-week-plan-editor.js`; eliminá `css/124-nutrition-week-template-post-apply-export-e43.css` si ya no se referencia. No hay migraciones nuevas que revertir.

## Alcance

La implementación está limitada al editor semanal de Alimentación y una hoja de estilos nueva. Los reportes se generan en el navegador y no se almacenan en Supabase. El funcionamiento con la instancia de producción debe probarse manualmente; las auditorías automatizadas usan un proveedor simulado.
