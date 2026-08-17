# Agenda automática

## Estructura

- `index.html` — la agenda.
- `data/events.json` — feriados y medidas de fuerza que la página lee.
- `scripts/update_events.py` — actualizador automático de eventos.
- `.github/workflows/update-events.yml` — GitHub Actions, ejecuta el actualizador cada día a las 06:15 de Argentina y también manualmente.

## GitHub Pages

1. Subí **todo el contenido de esta carpeta** a la raíz del repositorio. Debe quedar `index.html` en la raíz.
2. Asegurate de que también exista `.github/workflows/update-events.yml` en GitHub.
3. En **Settings > Pages**, elegí **Deploy from a branch**, branch `main`, carpeta `/ (root)` y guardá.
4. En **Actions**, buscá `Actualizar paros y feriados`. Podés abrirlo y usar **Run workflow** para probarlo inmediatamente.

## Cómo se actualizan los paros

GitHub Actions ejecuta `scripts/update_events.py` todos los días y escribe los resultados en `data/events.json`. La página carga ese archivo cada vez que se abre.

El script consulta las fuentes configuradas y conserva también los eventos ya verificados que estén en `data/events.json`.

Importante: las medidas de fuerza pueden tener alcance nacional, provincial, universitario o de una institución específica. El script es deliberadamente conservador y no debería tratar una medida local como nacional.
