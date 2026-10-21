# Etapa E17 — Microinteracciones discretas de Alimentación

## Objetivo

Dar respuestas visuales breves y coherentes a acciones que ya se han confirmado, sin duplicar mensajes de estado, cambiar el modelo de datos ni interferir con los manejadores existentes.

## Cambios

- Destaca brevemente la tarjeta de la comida que se acaba de guardar y el detalle que se acaba de persistir.
- Resalta el campo «Resumen de alimentos» al añadir un alimento estructurado, sin escribir ni cambiar su contenido desde E17.
- Da una confirmación visual discreta cuando se confirma el guardado de objetivos o el estado de sincronización.
- Anima suavemente la expansión de los detalles de una comida.
- Añade estados táctiles de pulsación, hover sutil y foco visible a controles de Alimentación.
- Tras eliminar una comida mediante teclado, devuelve el foco a una acción útil solo cuando el control enfocado se ha eliminado realmente. No roba el foco si la operación se cancela o el usuario ya se movió a otro elemento.
- Comprueba la cuenta de los eventos que llevan `userId`; no destaca datos asociados a otra sesión.
- Respeta `prefers-reduced-motion` y `forced-colors`.
- No genera notificaciones duplicadas: utiliza los eventos existentes y la indicación de sincronización ya presente.
- No realiza consultas o escrituras a Supabase, no cambia cálculos nutricionales y no requiere SQL.

## Instalación desde E16

1. Reemplazá `index.html` por la versión incluida.
2. Agregá `js/72-nutrition-microinteractions-e17.js`.
3. Agregá `css/99-nutrition-microinteractions-e17.css`.
4. Conservá las rutas originales de las carpetas.

No hace falta ejecutar migraciones ni reemplazar otros módulos de runtime.

## Pruebas realizadas

- `node --test tests/nutrition-microinteractions-e17.test.cjs` — 5 pruebas nuevas aprobadas.
- Regresión completa del proyecto en cuatro grupos — 121 pruebas Node aprobadas.
- Auditoría Chromium: ocho combinaciones (320×740, 390×844, 768×1024 y 1366×768; temas claro y oscuro), sin fallos.
- Las pruebas de navegador revisan feedback de guardado, filtro por cuenta, resumen visual, actualización de campo, estado de sincronización, expansión y restauración de foco por teclado.
- `tests/artifacts/e17/project-integrity-audit.json` registra sintaxis, IDs, CSS y referencias locales.
- `tests/artifacts/e17/node-regression-summary.json` y `tests/artifacts/e17/microinteractions-browser-audit.json` registran los resultados consolidados.

Para repetir las comprobaciones visuales con un viewport por ejecución (recomendado en entornos con límites de tiempo):

```bash
python3 tests/e17_microinteractions_browser_audit.py --viewport 320 --theme all
python3 tests/e17_microinteractions_browser_audit.py --viewport 390 --theme all
python3 tests/e17_microinteractions_browser_audit.py --viewport 768 --theme all
python3 tests/e17_microinteractions_browser_audit.py --viewport 1366 --theme all
```

Los informes por viewport y el consolidado están en `tests/artifacts/e17/`.

## Alcance y limitaciones

La auditoría Chromium utiliza datos de prueba y no confirma el comportamiento de Supabase en producción ni sustituye una revisión en teléfonos físicos. Las microinteracciones se activan al recibir eventos de la aplicación; no se interpretan como prueba independiente de persistencia.
