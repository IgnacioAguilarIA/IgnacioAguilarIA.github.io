# AgendaFICH — Etapa E35: comparación de plantillas semanales

## Objetivo
E35 incorpora una comparación de solo lectura entre dos plantillas semanales guardadas. Permite ver rápidamente qué comidas e ingredientes difieren antes de elegir qué plantilla aplicar.

## Funcionalidades
- Selección de dos plantillas desde la lista existente, con estado accesible (`aria-pressed`).
- Comparación por día y tipo/nombre/horario de comida, diferenciando comidas iguales, modificadas, exclusivas de A y exclusivas de B.
- Desglose de ingredientes, cantidades, unidades, notas, porciones y nutrientes disponibles.
- Diferencia explícita entre un valor cero válido y un dato desconocido/incompleto.
- Vista previa de solo lectura: comparar, cambiar selección y limpiar no escribe en el plan ni en las preferencias.
- Panel adaptable, soporte de tema claro/oscuro, foco visible, movimiento reducido y alto contraste.

## Alcance técnico
Archivos de ejecución modificados: `index.html` y `js/63-nutrition-week-plan-editor.js`. Archivo nuevo: `css/116-nutrition-week-template-comparison-e35.css`. No se modifican migraciones ni archivos existentes de Entrenamiento. No requiere SQL nuevo y reutiliza las plantillas de E32.

## Pruebas
- `node --test tests/*.test.cjs`: 182/182 aprobadas en el entorno de desarrollo.
- Auditoría Chromium E35: 33/33 comprobaciones aprobadas.
- `node --check` en los 76 archivos JavaScript: sin errores de sintaxis.
- Referencias locales de `index.html`: 190 verificadas, ninguna ausente.
- Se comprobó el ZIP incremental aplicándolo sobre una extracción limpia de E34; ver `E35-VALIDACION.txt`.

Las pruebas utilizan datos controlados. La sincronización de las plantillas se basa en el mecanismo existente, pero este trabajo no certifica las credenciales, políticas ni escrituras contra una instancia real de Supabase.
