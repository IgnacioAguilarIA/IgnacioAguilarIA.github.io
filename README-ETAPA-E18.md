# Etapa E18 — Personalización de la vista de Alimentación

## Objetivo

Permitir que cada persona ajuste cuánto detalle quiere ver al abrir Alimentación, y ofrecer un atajo opcional a la última herramienta que usó, sin cambiar datos de comidas ni la lógica de persistencia.

## Cambios incluidos

- Nuevo botón **Personalizar vista** dentro de «Más herramientas».
- Preferencia **Adaptable** (predeterminada): detalles de comidas y resumen nutricional plegados en pantallas de hasta 700 px y abiertos en pantallas mayores.
- Preferencia **Compacta**: detalles plegados al cargar la vista en todos los tamaños.
- Preferencia **Completa**: detalles abiertos al cargar la vista en todos los tamaños.
- Preferencia opcional para recordar la última herramienta utilizada y mostrar un acceso directo en «Más herramientas».
- Las preferencias se guardan en `localStorage` con una clave separada por cuenta. Se conservan en ese navegador, pero no se sincronizan a otros dispositivos ni se envían a Supabase.
- Al cambiar de cuenta, se vuelve a cargar la preferencia correspondiente; el atajo de una cuenta no se muestra a otra.
- Las preferencias aplican el modo seleccionado a las comidas ya cargadas y a las nuevas tarjetas, sin cerrar una tarjeta distinta que la persona haya abierto manualmente al añadir otra comida.
- Diálogo accesible con etiquetas asociadas, foco inicial, ciclo de foco por teclado, cierre con Escape, retorno del foco, áreas seguras de móvil y botón Guardar siempre visible en pantallas estrechas.
- No realiza consultas o escrituras a Supabase y no requiere SQL.

## Instalación desde E17

1. Reemplazá `index.html` por el incluido en esta etapa.
2. Agregá `js/73-nutrition-view-preferences-e18.js`.
3. Agregá `css/100-nutrition-view-preferences-e18.css`.
4. Conservá las rutas originales.

No hace falta modificar las tablas de Supabase ni los módulos de Entrenamiento, Agenda o Calendario.

## Pruebas realizadas

- `node --test tests/nutrition-view-preferences-e18.test.cjs`: 6 pruebas nuevas aprobadas.
- Regresión de las 34 suites Node del proyecto ejecutadas en nueve grupos: 127 pruebas aprobadas, 0 fallos.
- Chromium: 8 combinaciones aprobadas (320×740, 390×844, 768×1024 y 1366×768, tema claro y oscuro).
- Se comprobaron los tres modos de detalle, guardado local, separación por cuenta, atajo a la última herramienta, handlers originales, adición de nuevas tarjetas sin resetear una tarjeta abierta manualmente, objetivos táctiles y desbordamiento horizontal.
- Resumen Node: `tests/artifacts/e18/node-regression-summary.json`.
- Auditoría Chromium: `tests/artifacts/e18/view-preferences-browser-audit.json`.
- Vista previa móvil del diálogo: `tests/artifacts/e18/screenshots/390x844-mobile-light-preferences-dialog.png`.

## Limitaciones

Las pruebas se ejecutaron con datos de ejemplo y almacenamiento simulado para aislar el comportamiento de la interfaz. No verifican la sesión real de Supabase ni sustituyen una prueba física en iOS/Android. La configuración de vista es local al navegador y está separada por cuenta; no es una preferencia sincronizada en la nube.
