# Etapa E41 — Acceso guiado a compras después de aplicar una plantilla

## Objetivo

Facilitar el paso entre aplicar una plantilla semanal y revisar la lista de compras correspondiente, manteniendo ambas operaciones separadas y explícitas.

## Qué cambia

- Después de aplicar correctamente una plantilla, Alimentación muestra un panel de confirmación informativo para abrir compras en la misma semana.
- El panel aclara que el plan sí quedó guardado y que la lista de compras todavía no se modificó.
- Al pulsar **Revisar compras**, se cierra primero el editor semanal y se abre el módulo de compras para la semana aplicada. Esto evita superponer dos diálogos y mantiene una ruta accesible para volver.
- La lista de compras conserva su propia vista previa y su confirmación de escritura. E41 no sincroniza compras automáticamente.
- `AgendaNutritionPlanner.openShopping({week})` acepta una semana ISO válida que comienza un lunes. Si ya hay una revisión/operación de compras activa, evita cambiarla debajo de la vista previa.
- Se agregan estilos aislados y se actualiza el cache-busting de los módulos afectados.

## Archivos de ejecución

- `index.html`
- `js/62-nutrition-week-planner-shopping.js`
- `js/63-nutrition-week-plan-editor.js`
- `css/122-nutrition-week-template-shopping-handoff-e41.css`

También se incluyen la prueba contractual E41, la auditoría Chromium E41, las pruebas históricas actualizadas para las nuevas versiones de caché, y sus artefactos.

## Seguridad y alcance

- No hace falta ejecutar SQL nuevo.
- La operación de aplicar una plantilla y la operación de sincronizar compras siguen siendo distintas.
- La estimación de impacto anterior es informativa: la lista se abre para su revisión oficial después de aplicar el plan.
- No se modifican archivos de ejecución de Entrenamiento ni las demás secciones.
- Las pruebas de navegador utilizan un proveedor Supabase simulado; no certifican la instancia real de producción ni el aislamiento de cuentas.

## Validación realizada

- Pruebas Node: los 57 archivos `tests/*.test.cjs` pasan individualmente.
- Auditoría de navegador E41: 52/52 comprobaciones.
- Auditorías relacionadas E40 (48/48), E39 (42/42), E38 (33/33), E37 (26/26), E36 (21/21), E35 (33/33), E34 (25/25), E33 (19/19), E32 (13/13) y E31 (18/18) aprobadas en ejecuciones separadas.
- E30, E29, E28, E27, E26, E25, E24, E23, E20, E19, E18, E17, E16, E14, E13, E12 y E7 también finalizaron sin fallos en comprobaciones aisladas; E12: 28/28; E18: 8/8; E20: 7/7; E19: 8/8; E17: 8/8; E16: 8/8.
- Sintaxis JavaScript: 76/76 archivos.
- Recursos locales del HTML: 197 referencias comprobadas, 0 faltantes.
- La instalación limpia se realiza aplicando el parche sobre E40; la verificación final del ZIP se documenta en `E41-VALIDACION.txt`.
