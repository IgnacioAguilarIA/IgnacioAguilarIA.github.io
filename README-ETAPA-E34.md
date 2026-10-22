# AgendaFICH E34 — gestión profesional de plantillas semanales

## Objetivo

E32/E33 permiten guardar, previsualizar y aplicar plantillas semanales, con protección contra sobrescritura. E34 mejora su mantenimiento: permite consultar el contenido, cambiar el nombre y crear una copia independiente de una plantilla guardada.

## Mejoras

- **Detalles de la plantilla:** resumen de días con comidas, cantidad de ingredientes, ingredientes cuya cantidad necesita revisión y comidas con información nutricional incompleta; además lista los días y el número de comidas de cada uno.
- **Renombrar sin reconstruir:** edición en línea accesible. Se conservan el ID, la fecha de creación, los IDs de las comidas, snapshots de ingredientes, nutrientes desconocidos y procedencia/calidad.
- **Duplicar con IDs nuevos:** crea una plantilla independiente, con nombre único automático (`(copia)`, `(copia 2)`, etc.). Todos los IDs de plantilla y de cada comida se regeneran; las instantáneas de nutrición y procedencia se clonan sin compartir referencias mutables.
- **Validaciones:** detecta nombres vacíos, nombres repetidos ignorando mayúsculas/tildes, IDs repetidos, límites de 12 plantillas y claves de comida inválidas.
- **Conflictos entre sesiones:** renombrar, duplicar y eliminar comprueban la revisión de preferencias de Supabase antes de escribir. Si otra sesión cambió la lista, la operación se rechaza en vez de sobrescribirla.
- **Detalles visuales y accesibilidad:** resumen desplegable, formulario de renombrado en línea, foco visible, tema de colores del proyecto, modo oscuro, pantallas pequeñas, movimiento reducido y colores forzados.

## Alcance técnico

- Modificado: `js/63-nutrition-week-plan-editor.js`.
- Modificado: `index.html` para cargar la hoja E34 y renovar el cache-busting del editor.
- Agregado: `css/115-nutrition-week-template-management-e34.css`.
- Agregadas: pruebas puras y prueba de navegador E34.
- Actualizadas las pruebas históricas que verificaban la versión anterior de caché del editor.
- **No requiere SQL nuevo.** E34 utiliza `weekly_plan_templates` de `nutrition_preferences`, incorporado en E32.
- No se modificaron tablas, migraciones SQL ni archivos JavaScript/CSS existentes de Entrenamiento.

## Pruebas

Consultar `E34-VALIDACION.txt` para el detalle. La automatización usa Chromium y datos controlados; la sincronización de producción y el aislamiento real entre dos cuentas siguen requiriendo comprobación manual.
