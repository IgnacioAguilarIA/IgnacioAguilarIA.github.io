# AgendaFICH — Etapa E24: editor de comidas seguro y reversible

## Objetivo

Hacer más fiable el uso cotidiano del editor de Alimentación, reduciendo la pérdida accidental de cambios y evitando que una cantidad inválida se convierta silenciosamente en un cálculo aparentemente válido.

## Mejoras incluidas

- **Protección de cambios sin guardar:** si se modificó un campo real de la comida, el cierre con X, Cancelar, clic en el fondo del modal o Escape muestra un diálogo accesible para seguir editando o descartar explícitamente los cambios.
- **Aviso al abandonar la página:** cuando el editor abierto contiene cambios o una operación de guardado está en curso, el navegador puede mostrar su aviso nativo antes de recargar o salir.
- **Detección precisa de cambios:** escribir una búsqueda temporal en el catálogo no dispara por sí solo una falsa advertencia; sí lo hacen las modificaciones del título, horario, descripción, cantidades, ingredientes o estado de consumo.
- **Deshacer eliminación:** quitar un ingrediente del borrador ofrece una acción para recuperarlo durante 8 segundos. Se conservan hasta 10 eliminaciones recientes para deshacerlas en orden inverso.
- **Limpieza protegida:** “Limpiar” pide confirmación si hay ingredientes en el borrador; cancelar conserva todos los elementos.
- **Validación de cantidades:** rechaza cantidades vacías, iguales o menores que cero y excesivamente grandes. Muestra un mensaje asociado al campo y bloquea el guardado hasta corregir el valor.
- **Totales honestos mientras se edita:** si hay una cantidad inválida, las cifras afectadas quedan temporalmente como “Revisar cantidad” y se ocultan los totales numéricos de la comida; al corregirla, se recalculan.
- **Accesibilidad y adaptación:** diálogo con semántica `alertdialog`, foco administrado, textos de error asociados, objetivos táctiles cómodos, temas claro/oscuro, movimiento reducido y colores forzados.

## Archivos

### Necesarios para ejecutar la actualización

- `index.html` — añade las referencias a los recursos E24.
- `css/105-nutrition-safe-editor-e24.css` — nuevo estilo del diálogo de confirmación, avisos y validación.
- `js/75-nutrition-safe-editor-e24.js` — nuevas protecciones e interacciones.

### Pruebas y documentación

- `tests/nutrition-safe-editor-e24.test.cjs`
- `tests/e24_safe_editor_browser_audit.py`
- `tests/artifacts/e24/safe-editor-browser-audit.json`
- `E24-MANIFEST.txt`

## Instalación

1. Creá una rama o una copia de respaldo de tu proyecto E23.
2. Reemplazá `index.html` por el del paquete E24.
3. Agregá `css/105-nutrition-safe-editor-e24.css` a `css/` y `js/75-nutrition-safe-editor-e24.js` a `js/` respetando los nombres.
4. Los archivos de pruebas y esta documentación son opcionales para ejecutar la app, pero conviene conservarlos en el repositorio.
5. En la rama de prueba, verificá: buscar sin agregar; editar un título y cerrar; seguir editando; descartar; quitar y deshacer un ingrediente; intentar guardar con cantidad cero; corregirla; y usar Limpiar cancelando y confirmando.
6. Comprobá un guardado real y la posterior recarga de la comida con tu cuenta de Supabase.

## Base de datos y alcance

- No se añade ni modifica SQL.
- No se hacen escrituras a la base desde E24; las operaciones existentes de guardado continúan siendo responsables de persistir los datos.
- No se modifica la lógica de las otras secciones.
- Entrenamiento, Agenda y Calendario quedan fuera del alcance. Los archivos compartidos de entrenamiento verificados conservan los mismos checksums que en E23.

## Validación ejecutada

- `node --test tests/*.test.cjs`: **167 aprobadas, 0 fallidas**.
- `node --check` en todos los archivos JavaScript del proyecto: aprobado.
- Referencias locales de `src`/`href` en `index.html`: 181 comprobadas, 0 rutas ausentes.
- Auditoría de navegador E24: **8/8** escenarios aprobados con datos locales de prueba.
- Auditorías de regresión E20, E16, E17, E18, E19 y E23: aprobadas individualmente en Chromium con datos simulados.

Las pruebas de navegador no sustituyen una prueba manual con un celular físico ni verifican la escritura/lectura en la instancia de Supabase de producción. La advertencia de salida depende del diálogo nativo que presente el navegador.

## Reversión

Si necesitás volver atrás, restaurá `index.html` de la copia E23 y eliminá los dos archivos nuevos `css/105-nutrition-safe-editor-e24.css` y `js/75-nutrition-safe-editor-e24.js`. E24 no cambia tablas, migraciones ni datos guardados.
