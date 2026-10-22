# Etapa E43 — Informe exportable del impacto estimado en compras

## Objetivo

Permitir que el usuario conserve, copie o descargue la estimación de cambios en la lista de compras que se calcula antes de aplicar una plantilla semanal, sin confundir esa proyección con la lista oficial sincronizada.

## Cambios

- Se agregan dos acciones al desglose posterior a aplicar una plantilla: **Copiar informe** y **Descargar CSV**.
- El texto copiado y el CSV incluyen semana, fecha/hora de generación, tipo de cambio, producto, marca, cantidad anterior, cantidad proyectada, unidad, preparación, categoría, estado de compra y observaciones.
- El reporte incluye todos los productos afectados, no solo las cinco filas por grupo que se muestran en pantalla.
- Los elementos se consolidan por `item_key`, de modo que una compra que requiera revisión no se duplica por aparecer también en otro grupo de advertencias.
- Se distinguen los cambios nuevos, actualizaciones, reactivaciones, archivados, conflictos con productos ya comprados y cantidades desconocidas.
- Se conserva la diferencia entre cero numérico real y cantidad desconocida.
- Las celdas CSV se escapan y se neutralizan cadenas que podrían ejecutarse como fórmulas en una hoja de cálculo.
- Se explicita en ambos formatos que se trata de una estimación capturada antes de guardar el plan: no es una lista sincronizada, no modifica la lista de compras y no descuenta inventario.
- Si el cálculo está incompleto o la cuenta activa cambió, las acciones no permiten exportar/copiar el informe como si fuera una estimación vigente.
- Se agrega CSS aislado con diseño móvil, foco visible, temas claro/oscuro, movimiento reducido, colores forzados y ocultación de controles al imprimir.

## Archivos de ejecución

- `index.html`
- `js/63-nutrition-week-plan-editor.js`
- `css/124-nutrition-week-template-post-apply-export-e43.css`

## Seguridad y alcance

- No requiere migraciones SQL nuevas.
- Copiar o descargar el informe no hace escrituras en Supabase.
- El archivo exportado es un **informe del impacto estimado**, no la lista de compras oficial ni una confirmación de sincronización.
- No se modifica la lista ni la despensa; la sincronización oficial de compras mantiene su propio flujo de vista previa y confirmación.
- No se cambió ningún archivo de ejecución de Entrenamiento ni de otras secciones.

## Validación

- `node --test tests/*.test.cjs`: 190/190 pruebas aprobadas (59 suites/archivos de prueba).
- Auditoría E43 en Chromium: 68/68 comprobaciones aprobadas, incluida descarga CSV, copia del resumen, ausencia de escrituras, contraste en modo claro/oscuro y diseño móvil/escritorio.
- Regresiones de navegador: E42 61/61, E41 52/52, E40 48/48, E39 42/42, E38 33/33, E37 26/26.
- Sintaxis JavaScript: 76/76 archivos correctos.
- Referencias locales del HTML: 200 comprobadas; ninguna ausente.
- La auditoría usa datos y un proveedor Supabase simulado; no certifica el entorno de producción ni el aislamiento entre cuentas reales.
