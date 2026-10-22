# AgendaFICH — Etapa E23: integridad de los cálculos nutricionales

## Objetivo

Evitar que un nutriente cuyo dato no fue informado se presente como cero o genere una barra de progreso engañosa. El cambio cubre el editor de comidas, las tarjetas de nutrientes de cada alimento, el resumen del día (planificado y consumido), los objetivos y el resumen nutricional secundario.

## Qué cambia

- Interpreta la procedencia y `nutrition_missing_fields` como señales distintas de un valor numérico real. Un cero numérico explícito sigue siendo válido.
- Si el dato de un nutriente no está disponible, el cálculo afectado aparece como **Dato incompleto** / **Datos incompletos** en vez de sumarlo como cero.
- Separa el estado de datos incompletos del total planificado y del total consumido; un alimento aún no consumido no vuelve automáticamente desconocido el total consumido.
- Si no se puede convertir una cantidad a gramos de forma fiable, no se calcula un macro como si la cantidad fuera conocida.
- Las tarjetas de objetivos ocultan el porcentaje mientras falte información necesaria y explican qué hacer para resolverlo.
- El guardado distingue entre un cero real y un campo vacío: `0` se conserva como cero y un campo vacío se mantiene como `null`.
- Añade una capa aislada para el resumen nutricional secundario, evitando modificar el módulo compartido que también contiene comportamiento de Entrenamiento.
- Los estilos se limitan a Alimentación/editor nutricional, y mantienen soporte para foco accesible, movimiento reducido y colores forzados.

## Archivos que cambia o agrega

- `index.html`
- `js/03-inline-script-03.js` — cambio limitado al parseo de valores nutricionales al guardar una comida.
- `js/49-nutrition-persistence.js`
- `js/52-nutrition-meal-builder.js`
- `js/54-nutrition-consumption.js`
- `js/55-nutrition-live-summary.js`
- `js/74-nutrition-data-integrity-e23.js` — nuevo módulo independiente.
- `css/104-nutrition-calculation-integrity-e23.css` — nueva capa visual.
- `tests/nutrition-calculation-integrity-e23.test.cjs`
- `tests/e23_calculation_integrity_browser_audit.py`
- `tests/artifacts/e23/calculation-integrity-browser-audit.json`

## Instalación

1. Hacé una copia o rama de respaldo del proyecto actual.
2. Aplicá este parche **sobre la versión E22** del proyecto, no sobre una versión anterior.
3. Copiá los archivos del paquete manteniendo exactamente sus rutas relativas: `index.html`, `js/`, `css/` y `tests/`. Reemplazá los archivos existentes cuando el nombre coincida y agregá los archivos nuevos.
4. Publicá la rama de prueba y verificá el registro/edición de una comida con datos completos, otra con un nutriente desconocido y una comida con un valor nutricional real igual a cero.
5. Confirmá en tu entorno conectado que los registros se guardan y vuelven a cargarse correctamente.

## Supabase / SQL

E23 no agrega ni modifica migraciones SQL. Usa los campos de procedencia y calidad existentes, incluida `nutrition_quality_status` y `nutrition_missing_fields` que aporta `sql/21-nutrition-quality-provenance.sql`. Como indicaste que esa migración ya está aplicada, no hace falta ejecutar SQL nuevo para esta etapa.

## Validación ejecutada

- `node --test tests/*.test.cjs`: **162 pruebas aprobadas, 0 fallidas**.
- `python tests/e23_calculation_integrity_browser_audit.py`: **7/7**.
- `python tests/e20_autocomplete_accessibility_browser_audit.py`: **7/7**.
- `python tests/e16_meal_cards_browser_audit.py`: **8/8**.
- `python tests/e17_microinteractions_browser_audit.py`: **8/8**.
- `python tests/e18_view_preferences_browser_audit.py`: **8/8**.
- `python tests/e19_visual_consistency_browser_audit.py`: **8/8**.
- `node --check` pasó para los seis archivos JavaScript modificados/nuevos.

Las pruebas automatizadas usan fixtures/datos de prueba y no sustituyen la validación de escritura/lectura en tu proyecto real de Supabase ni una comprobación manual en un teléfono.

## Alcance y compatibilidad

- Esta entrega se limita a datos/cálculos/presentación de Alimentación.
- No modifica archivos de entrenamiento ni el módulo compartido `js/36-v87-personal-suite.js`.
- En `js/03-inline-script-03.js`, el único cambio de E23 se limita al guardado de valores nutricionales de comidas.
- No elimina alimentos, comidas, recetas ni historial guardado.
