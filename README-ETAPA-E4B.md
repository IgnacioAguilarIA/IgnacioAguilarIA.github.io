# Agenda FICH — Etapa E4B: auditoría nutricional y comparación de períodos

## Alcance

Esta etapa continúa desde E4A y se limita al módulo de **Calidad, historial y exportación de Alimentación**. Amplía los campos de trazabilidad que ya existen desde las etapas D7/D8; no requiere una migración SQL nueva y no modifica deliberadamente Entrenamiento, Agenda, Calendario, autenticación ni la navegación general.

## Mejoras incluidas

### 1. Auditoría orientativa de datos nutricionales

- Revisa alimentos personales que estén guardados en `user_foods`.
- Señala valores negativos en calorías, proteínas, carbohidratos, grasas o fibra.
- Advierte sobre cantidades que superan umbrales orientativos por 100 g (más de 950 kcal o más de 100 g para un nutriente expresado en gramos).
- Compara de forma aproximada la energía de etiqueta con `4 kcal/g` para proteínas y carbohidratos y `9 kcal/g` para grasas. La discrepancia solo genera una advertencia: fibra, alcoholes, redondeos y criterios de etiquetado pueden explicar diferencias. **No es una verificación científica ni certifica un alimento.**
- Identifica metadatos contradictorios entre estado de calidad, campos faltantes y fecha de verificación.
- Detecta nutrientes sin valor numérico que no figuren declarados como faltantes y registros con procedencia insuficiente.
- Nunca cambia ni elimina los valores auditados. Cada hallazgo incluye detalle y puede exportarse en CSV para una revisión manual.

### 2. Comparación de períodos equivalentes

- Compara el período seleccionado con el período inmediatamente anterior de igual duración.
- Muestra días con registros, días sin registros, totales, diferencias y cambios porcentuales cuando ambos totales son completos.
- Si algún día registrado no tiene el nutriente completo, el total no se presenta como completo. Cuando existen días con datos válidos, el informe puede mostrar un subtotal claramente etiquetado como parcial y el promedio acompañado por su denominador (`N` días con dato).
- Diferencia un día sin consumos registrados de un día registrado cuyo total real es cero.
- Si no se puede obtener el período anterior, conserva el informe actual y muestra que la comparación no está disponible.
- Para evitar bajar los mismos alimentos dos veces, la segunda consulta acepta `includeFoods:false` y recupera únicamente el historial del período anterior. La consulta sigue comprobando la identidad de la cuenta, aplicando `user_id`, filtrando el período en Supabase y paginando las filas.

### 3. Filtro por categoría de comida

- Añade un filtro para todas las comidas, desayuno, media mañana, pre/post entrenamiento, almuerzo, merienda, cena, colación, antes de dormir y otra/sin categoría.
- Reconoce las claves históricas (`lunch`, `snack`, `dinner`, etc.) y las claves en español de las versiones nuevas (`almuerzo`, `merienda`, `cena`, etc.).
- Aplica el filtro a los resúmenes diarios, comparación e historial exportado. Al cambiar las fechas sin aplicarlas, las exportaciones del historial y del resumen quedan desactivadas para no descargar datos antiguos con un nombre de rango nuevo.

### 4. Exportaciones ampliadas

- Conserva las exportaciones de alimentos, historial y resumen diario.
- Añade auditoría CSV con una fila por hallazgo y una fila explícita para cada alimento sin alertas detectadas.
- Añade a la exportación de alimentos el número y los títulos de las alertas orientativas.
- Mantiene la neutralización de fórmulas en celdas CSV.

## Archivos de runtime modificados

- `js/49-nutrition-persistence.js`: permite omitir la descarga de alimentos al consultar solo el período comparativo.
- `js/65-nutrition-quality-report.js`: auditoría orientativa, comparación, filtro y exportación de auditoría.
- `css/88-nutrition-quality-report.css`: estilos de los nuevos paneles, responsivos y acotados al informe de Alimentación.

`index.html` ya carga el JavaScript y la hoja de estilos necesarios; no se modifica en esta entrega. No se añade SQL porque las columnas de procedencia y estado de calidad usadas por esta etapa ya forman parte de las migraciones anteriores.

## Instalación

1. Hacé una copia de seguridad normal de los datos antes de reemplazar archivos de la aplicación.
2. Reemplazá en GitHub los tres archivos de runtime de la sección anterior, respetando exactamente las rutas.
3. No ejecutes una migración SQL nueva para E4B.
4. Publicá/desplegá la aplicación y probá la lista manual `tests/MANUAL-QUALITY-REPORT-E4B-CHECKLIST.md` con una cuenta de prueba.

## Pruebas automatizadas

```bash
node tests/nutrition-stage-e4b-quality-comparison.test.cjs
for f in tests/*.test.cjs; do node "$f"; done
find js -name '*.js' -print0 | xargs -0 -n1 node --check
```

Las pruebas locales no reemplazan una comprobación con la instancia real de Supabase ni una prueba visual en dispositivos físicos.

## Interpretación de las alertas

- `error`: regla simple que merece revisión inmediata (por ejemplo, un nutriente negativo).
- `warning`: inconsistencia o dato incompleto que debe verificarse contra una fuente fiable.
- `info`: recordatorio de mantenimiento, como una fecha de verificación antigua.

Los umbrales y la regla de energía frente a macronutrientes son heurísticos; pueden dar falsos positivos y falsos negativos. La aplicación no debe editar automáticamente un alimento por un hallazgo. Verificar un alimento sigue siendo una confirmación del usuario, no una certificación independiente de la exactitud de los valores.

## Datos del CSV de Supabase adjunto

El CSV de salida aportado con la entrega anterior indica que `nutrition_recipe_preparation_history` existe, tiene RLS habilitado y una política de `SELECT` propia; también lista las columnas avanzadas de recetas y `EXECUTE` para `nutrition_record_recipe_preparation` en `authenticated`, `postgres` y `service_role`. Ese resultado es consistente con la instalación de E4A, pero no prueba por sí solo todos los casos de aislamiento, permisos ni comportamiento transaccional en producción. E4B no altera esa tabla ni requiere modificar sus permisos.
