# Etapa actual: E42 — Recibo detallado del impacto en compras después de aplicar una plantilla

Después de aplicar una plantilla semanal, E42 conserva un desplegable de solo lectura con el desglose estimado de compras: productos nuevos, cambios, reactivaciones, archivados, compras en conflicto y cantidades desconocidas. La lista de compras sigue siendo una operación independiente que requiere su propia vista previa y confirmación. No requiere SQL nuevo y no modifica archivos de ejecución de Entrenamiento. Guía: `README-ETAPA-E42.md`; instalación: `README-INSTALACION-E42.md`; pruebas manuales: `tests/MANUAL-E42-POST-APPLY-SHOPPING-IMPACT-CHECKLIST.md`.

---


Después de aplicar una plantilla semanal, E41 ofrece un acceso directo a la lista de compras de esa misma semana, explica que el plan ya se guardó pero que compras no se ha modificado aún, y mantiene la vista previa/confirmación de compras como una operación separada. No requiere SQL. Guía: `README-ETAPA-E41.md`; instalación: `README-INSTALACION-E41.md`; pruebas manuales: `tests/MANUAL-E41-PLAN-TO-SHOPPING-HANDOFF-CHECKLIST.md`.

---

# AgendaFICH — proyecto web

## Última mejora incluida: E40 — Estimación del impacto en compras

E40 agrega a la revisión consolidada de plantillas una proyección de cómo cambiaría la lista de compras con el plan propuesto. Resume productos nuevos, cambios, reactivaciones, archivados, productos ya comprados en conflicto y cantidades desconocidas. La proyección es de solo lectura; aplicar una plantilla no modifica la lista de compras. Antes de confirmar, se verifica que la lista no haya cambiado desde la vista previa. No requiere SQL y no modifica archivos de ejecución de Entrenamiento.

- Guía: `README-ETAPA-E40.md`
- Instalación: `README-INSTALACION-E40.md`
- CSS nuevo: `css/121-nutrition-week-template-shopping-impact-e40.css`
- Pruebas: `tests/nutrition-week-template-shopping-impact-e40.test.cjs` y `tests/e40_week_template_shopping_impact_browser_audit.py`
- Validación: `E40-VALIDACION.txt`
- Manifiesto SHA-256: `E40-MANIFEST.txt`
- Prueba manual: `tests/MANUAL-E40-SHOPPING-IMPACT-CHECKLIST.md`

Para instalar E40 sobre E39, reemplazá `index.html`, `js/62-nutrition-week-planner-shopping.js` y `js/63-nutrition-week-plan-editor.js`; agregá el CSS E40 en `css/`. No se requiere SQL nuevo. La validación de producción en la instancia real de Supabase sigue siendo una comprobación manual separada.

---

## Última mejora incluida: E39 — Revisión consolidada de cambios de plantillas

E39 añade una revisión consolidada y detallada por comida a la vista previa de aplicación de plantillas semanales. Resume comidas nuevas, ya presentes, días ocupados, registros que se conservarán, cantidades desconocidas y comidas con nutrientes incompletos. El detalle identifica el día de origen/destino y las comidas que se conservarán o se omitirán, sin realizar escrituras. Al cambiar el plan o la selección, se sigue exigiendo una vista previa nueva. No necesita SQL nuevo y no modifica los archivos de ejecución de Entrenamiento.

- Guía técnica: `README-ETAPA-E39.md`
- Instalación: `README-INSTALACION-E39.md`
- CSS nuevo: `css/120-nutrition-week-template-change-review-e39.css`
- Pruebas: `tests/nutrition-week-template-change-review-e39.test.cjs` y `tests/e39_week_template_change_review_browser_audit.py`
- Validación: `E39-VALIDACION.txt`
- Prueba manual: `tests/MANUAL-E39-CHANGE-REVIEW-CHECKLIST.md`

Para instalar E39 sobre E38, reemplazá `index.html` y `js/63-nutrition-week-plan-editor.js`, y agregá `css/120-nutrition-week-template-change-review-e39.css` dentro de `css/`. No hay SQL nuevo. Las pruebas de navegador usan datos controlados; la instancia real de Supabase debe validarse en el entorno correspondiente.

---

## Última mejora incluida: E38 — Acciones en bloque para destinos de comidas seleccionadas

E38 añade acciones por lotes al selector de comidas de plantillas: asignar un mismo día a todas las comidas seleccionadas y restaurar las comidas elegidas a sus días originales. Los cambios se reflejan en los selectores individuales, el resumen se recalcula, las acciones sin cambios se deshabilitan y cualquier vista previa existente se invalida antes de confirmar. Las acciones en bloque modifican solo el borrador; no escriben en la planificación hasta que se genera y confirma una vista previa. No requiere SQL nuevo y no modifica los archivos de ejecución de Entrenamiento.

- Guía técnica: `README-ETAPA-E38.md`
- Instalación: `README-INSTALACION-E38.md`
- CSS nuevo: `css/119-nutrition-week-template-bulk-target-e38.css`
- Pruebas: `tests/nutrition-week-template-bulk-target-e38.test.cjs` y `tests/e38_week_template_bulk_target_browser_audit.py`
- Validación: `E38-VALIDACION.txt`
- Manifiesto SHA-256: `E38-MANIFEST.txt`
- Lista manual: `tests/MANUAL-E38-BULK-TARGET-CHECKLIST.md`

Para instalar E38 sobre E37, reemplazá `index.html` y `js/63-nutrition-week-plan-editor.js`, y agregá `css/119-nutrition-week-template-bulk-target-e38.css` dentro de `css/`. No hay migración SQL nueva. Las pruebas usan datos de prueba y un proveedor Supabase simulado; la conexión real debe comprobarse en el entorno correspondiente.

---

## Etapa anterior: E37 — Día de destino por comida en plantillas

E37 permite seleccionar comidas de una plantilla y asignar cada una a un día de destino diferente antes de previsualizar y aplicar. La hora y tipo se conservan; solo cambia el día. La vista previa muestra los traslados, queda invalidada si cambia la selección o el destino y protege las comidas existentes y contra cambios concurrentes. No modifica la plantilla original, no requiere SQL nuevo y no modifica archivos de ejecución de Entrenamiento.

- Guía técnica: `README-ETAPA-E37.md`
- Instalación: `README-INSTALACION-E37.md`
- CSS nuevo: `css/118-nutrition-week-template-target-day-e37.css`
- Pruebas: `tests/nutrition-week-template-target-day-e37.test.cjs` y `tests/e37_week_template_target_day_browser_audit.py`
- Validación: `E37-VALIDACION.txt`
- Lista manual: `tests/MANUAL-E37-WEEK-TEMPLATE-TARGET-DAY-CHECKLIST.md`

Para instalar E37 sobre E36, reemplazá `index.html` y `js/63-nutrition-week-plan-editor.js`, y agregá el CSS nuevo en `css/`. No hay migración SQL nueva. Las pruebas automáticas utilizan datos controlados; Supabase real debe verificarse en el entorno correspondiente.

---

## Última mejora incluida: E36 — Selección de comidas desde plantillas semanales

E36 permite seleccionar una o varias comidas de una plantilla semanal guardada y aplicar solo esa selección a otra semana. La vista previa informa cuántas comidas seleccionadas se agregarán, conserva todas las comidas existentes, invalida la previsualización al cambiar casillas, detecta cambios concurrentes y usa claves estables para evitar duplicados en reintentos. Conserva snapshots e información de calidad/procedencia y no modifica las plantillas guardadas. No requiere SQL nuevo y no modifica archivos de ejecución de Entrenamiento.

- Guía técnica: `README-ETAPA-E36.md`
- Instalación: `README-INSTALACION-E36.md`
- CSS nuevo y aislado: `css/117-nutrition-week-template-selection-e36.css`
- Pruebas: `tests/nutrition-week-template-selective-apply-e36.test.cjs` y `tests/e36_week_template_selective_apply_browser_audit.py`
- Validación: `E36-VALIDACION.txt`
- Prueba manual: `tests/MANUAL-E36-WEEK-TEMPLATE-SELECTIVE-APPLY-CHECKLIST.md`

Para instalar E36 sobre E35, reemplazá `index.html` y `js/63-nutrition-week-plan-editor.js`, y agregá el CSS E36 dentro de `css/`. No hace falta SQL nuevo. Las pruebas de navegador usan datos controlados; la conexión real de Supabase debe validarse en el entorno correspondiente.

---

## Última mejora incluida: E35 — Comparación de plantillas semanales

E35 permite seleccionar dos plantillas semanales guardadas y comparar comidas, ingredientes, cantidades, notas, porciones y nutrientes disponibles antes de decidir cuál aplicar. Distingue valores cero explícitos de datos desconocidos, identifica comidas modificadas o exclusivas de cada plantilla y funciona como una vista de solo lectura. El panel incluye navegación accesible, tema claro/oscuro y diseño adaptable. No necesita SQL nuevo.

- Guía técnica: `README-ETAPA-E35.md`
- Instalación: `README-INSTALACION-E35.md`
- CSS nuevo y aislado: `css/116-nutrition-week-template-comparison-e35.css`
- Pruebas: `tests/nutrition-week-template-comparison-e35.test.cjs` y `tests/e35_week_template_comparison_browser_audit.py`
- Validación: `E35-VALIDACION.txt`

Para instalar E35 sobre E34, reemplazá `index.html` y `js/63-nutrition-week-plan-editor.js`, y agregá el CSS E35 a `css/`. No hace falta SQL nuevo. Las pruebas de navegador usan datos controlados y no certifican Supabase de producción. No se modifican archivos de ejecución de Entrenamiento.

---

## Última mejora incluida: E34 — Gestión profesional de plantillas semanales

E34 permite consultar los detalles de cada plantilla semanal, renombrarla sin reconstruir su contenido y duplicarla con identificadores independientes y nombres únicos automáticos. El resumen muestra los días con comidas, la cantidad de ingredientes, las cantidades por revisar y las comidas con información nutricional incompleta. Las operaciones verifican la revisión de preferencias para evitar sobrescribir cambios hechos desde otra sesión. No requiere SQL nuevo y no modifica archivos de ejecución de Entrenamiento.

- Guía técnica: `README-ETAPA-E34.md`
- Instalación: `README-INSTALACION-E34.md`
- CSS nuevo y aislado: `css/115-nutrition-week-template-management-e34.css`
- Pruebas específicas: `tests/nutrition-week-template-management-e34.test.cjs` y `tests/e34_week_template_management_browser_audit.py`
- Informe de validación: `E34-VALIDACION.txt`

Para instalar E34 sobre E33, reemplazá `index.html` y `js/63-nutrition-week-plan-editor.js`, y agregá el CSS nuevo dentro de `css/`. No hay migración SQL nueva. La automatización de navegador usa datos de prueba; la sincronización con Supabase real y la separación real entre cuentas deben validarse manualmente antes de producción.

---

E33 agrega un modo opcional para incluir plantillas en días que ya contienen comidas: por defecto continúa omitiéndolos; al activar “Combinar también en días ocupados”, únicamente se agregan las comidas faltantes y se conservan las existentes. La vista previa detalla cada día y la confirmación vuelve a comprobar los cambios concurrentes. No requiere SQL nuevo y no modifica archivos de ejecución de Entrenamiento. Guías: `README-ETAPA-E33.md`, `README-INSTALACION-E33.md` y `tests/MANUAL-E33-WEEK-TEMPLATE-MERGE-CHECKLIST.md`.
## Última mejora incluida: E33 — Combinar plantillas semanales sin sobrescribir

E32 permite guardar una semana del plan de Alimentación como plantilla sincronizada por cuenta y aplicarla a otra semana desde una vista previa no destructiva. Por defecto agrega comidas a días vacíos y omite días ocupados; E33 añade la opción de combinar días ocupados con una confirmación explícita, sin reemplazar las comidas existentes. También protege frente a cambios concurrentes y evita duplicados en reintentos. Requiere `sql/29-nutrition-weekly-plan-templates.sql` y la verificación de solo lectura `sql/30-nutrition-weekly-plan-templates-postcheck.sql`. Guías: `README-ETAPA-E32.md`, `README-INSTALACION-E32.md` y `tests/MANUAL-E32-WEEK-TEMPLATES-CHECKLIST.md`. No modifica los archivos de ejecución de Entrenamiento.

## Etapa anterior: E31 — Copiar un día completo con vista previa segura

E31 permite copiar todas las comidas de un día del plan semanal a otro después de revisar una vista previa. Conserva las comidas existentes del destino, crea copias independientes con instantáneas nutricionales y de ingredientes intactas, verifica en el servidor que origen y destino no hayan cambiado desde la vista previa y usa claves idempotentes para evitar duplicados si se pierde una respuesta. No requiere migraciones SQL nuevas y no modifica los archivos de ejecución de Entrenamiento. Guía: `README-ETAPA-E31.md`; pruebas manuales: `tests/MANUAL-E31-COPY-DAY-CHECKLIST.md`.

## Etapa anterior: E30 — Ajuste de porciones y preservación de instantáneas de recetas

E30 permite ajustar porciones de una comida planificada desde una acción directa, recalcula las cantidades y los nutrientes conocidos a partir de la instantánea guardada, conserva los campos desconocidos como desconocidos y no modifica la receta original. También conserva metadatos de procedencia y calidad al guardar cambios sencillos en una comida planificada. No necesita nuevas migraciones SQL. Guía: `README-ETAPA-E30.md`.

## Etapa E22 — Pulido del tablero y del flujo diario de Alimentación

E22 añade una capa visual acotada a Alimentación para mejorar la lectura rápida del resumen diario, hacer menos dominante el estado rutinario de sincronización sin ocultar advertencias o errores, pulir la guía del primer uso y dar una jerarquía más clara al editor de comidas en pantallas pequeñas. No cambia el modelo de datos ni la lógica de guardado, no agrega migraciones SQL y no modifica archivos JavaScript.

- Guía de instalación: `README-ETAPA-E22.md`
- Nueva capa visual: `css/103-nutrition-workflow-polish-e22.css`
- Enlace de carga: `index.html` (se agregó solamente el enlace a la nueva hoja de estilos)
- Pruebas E22: `tests/nutrition-dashboard-workflow-e22.test.cjs`

Para instalar E22, reemplazá `index.html` y agregá `css/103-nutrition-workflow-polish-e22.css` en la carpeta `css/` del proyecto. No hay SQL nuevo. Las pruebas locales de esta entrega pasaron: `node --test tests/*.test.cjs` (155/155), auditoría de tarjetas con Chromium (8/8), auditoría de accesibilidad del autocompletado (7/7) y auditoría visual E19 de regresión (8/8). Las pruebas de navegador usan datos simulados; no certifican Supabase en producción ni sustituyen una prueba manual en un teléfono.

## Etapa anterior: E21 — Fiabilidad del autocompletado de Alimentación

E21 mejora la calidad de los resultados del buscador sin cambiar la lógica de Entrenamiento, Agenda ni Calendario. Conserva la diferencia entre un cero numérico real y un dato ausente, transporta la procedencia y los campos faltantes, muestra avisos para los resultados incompletos y evita que una sugerencia del título se añada como ingrediente. También conserva la opción activa del teclado cuando se actualiza la lista y distingue variantes por estado de preparación, unidad y porción.

- Guía de instalación: `README-ETAPA-E21.md`
- Runtime de búsqueda: `js/50-nutrition-food-autocomplete.js`
- Adaptador de búsqueda local: `js/49-nutrition-persistence.js`
- Capa visual localizada: `css/102-nutrition-autocomplete-accessibility-e20.css`
- Pruebas E21: `tests/nutrition-autocomplete-quality-e21.test.cjs`
- Auditoría funcional Chromium: `tests/e20_autocomplete_accessibility_browser_audit.py`

E21 requirió que `sql/21-nutrition-quality-provenance.sql` estuviera aplicada, como confirmaste. E22 no necesita SQL nuevo.

## Etapas anteriores

- **E20 — Autocompletado accesible:** navegación por teclado, roles ARIA, estado de carga y estado sin resultados, junto con soporte visual para alto contraste y movimiento reducido. Detalles en `README-ETAPA-E20.md` y `tests/MANUAL-AUTOCOMPLETE-ACCESSIBILITY-E20-CHECKLIST.md`.
- **E19 — Unificación visual:** `css/101-nutrition-visual-consistency-e19.css`; detalles en `README-ETAPA-E19.md` y `tests/MANUAL-VISUAL-CONSISTENCY-E19-CHECKLIST.md`.
- **E18 — Personalizar la vista de Alimentación:** opciones Adaptable, Compacta y Completa, además de acceso directo opcional a la última herramienta. Detalles en `README-ETAPA-E18.md`.

Para conocer los antecedentes y las instrucciones de cada etapa, consultá los respectivos `README-ETAPA-*.md`.

## Etapa E43 — Informe exportable del impacto en compras

E43 permite copiar o descargar un informe de la estimación de cambios en compras después de aplicar una plantilla. El informe incluye todas las diferencias, cantidades previas/proyectadas, avisos por cantidades desconocidas y un aviso explícito de que no es la lista oficial sincronizada. Exportar no escribe en Supabase. Consultá `README-ETAPA-E43.md` y `README-INSTALACION-E43.md`.
