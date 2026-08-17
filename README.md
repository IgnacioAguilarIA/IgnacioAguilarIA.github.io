# Agenda automática

Proyecto pensado para GitHub Pages + GitHub Actions.

## Archivos

- `index.html`: página principal.
- `data/events.json`: eventos que lee la página.
- `scripts/update_events.py`: busca novedades en fuentes web y actualiza `events.json`.
- `.github/workflows/update-events.yml`: ejecuta el actualizador todos los días y también permite ejecutarlo manualmente.

## Importante

La parte de feriados usa una API online desde el navegador. Los paros se actualizan con un proceso de GitHub Actions que revisa fuentes web. El parser es deliberadamente conservador: conserva eventos ya verificados y agrega candidatos nuevos cuando encuentra títulos relacionados con medidas de fuerza y fechas detectables. Antes de considerar un evento como confirmado, conviene revisar la fuente enlazada.

Para una versión de producción, lo ideal es sustituir el parser genérico por adaptadores específicos por fuente (CTERA, CONADU/CONADU Histórica, FATUN y sindicatos/jurisdicciones que te interesen), porque los sitios cambian su estructura y las medidas pueden tener alcances distintos.

## GitHub Pages

1. Subí toda la carpeta al repositorio.
2. En GitHub: Settings -> Pages.
3. Elegí `Deploy from a branch`.
4. Seleccioná `main` y `/root`.
5. Guardá.
6. La página será tu `index.html`.

## Actualización diaria

GitHub Actions ejecuta el flujo una vez por día. También podés entrar en Actions -> `Actualizar paros y feriados` -> `Run workflow` para forzar una actualización.

## Tareas compartidas

La página actual mantiene las tareas manuales en `localStorage`, por lo que son privadas de cada navegador. Para que una tarea sea compartida por todos los usuarios hay que agregar una base de datos (por ejemplo Supabase) y reemplazar `localStorage` por llamadas a la API de esa base.
