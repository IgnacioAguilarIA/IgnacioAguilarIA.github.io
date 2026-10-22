# Instalación de E33

Aplicá esta actualización **sobre E32** y hacé una copia de seguridad del repositorio antes de reemplazar archivos.

## Archivos de ejecución

1. Reemplazar `index.html`.
2. Reemplazar `js/63-nutrition-week-plan-editor.js`.
3. Agregar `css/114-nutrition-week-template-merge-e33.css` dentro de `css/`.

Conservá exactamente las rutas de los archivos. No copies la carpeta `AgendaFICH_E33_patch` anidada como una carpeta nueva en la raíz del repositorio.

## Supabase

No hay que ejecutar SQL nuevo. E33 usa la columna `weekly_plan_templates` agregada por E32 y las mismas preferencias protegidas por usuario.

## Probar después de publicar

1. Abrí Planificar semana y entrá en Plantillas semanales.
2. Dejá desactivada «Combinar también en días ocupados», generá una vista previa y verificá que se omitan los días con comidas.
3. Activá la casilla. La vista previa previa se invalida; generá una nueva y comprobá que enumere los días combinados.
4. Confirmá y verificá que la comida original y las nuevas queden juntas en el día ocupado.
5. Actualizá la lista de compras desde su propia vista previa si necesitás reflejar los ingredientes añadidos.

## Reversión

Para volver al comportamiento E32, restaurá el `index.html` y `js/63-nutrition-week-plan-editor.js` de E32 y quitá el enlace a `css/114-nutrition-week-template-merge-e33.css` (o dejá el CSS sin cargar). No hace falta revertir SQL ni eliminar datos.
