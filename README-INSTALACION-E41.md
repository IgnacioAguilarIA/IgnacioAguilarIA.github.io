# Instalación de E41 — AgendaFICH

## Antes de empezar

1. Hacé una copia de seguridad del repositorio y de los cambios locales.
2. Usá esta actualización sobre la base **E40**.
3. Descomprimí el ZIP conservando las rutas de carpetas.

## Archivos de ejecución

| Ruta del proyecto | Acción |
|---|---|
| `index.html` | Reemplazar |
| `js/62-nutrition-week-planner-shopping.js` | Reemplazar |
| `js/63-nutrition-week-plan-editor.js` | Reemplazar |
| `css/122-nutrition-week-template-shopping-handoff-e41.css` | Agregar dentro de `css/` |

El parche además actualiza las pruebas que validan las versiones de caché e incorpora los tests y la auditoría de navegador E41. Para reproducir todas las pruebas, subí esos archivos de pruebas respetando sus rutas.

## Supabase

No hace falta ejecutar SQL nuevo. E41 no cambia tablas, columnas, políticas ni migraciones.

## Probar después de publicar

1. Abrí Alimentación y aplicá una plantilla sobre una semana que puedas usar para pruebas.
2. Verificá que aparezca el panel **Plan guardado · compras por revisar**.
3. Confirmá que el panel diga que la lista de compras no se ha modificado todavía.
4. Pulsá **Revisar lista de compras**. El editor semanal debe cerrarse y la lista de compras debe abrirse en la semana aplicada.
5. Confirmá que la lista aún requiere su propia vista previa y confirmación antes de guardar cambios.
6. Cerrá compras y comprobá que el foco vuelve al acceso al editor semanal.
7. Repetí en móvil y en modo claro/oscuro.
8. Para producción, probá con tu Supabase real y dos cuentas de prueba; las auditorías automatizadas usan un proveedor simulado.

## Reversión

Restaurá los archivos de la copia de seguridad o reemplazá los archivos de ejecución por sus versiones de E40. No hay migraciones SQL que revertir.
