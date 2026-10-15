# Agenda FICH — Etapa D4: plan semanal y lista de compras

## Qué incorpora

- Botón **Ver semana** dentro de Alimentación: muestra la plantilla de lunes a domingo de la cuenta activa, el número de comidas y los ingredientes detallados; el botón de cada día vuelve a la pantalla diaria existente.
- Botón **Lista de compras**: mantiene una lista independiente por usuario y semana del calendario, sincronizada en Supabase.
- Generación a partir de los ingredientes detallados del plan semanal habitual. Agrupa solo alimentos que coinciden tras normalizar tildes/capitalización y que tienen la misma marca, estado de preparación y unidad. No mezcla gramos con mililitros ni crudo con cocido.
- Los artículos generados se suman con precisión de tres decimales. Los estados de compra se preservan al regenerar. Los ingredientes generados que dejan de estar planificados y no están comprados se archivan (`active=false`) en lugar de eliminarse; los elementos manuales y los marcados como comprados permanecen.
- Permite añadir productos manuales, marcarlos comprados, eliminarlos y exportar la lista a CSV.
- La lista y las marcas se guardan por `user_id`/`week_start`, por lo que se comparten entre dispositivos al iniciar sesión con la misma cuenta.
- Las operaciones comprueban la cuenta activa antes y después de leer/escribir. Los errores no se presentan como guardados.
- El CSV neutraliza celdas que podrían ejecutarse como fórmulas en Excel/hojas de cálculo.

## Importante sobre el modelo semanal

Las comidas actuales de Agenda FICH usan una plantilla recurrente con `day` del 0 al 6. La vista semanal describe esa plantilla, no versiones históricas de cada semana. La lista de compras tiene fechas de semana propias, pero al generarla usa la plantilla semanal actual. El proyecto no reescribe ni crea comidas y no cambia la semántica de consumo.

Solo se agrupan ingredientes almacenados en `nutrition_meal_items`. Las comidas antiguas con solo una descripción de texto no se convierten automáticamente en productos, porque no se pueden deducir sus cantidades de forma fiable.

## Instalación

1. Guardá una copia de seguridad de la versión anterior.
2. En Supabase SQL Editor, ejecutá `sql/17-nutrition-shopping-list.sql` una sola vez.
3. Ejecutá `sql/18-nutrition-shopping-list-postcheck.sql` y revisá que RLS esté activo, `anon`/`PUBLIC` no tengan permisos y `authenticated` tenga solo CRUD. Compartí el CSV si hay errores; no compartas tokens, contraseñas ni claves privadas.
4. Subí todos los archivos del proyecto respetando sus rutas. El HTML referencia `css/83-nutrition-week-planner-shopping.css` y `js/62-nutrition-week-planner-shopping.js`.
5. Probá primero con una cuenta de prueba. No se requiere modificar ni borrar las tablas previas de Alimentación.

## Pruebas locales

```sh
node tests/nutrition-week-planner-d4.test.cjs
node tests/nutrition-sync-hardening-d1.test.cjs
```

El resto de `tests/*.test.cjs` son las comprobaciones regresivas heredadas de etapas previas.

## Prueba funcional real de sincronización pendiente

La auditoría SQL D3 no puede simular un navegador en modo offline. Antes de considerar la sincronización de producción completamente certificada, hacer esta prueba con una cuenta de test:

1. Crear una comida temporal y agregar un alimento detallado con conversión válida.
2. Marcar el alimento como consumido, desmarcarlo y volver a marcarlo; recargar la página y confirmar que persiste el último estado.
3. En herramientas de desarrollador del navegador, activar Offline, cambiar el consumo y confirmar que la interfaz dice pendiente (no guardado en servidor).
4. Volver Online y usar reintentar sincronización. Confirmar que el estado final coincide con la última acción y no aparecen duplicados en el historial.
5. Repetir con una interrupción después de enviar una petición cuando sea posible; si el cliente no sabe si el servidor alcanzó a escribir, confirmar que el reintento no genere filas duplicadas.
6. Iniciar sesión con una segunda cuenta de prueba y verificar que no vea ni pueda modificar la comida/lista de la primera.
7. Borrar solo los datos de prueba desde la interfaz y confirmar que no queden filas en el historial de prueba.

No compartas credenciales, tokens de sesión ni `service_role`.

## Alcance protegido

Esta etapa solo incorpora recursos de Alimentación, una nueva tabla con RLS y documentación/pruebas. No modifica los módulos existentes de Entrenamiento, Agenda, autenticación o navegación, ni las filas nutricionales existentes.
