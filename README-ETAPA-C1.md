# Agenda FICH — Etapa C1: accesibilidad y acabado final de Alimentación

Esta actualización parte de la Etapa B3 y limita su alcance a Alimentación.

## Cambios
- Los selectores de día y de categoría exponen su estado seleccionado con `aria-pressed` y nombres accesibles.
- Los diálogos estáticos de Alimentación y objetivos se anuncian como diálogos modales; se gestiona el foco, Escape, retorno de foco y bloqueo de desplazamiento mientras están abiertos.
- Los diálogos de herramientas de Alimentación incorporan `aria-describedby`, trampa de foco y retorno del foco al control que los abrió.
- Las etiquetas de los campos de Alimentación y objetivos que no tenían asociación explícita se enlazan con su único control correspondiente.
- Mejora de contraste en tema claro, foco visible, objetivos táctiles, zoom/teclado y modo de movimiento reducido/colores forzados.
- La reinstalación del manejador de deshacer se agrupa por frame para evitar repetir comprobaciones cientos de veces durante un solo repintado.

## Archivos cambiados
- `index.html`
- `js/58-nutrition-advanced.js`
- `js/59-nutrition-routine-tools.js`

## Archivos nuevos
- `js/60-nutrition-accessibility-final.js`
- `css/81-nutrition-accessibility-final.css`
- `tests/nutrition-stage-c1.test.cjs`

No requiere migración SQL. No modifica los módulos de Entrenamiento, Agenda, autenticación o navegación.
