# AgendaFICH E30 — Ajuste de porciones en el plan semanal y preservación de instantáneas

## Objetivo

E30 mejora cómo se modifica una comida basada en una receta ya guardada dentro de la planificación semanal. Permite ajustar las porciones previstas sin editar la receta original y corrige una pérdida de metadatos que podía producirse al guardar cambios sencillos en una comida planificada.

## Cambios

- **Ajuste directo de porciones:** las comidas cuyo `nutrition_snapshot` contiene una `source_recipe` válida muestran la acción `Ajustar porciones`. Abre el editor con el campo enfocado y el número de porciones guardado.
- **Previsualización antes de guardar:** el formulario muestra el factor de escala antes de confirmar el cambio (por ejemplo, de 2 a 3 porciones = ×1,5).
- **Instantánea independiente:** escalar multiplica las cantidades conocidas y los nutrientes numéricos conocidos por la proporción entre las nuevas porciones y las actuales. Actualiza `source_recipe.planned_servings` y el factor respecto del rendimiento original. No edita la receta almacenada.
- **Incertidumbre preservada:** cantidades desconocidas siguen siendo desconocidas; los nutrientes marcados como ausentes permanecen `null` y conservan sus indicadores de calidad. Un cero explícito que no está marcado como desconocido permanece como cero.
- **Metadatos preservados al editar:** guardar solo el título, el horario o las notas ya no reconstruye los ingredientes desde una lista reducida. Se conservan procedencia, estado de calidad, campos nutricionales ausentes, factores de conversión y metadatos auxiliares de procedencia dentro de límites de tamaño.
- **Conflictos y compras:** el guardado de la comida mantiene la protección de concurrencia existente mediante `updated_at`. Tras modificar porciones, la interfaz recuerda volver a generar la vista previa de compras para reflejar las nuevas cantidades.
- **Diseño accesible:** el campo de porciones se integra con el editor existente y tiene foco visible, texto de ayuda anunciado, validación, contraste forzado y reducción de movimiento.

## Archivos de ejecución

| Archivo | Acción |
|---|---|
| `index.html` | Reemplazar; agrega el CSS E30 y actualiza la versión de caché del editor semanal |
| `js/63-nutrition-week-plan-editor.js` | Reemplazar |
| `css/111-nutrition-recipe-portion-adjustment-e30.css` | Agregar dentro de `css/` |

Las rutas son relativas a la raíz del repositorio. No renombrar archivos.

## Base de datos

E30 no requiere una nueva migración SQL. Usa el `nutrition_snapshot` y el `ingredients_snapshot` ya presentes en `nutrition_weekly_plan_items`; no agrega columnas ni modifica políticas. No hace cambios en las recetas originales ni en su historial de preparación.

Las porciones se escalan de forma proporcional a la instantánea que está guardada en la comida planificada. Si faltan cantidades o nutrientes, no se inventan valores. Para que la lista de compras refleje el plan actualizado, se debe volver a generar y revisar su vista previa; la lista no se modifica silenciosamente.

## Pruebas ejecutadas

- Suite `node --test tests/*.test.cjs`: **177/177 aprobadas**.
- Pruebas puras E30: **17/17 aprobadas**.
- Auditoría de navegador E30: **29/29 aprobadas**, incluido 390 px de ancho y escritorio.
- Regresión del editor semanal E29: **20/20 aprobadas**.
- Lista de compras E28: **12/12 aprobadas**; revisión E27: **15/15**; flujo E26: **9/9**.
- Editor seguro E24: **8/8**; integridad nutricional E23: **7/7**; autocompletado E20: **7/7**; consistencia visual E19: **8/8**; preferencias E18: **8/8**; microinteracciones E17: **8/8**; tarjetas E16: **8/8**; filtros E12: **28/28**; acabado visual E10: **14/14**; registro rápido E7: pasó; viewport móvil E6: **7 tamaños aprobados**.
- 76 archivos JavaScript: sintaxis comprobada.
- 186 referencias locales de `index.html`: todas presentes.
- No se modificaron archivos de ejecución de Entrenamiento.

Las pruebas de navegador usan una implementación simulada de Supabase. No sustituyen la validación en tu proyecto real de Supabase ni una prueba con dos cuentas o dispositivos reales.

## Comprobación manual recomendada

Seguí `tests/MANUAL-E30-RECIPE-PORTION-ADJUSTMENT-CHECKLIST.md` en una rama de prueba después de aplicar el parche sobre E29.
