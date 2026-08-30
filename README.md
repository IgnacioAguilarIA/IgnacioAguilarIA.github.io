# Agenda FICH — estructura separada

Esta versión parte de V82 y separa el HTML, CSS y JavaScript sin cambiar deliberadamente la lógica funcional.

## Estructura
- `index.html`: estructura y montaje de la página.
- `css/`: cada bloque `<style>` original convertido en un archivo CSS independiente y cargado en el mismo orden.
- `js/`: cada bloque `<script>` inline original convertido en un archivo JS independiente y cargado en el mismo orden con `defer`, manteniendo las variables globales existentes para compatibilidad.
- `data/events.json`, `manifest.webmanifest`, `sw.js`: archivos auxiliares originales, cuando están disponibles.

## Importante
No se reescribieron los módulos para hacerlos ES modules porque la aplicación actual comparte muchas funciones/variables globales entre módulos. La separación física evita que los bloques de código se mezclen en un único HTML, pero mantiene compatibilidad con la lógica existente.

Subí toda esta carpeta (no solo `index.html`) a GitHub Pages.
