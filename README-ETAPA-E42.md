# Etapa E42 — Recibo detallado del impacto en compras después de aplicar una plantilla

## Objetivo

Conservar un resumen accionable de la estimación de compras al terminar de aplicar una plantilla semanal. El usuario puede revisar los productos y las cantidades estimadas después de guardar el plan, sin perder la distinción entre la operación de planificación y la sincronización oficial de compras.

## Qué cambia

- El panel posterior a aplicar una plantilla incorpora un desplegable de solo lectura con seis contadores: productos nuevos, actualizaciones, reactivaciones, archivados, productos comprados cuya cantidad requiere revisión y cantidades desconocidas.
- El detalle enumera los cambios estimados por grupo; cada grupo muestra hasta cinco elementos y un aviso si hay más.
- Las cantidades desconocidas siguen indicadas como tales; no se convierten en cero.
- Los conflictos con productos ya comprados y la disponibilidad de despensa se expresan con avisos separados.
- Si no fue posible calcular una estimación completa, el recibo lo indica y dirige a revisar la lista de compras actual.
- El desplegable aparece cerrado por defecto para no sobrecargar el panel; la lista se puede abrir cuando el usuario necesite detalle.
- Se mantienen separados los guardados: aplicar la plantilla guarda el plan; el recibo de impacto es informativo; la lista de compras requiere abrir el módulo oficial, generar su vista previa y confirmarla por separado.
- Se actualiza el cache-busting del editor semanal y se agrega CSS específico para el recibo de impacto, con modo claro/oscuro, foco visible, movimiento reducido y colores forzados.

## Archivos de ejecución

- `index.html`
- `js/63-nutrition-week-plan-editor.js`
- `css/123-nutrition-week-template-post-apply-impact-e42.css`

## Seguridad y alcance

- No requiere una migración SQL nueva.
- El detalle vuelve a mostrar la estimación ya calculada; no vuelve a calcular ni escribe sobre la lista.
- Abrir el detalle o cambiar entre cerrado/abierto no hace llamadas de escritura.
- El botón de compras conserva el flujo E41: cierra el editor semanal antes de abrir la lista de la misma semana.
- No se cambió ningún archivo de ejecución de Entrenamiento ni de otras secciones.
- Las pruebas de navegador usan datos y un proveedor Supabase simulado; no certifican el entorno de producción ni el aislamiento entre cuentas.

## Validación

- Node: 58/58 archivos `tests/*.test.cjs`.
- Auditoría de navegador E42: 61/61 comprobaciones.
- Regresión de navegador E41: 52/52 comprobaciones aprobadas.
- Sintaxis JavaScript: 76/76 archivos.
- Referencias locales de `index.html`: 197 revisadas, ninguna ausente.
- Instalación limpia: se extrajo E41 desde `AgendaFICH_Alimentacion_E41_completo.zip`, se aplicó el parche E42 y se repitieron la suite Node, la auditoría E42 y la regresión E41. El informe `E42-VALIDACION.txt` detalla los resultados.
