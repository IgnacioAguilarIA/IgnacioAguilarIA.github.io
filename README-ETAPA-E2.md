# Agenda FICH — Etapa E2: recetas, plan semanal y lista de compras

## Objetivo

Conectar el planificador por fechas con las recetas guardadas y con la lista semanal de compras, sin sustituir la rutina habitual ni convertir una comida planificada en un consumo ficticio.

Esta etapa trabaja dentro de Alimentación. No modifica Entrenamiento, Agenda, Calendario, autenticación ni navegación general.

## Qué cambia

### 1. Planificar desde una receta guardada

- El editor semanal carga las recetas mediante `AgendaNutritionData.loadRecipes()`, que consulta la sesión activa y limita los resultados a la cuenta autenticada.
- Al elegir una receta se pueden indicar las porciones que se planea preparar.
- Las cantidades de los ingredientes se escalan según `porciones planificadas / rendimiento guardado`.
- La planificación conserva una instantánea independiente de los ingredientes (nombre, marca, cantidad, unidad, estado crudo/cocido/preparado y categoría) y de los nutrientes disponibles.
- La instantánea conserva la referencia a la receta y las porciones elegidas. Editar la receta original más adelante no cambia silenciosamente una semana ya planificada.
- Se validan cantidades, unidades y rendimiento. Si los ingredientes no tienen cantidades/unidades utilizables, el guardado se detiene con un mensaje accionable en vez de inventar cantidades.

### 2. Alimentar la lista de compras desde el plan fechado

- «Generar desde el plan» lee exclusivamente las comidas de la cuenta activa y de la semana seleccionada.
- Usa las instantáneas guardadas en `nutrition_weekly_plan_items`, no la definición actual de la receta, para que el contenido de una semana no cambie de forma retroactiva.
- Agrupa ingredientes compatibles y suma cantidades cuando coinciden producto, marca, unidad, estado de preparación y condición de cantidad conocida.
- No mezcla gramos con mililitros, ni alimentos crudos con cocidos. Las cantidades desconocidas se mantienen explícitas y no se presentan como cero conocido. Si una comida heredada no trae unidad, no se asumen gramos: se conserva como «sin unidad» y cantidad desconocida.
- Omite la unidad especial `plan`, porque no representa una unidad medible para sumar.
- Conserva las referencias de las comidas que aportan cada producto en `source_meals`.

### 3. Proteger la lista existente durante la regeneración

- Los productos añadidos manualmente no se sobrescriben al regenerar la lista.
- Los productos generados no comprados que dejan de formar parte del plan se archivan en lugar de borrarse físicamente.
- Los productos marcados como comprados nunca se eliminan automáticamente por dejar de aparecer en el plan.
- Si un producto generado ya marcado como comprado coincide con un artículo del plan nuevo pero su cantidad cambió, se pregunta qué hacer. Aceptar actualiza la cantidad desde el plan conservando la marca de compra; Cancelar conserva exactamente la cantidad comprada y aun así continúa la regeneración del resto de la lista.
- Se conservan las protecciones por cuenta activa y los filtros del lado de Supabase. Se valida que la fecha de la lista corresponda al lunes de la semana.

## Archivos de código modificados

- `js/62-nutrition-week-planner-shopping.js`: protege cantidades de productos comprados ante cambios del plan, mejora la agrupación y expone funciones puras para pruebas.
- `js/63-nutrition-week-plan-editor.js`: editor semanal con selector de recetas, escalado por porciones, instantáneas de ingredientes/nutrientes y lectura segura de esas instantáneas para compras.
- `tests/nutrition-week-plan-recipes-e2.test.cjs`: pruebas unitarias y de integración simulada para recetas, semana, agrupación de ingredientes, permisos por cuenta y conflicto con productos comprados.

El `index.html` de la entrega ya carga `js/62-nutrition-week-planner-shopping.js`, `js/63-nutrition-week-plan-editor.js` y sus hojas de estilo locales. No hace falta modificar navegación ni HTML para esta etapa.

## Supabase y migraciones

Esta etapa no requiere una migración nueva. La funcionalidad necesita que ya estén instaladas las tablas de etapas anteriores:

- `nutrition_shopping_items`, creada por `sql/17-nutrition-shopping-list.sql`.
- `nutrition_weekly_plan_items`, creada por `sql/19-nutrition-weekly-plan.sql`.
- `nutrition_recipes`, creada por la migración de recetas de etapas previas.

No vuelvas a ejecutar una migración únicamente por esta etapa si ya está instalada. Si no tenés claro el estado del esquema, ejecutá primero los postchecks de solo lectura y revisá su resultado. Esta entrega no ejecutó ni puede certificar operaciones en tu proyecto real de Supabase.

## Pruebas locales realizadas

- 12 pruebas de E2: escala porciones, conserva instantáneas, valida ingredientes, comprueba filtros de cuenta/semana, detecta cambios en productos comprados y confirma que la agregación no mezcla unidades o preparaciones incompatibles.
- Las 17 suites automatizadas disponibles (`tests/*.test.cjs`) pasan.
- Los 66 archivos JavaScript pasan `node --check`.

Las pruebas de integración usan un cliente Supabase simulado. No sustituyen la validación manual en el navegador y en una cuenta de prueba.

## Prueba manual recomendada después de subir los archivos

1. Abrí Alimentación y entrá a «Planificar semana». Elegí una receta guardada, indicá una cantidad de porciones y guardala para una fecha concreta.
2. Cerrá y volvé a abrir el editor. Verificá que se conserva el nombre de la receta, las porciones y la cantidad de ingredientes.
3. Abrí «Lista de compras», elegí la misma semana y generá la lista. Verificá que se usan las cantidades escaladas, y que los mismos ingredientes compatibles de varias comidas se suman.
4. Confirmá que ingredientes en gramos y mililitros, o en estado crudo y cocido, permanecen en filas separadas.
5. Marcá como comprado un ingrediente generado. Cambiá las porciones de la receta y volvé a generar la lista. Probá ambas opciones del aviso: actualizar cantidad manteniendo la marca, o conservar la cantidad comprada.
6. Añadí un artículo manual y regenerá la lista. El artículo manual debe conservarse. Los productos generados antiguos no comprados deben archivarse si ya no son necesarios; los marcados como comprados no deben borrarse automáticamente.
7. Repetí una comprobación con una segunda cuenta de prueba y verificá que no se carguen datos de la primera.
8. Registrá un consumo real desde el flujo habitual únicamente cuando hayas consumido la comida. El plan semanal no registra consumos por sí mismo.

## Límites conocidos

La generación de la lista realiza varias escrituras remotas para actualizar, insertar y archivar productos. Las operaciones usan claves idempotentes y mensajes de error conservadores, pero el conjunto completo no es una transacción única del servidor. Si se pierde la conexión a mitad de la generación, revisá la lista al recuperar la conexión y volvé a generar: no des por terminada la operación solo porque se inició.
