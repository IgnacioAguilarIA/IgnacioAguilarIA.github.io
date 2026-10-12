# Agenda FICH — Etapa B1: edición de alimentos propios y recetas

Esta entrega continúa sobre el proyecto de Alimentación que ya recibió las correcciones de las etapas A1/A2. Los cambios se limitan a la gestión de alimentos guardados y recetas; no incorpora una migración SQL nueva.

## Cambios incluidos

- Nuevo acceso **Mis alimentos** dentro del catálogo de Alimentación.
- Lista los alimentos guardados por la cuenta activa y permite editar sus valores nutricionales, nombre, marca y porción habitual.
- Permite eliminar un alimento propio con confirmación; las comidas e historiales conservan las instantáneas nutricionales guardadas previamente.
- La persistencia actualiza por `user_foods.id` y `user_id` al editar, evitando crear un duplicado por cambiar el nombre.
- Las recetas existentes ahora tienen **Editar receta**: permite cambiar nombre, notas, rendimiento, cantidades de ingredientes, quitar ingredientes y buscar/agregar ingredientes del catálogo disponible.
- Los totales de la receta se vuelven a calcular a medida que se modifican sus ingredientes.
- Se añadieron pruebas para confirmar el filtrado por cuenta activa, la edición sin duplicación, el rechazo de modificación de alimentos ajenos y la actualización de recetas.

## Archivos de aplicación modificados

- `index.html` — añade el acceso a Mis alimentos dentro del catálogo de alimentación.
- `js/49-nutrition-persistence.js` — lista, actualiza y elimina alimentos personalizados por cuenta.
- `js/58-nutrition-advanced.js` — formularios de edición de alimentos y recetas.
- `css/76-nutrition-advanced.css` — estilos responsivos para las nuevas interfaces.

Se actualizó `tests/nutrition-stage-a.test.cjs` con pruebas automatizadas. Ningún archivo específico de Entrenamiento o Agenda se modificó en esta etapa. No hace falta ejecutar una migración SQL nueva.

## Verificación local

- Sintaxis de JavaScript y CSS.
- Unicidad de IDs del HTML y referencias locales a recursos.
- Pruebas de persistencia con Supabase simulado; incluyen filtrado por `user_id`.

Estas pruebas no sustituyen una prueba en vivo con tu cuenta. Después de subir los archivos, probá primero editar un alimento propio y una receta de prueba, comprobá los cambios al recargar, y recién después usá las funciones con datos habituales.
