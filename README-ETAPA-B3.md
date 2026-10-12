# Agenda FICH — Etapa B3

## Alcance
Esta etapa modifica únicamente funciones de Alimentación. No agrega migraciones SQL ni toca módulos específicos de Agenda o Entrenamiento.

## Funciones nuevas
- **Copiar día**: copia todas las comidas desde un día de la semana a otro, incluye los alimentos estructurados y deja todos los alimentos nuevos como no consumidos. No reemplaza las comidas existentes. Si el destino ya contiene comidas, pide confirmación. Si una copia falla, intenta eliminar las comidas nuevas ya creadas mediante la función transaccional `delete_nutrition_meal_and_items`.
- **Deshacer eliminación**: antes de permitir eliminar una comida, guarda temporalmente en memoria la fila de la comida y sus alimentos. Después de eliminar, ofrece deshacer durante 30 segundos. La restauración conserva los IDs de la comida y de los alimentos para mantener referencias existentes al historial. Si la preparación del respaldo falla, no deja eliminar la comida. La opción solo está disponible en la página actual y no sobrevive a una recarga.
- **Estadísticas nutricionales**: consulta `nutrition_consumption_history` de la cuenta activa y presenta promedios de 7 o 30 días. Los promedios solo usan los días que tienen registros. Los días sin registros se muestran aparte de los días que sí tienen entradas con nutrientes en cero.
- **Duplicación individual más segura**: impide duplicar cuando no pudo cargar el detalle de alimentos; si falla guardar el detalle después de crear la comida, intenta retirar la copia incompleta.

## Archivos modificados/nuevos
- `index.html`: enlaza el nuevo módulo y su hoja de estilos.
- `js/53-nutrition-meal-copy.js`: evita copias individuales incompletas y comprueba que no cambie la cuenta durante la operación.
- `js/59-nutrition-routine-tools.js`: módulo nuevo con repetición del día, deshacer y estadísticas.
- `css/80-nutrition-routine-tools.css`: estilos del nuevo panel y diálogos.
- `tests/nutrition-stage-b3.test.cjs`: pruebas automatizadas locales.

## Instalación
1. Hacé una copia de seguridad del proyecto antes de reemplazar archivos.
2. Subí los archivos conservando exactamente las rutas indicadas.
3. No ejecutar SQL nuevo para esta etapa. La función de eliminación transaccional ya utilizada por la app debe estar presente en Supabase (se incorporó en la etapa de estabilización previa).
4. Probá copiar un día de prueba a otro día, confirmar que ningún alimento quede marcado como consumido, borrar una comida y usar Deshacer, y abrir Estadísticas.

## Validación realizada
- 11 pruebas de Etapa A, 7 de A2, 20 de B2 y 13 de B3 aprobadas localmente.
- Sintaxis JS revisada para los 60 módulos.
- Las 81 hojas CSS pasan el parser.
- No hay IDs HTML duplicados ni referencias locales rotas desde el HTML.
- Estos tests locales no sustituyen una prueba con tu sesión real de Supabase, celular y escritorio.
