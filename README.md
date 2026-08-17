# Agenda Auto

## Estructura
- index.html
- data/events.json
- scripts/update_events.py
- .github/workflows/update-events.yml

## GitHub Pages
Dejá `index.html` en la raíz. Para la actualización diaria, el workflow debe existir exactamente en `.github/workflows/update-events.yml`.

## GitHub Actions
Si no aparece `Actualizar paros y feriados` en Actions, creá directamente en GitHub el archivo `.github/workflows/update-events.yml` en la rama `main`. Debe incluir `workflow_dispatch` para permitir `Run workflow`.

## Nota
El HTML carga los feriados desde Nager.Date y los paros desde `data/events.json`.
