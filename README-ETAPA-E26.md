# AgendaFICH — Etapa E26: experiencia profesional de lista de compras

## Objetivo

Hacer más útil y clara la herramienta de compras de Alimentación, conectada al plan semanal existente, sin cambiar el modelo de datos ni la lógica de Entrenamiento.

## Mejoras incorporadas

- Panel de resumen con total de productos activos, pendientes y comprados.
- Barra de progreso calculada a partir de los productos marcados como comprados, con porcentaje y texto accesible para lectores de pantalla.
- Aviso cuando hay productos pendientes sin una cantidad verificable; los filtros no ocultan este resumen ni alteran los datos.
- Búsqueda local por producto, marca, categoría y preparación; ignora diferencias de mayúsculas y tildes.
- Filtros por estado (todos, pendientes, comprados) y por categoría; se pueden combinar.
- Mensaje de estado vacío que explica cómo volver a encontrar productos.
- Exportación CSV de los productos visibles conforme a los filtros vigentes, indicado explícitamente en el mensaje de confirmación.
- Mejor jerarquía visual para mostrar el nombre del producto antes de los detalles secundarios.
- Ajustes para móvil, foco visible, movimiento reducido y contraste forzado.
- Utilidades puras para resumir y filtrar la lista, cubiertas con pruebas unitarias.

## Alcance y seguridad

- La generación desde la planificación, el manejo de compras marcadas, la detección de conflictos, las claves idempotentes, el descuento de despensa y las políticas existentes de Supabase se conservan.
- La búsqueda, los filtros y el progreso se calculan en el navegador sobre la lista ya leída; no escriben datos en Supabase.
- No se modifican tablas, migraciones SQL, RLS ni datos persistidos. No ejecutar SQL para E26.
- Archivos JS/CSS respecto de E25: solo se modifica `js/62-nutrition-week-planner-shopping.js` y se agrega `css/107-nutrition-shopping-workflow-e26.css`. `index.html` solo actualiza la versión de caché del módulo 62 y añade la hoja E26.
- No se modifica ningún archivo existente de Entrenamiento.

## Instalación incremental

Partir de E25 y reemplazar/agregar respetando rutas:

1. Reemplazar `index.html`.
2. Reemplazar `js/62-nutrition-week-planner-shopping.js`.
3. Agregar `css/107-nutrition-shopping-workflow-e26.css` dentro de `css/`.

Después de publicar, abrir la aplicación conectada para que el navegador/PWA solicite el módulo con `?v=e26` y la nueva hoja con `?v=e26`. No hay migración de base de datos.

## Pruebas realizadas

- `node --test tests/*.test.cjs`: 173 aprobadas, 0 fallidas.
- `node --check` para los 76 archivos JavaScript: todos aprobados.
- E26 funciones puras: 8/8 comprobaciones.
- E26 en Chromium, viewport móvil de 390×844: 9/9 comprobaciones; resumen, porcentaje, aviso de cantidades desconocidas, búsqueda con acentos, filtros de estado y categoría, combinación de filtros, estado sin resultados y ausencia de desbordamiento horizontal.
- E25 recetas: 5/5; E24 editor seguro: 8/8; E23 integridad nutricional: 7/7; E20 autocompletado accesible: 7/7; E19 consistencia visual: 8/8; E18 preferencias: 8/8; E17 microinteracciones: 8/8; E16 tarjetas: 8/8; E15 centro de herramientas, E12 filtros (28/28), E10 visual (14/14) y E6 vista móvil (7 tamaños): aprobadas.
- Comprobación de recursos: 182 referencias locales en `index.html`, 0 ausentes.
- Comparación de los directorios `js/` y `css/` con E25: diferencias exclusivamente en el módulo de compras modificado y la nueva hoja E26.

Las pruebas de navegador usan datos de prueba y un proveedor Supabase simulado. No certifican conexión, guardado ni políticas de la instancia real de Supabase. Se recomienda validar manualmente la lista de una semana real antes de dar por terminada la publicación.

## Prueba manual recomendada

1. Abrir «Lista de compras» con una semana que tenga productos pendientes y comprados.
2. Confirmar que el resumen coincide con la lista y que el porcentaje cambia cuando se marca un producto como comprado.
3. Buscar por nombre con/sin tildes, por marca y por categoría.
4. Combinar «Pendientes» con una categoría y confirmar que el resumen general se mantiene igual mientras cambia la lista visible.
5. Comprobar un producto sin cantidad conocida y confirmar que aparece el aviso.
6. Exportar CSV con un filtro activo y comprobar que se exporten los productos visibles, tal como indica el aviso.
7. Verificar en un móvil que el diálogo no se salga de la pantalla y que los controles respondan correctamente.

## Reversión

Restaurar `index.html` y `js/62-nutrition-week-planner-shopping.js` desde la copia E25 y quitar `css/107-nutrition-shopping-workflow-e26.css`. No hay cambios de base de datos que revertir.
