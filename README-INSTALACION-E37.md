# Instalación de E37 sobre E36

1. Hacé una copia de seguridad de tu repositorio o creá una rama de prueba.
2. Del ZIP pequeño, reemplazá `index.html` y `js/63-nutrition-week-plan-editor.js` respetando sus rutas.
3. Agregá `css/118-nutrition-week-template-target-day-e37.css` dentro de `css/`.
4. Publicá la rama y abrí la app con conexión para que el navegador/PWA cargue `v=e37`. Si sigue apareciendo el editor anterior, cerrá la app instalada y recargala tras actualizar la caché de recursos.
5. En Plantillas semanales, abrí «Elegir comidas», cambiá el día de destino de una comida, generá la vista previa y verificá el traslado antes de confirmar.

No hay SQL nuevo. E37 utiliza las plantillas E32 existentes. La hora, tipo de comida, ingredientes, nutrientes y metadatos de la comida seleccionada se conservan; solo cambia el día de destino. La plantilla y las comidas ya existentes no se reemplazan.

## Archivos

- `index.html` — reemplazar.
- `js/63-nutrition-week-plan-editor.js` — reemplazar.
- `css/118-nutrition-week-template-target-day-e37.css` — agregar.

Los tests y documentos del paquete son complementarios. Entrenamiento y sus archivos existentes quedan fuera del alcance. Para producción, probar lectura/escritura con Supabase real y dos cuentas de prueba.
