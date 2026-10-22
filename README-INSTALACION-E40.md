# Instalar E40 sobre E39

1. Guardá una copia de seguridad del repositorio o aplicá el cambio en una rama de pruebas.
2. Extraé el ZIP de actualización E40 manteniendo las carpetas.
3. Reemplazá `index.html`, `js/62-nutrition-week-planner-shopping.js` y `js/63-nutrition-week-plan-editor.js`.
4. Agregá `css/121-nutrition-week-template-shopping-impact-e40.css` dentro de `css/`.
5. No ejecutes SQL: E40 no agrega ni modifica tablas.
6. Publicá la rama y abrí la app con conexión para cargar los recursos E40. Si usás la PWA, cerrá y volvé a abrirla o recargala para obtener las nuevas rutas de caché.
7. Probá la lista de compras y la vista previa de una plantilla con alimentos; confirmá que la vista previa no escriba en la lista.
8. El paquete se probó aplicándolo sobre una extracción limpia de E39: 187/187 pruebas Node, auditoría E40 48/48 y regresión E39 42/42.

## Comprobaciones manuales recomendadas

- Abrí la revisión de una plantilla y confirma que aparezca una sección de impacto de compras.
- Verificá que la estimación distinga datos conocidos, cantidades desconocidas y cantidades compradas que entrarían en conflicto.
- Cambiá la lista de compras en otra sesión antes de confirmar la plantilla; se debe invalidar la revisión y no modificar el plan.
- Confirmá que aplicar una plantilla no actualiza la lista automáticamente. La lista se actualiza con la acción existente de generar/sincronizar compras, después de revisar su propia vista previa.
- Repetí con tema claro y oscuro, y en un teléfono.
- Verificá dos cuentas distintas en Supabase para confirmar el aislamiento de datos.

## Alcance

E40 modifica únicamente el módulo de compras de Alimentación, el editor semanal de Alimentación, las referencias de recursos del HTML y una hoja CSS nueva. No modifica archivos JavaScript/CSS de Entrenamiento ni requiere SQL.

## Limitación de pruebas

Las pruebas automatizadas usan datos controlados y un proveedor simulado; la validación de producción contra tu instancia real de Supabase debe realizarse en ese entorno.
