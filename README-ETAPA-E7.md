# Agenda FICH — Etapa E7: registro rápido de alimentos

## Objetivo

Reducir los pasos para volver a añadir alimentos recientes o favoritos durante la edición de una comida, conservando las validaciones nutricionales y de unidades existentes. El alcance está limitado a Alimentación.

## Cambios principales

- Se agrega la acción **Agregar rápido** en cada tarjeta de Recientes/Favoritos. Usa la cantidad, la unidad y el estado de preparación de la última operación compatible guardada.
- Se conserva **Elegir cantidad** para editar el alimento en el formulario habitual.
- La cantidad/unidad reutilizadas se almacenan por cuenta en el navegador. Los favoritos reciben la última cantidad utilizada del alimento cuando corresponde.
- La operación reutiliza `AgendaFoodCatalog.select` y el botón existente `nutritionFoodApply`; no duplica los cálculos, instantáneas ni eventos del catálogo.
- La interfaz confirma que el alimento fue agregado al borrador de la comida y aclara que hay que guardar la comida para persistir el cambio en la cuenta.
- Si faltan datos nutricionales, la unidad no es compatible, la conversión no es fiable o la cantidad no es válida, el atajo no agrega el alimento automáticamente y orienta a revisarlo.
- Se preservan `nutritionMissing`, el estado de calidad, la fecha de verificación y la procedencia/fuente al almacenar recientes y favoritos. Esto evita que un alimento incompleto pierda sus marcadores al pasar por los accesos rápidos.
- Se evita reinterpretar como gramos cantidades antiguas cuya unidad de uso no se haya guardado.
- Se limita el almacenamiento local a 50 favoritos y 10 recientes. El panel vuelve a leer la lista cuando cambia la sesión/cuenta activa.
- Los botones nuevos usan objetivos táctiles de 44 px como mínimo (46 px en dispositivos táctiles), foco visible, etiquetas accesibles y estilos respetuosos de movimiento reducido/colores forzados.

## Archivos de runtime

Si ya está instalada la Etapa E6, reemplazar/subir estos archivos conservando sus rutas:

1. `js/56-nutrition-quick-access.js`
2. `index.html`
3. Agregar `css/91-nutrition-quick-registration-e7.css`

No requiere migración SQL ni operaciones contra Supabase. Los accesos rápidos siguen siendo locales al navegador y separados por cuenta; no se sincronizan como favoritos entre dispositivos.

## Pruebas automatizadas

- `tests/nutrition-quick-registration-e7.test.cjs`: valida cantidades, unidades, equivalencias, protección de datos nutricionales incompletos, compatibilidad con entradas antiguas, HTML y CSS.
- `tests/e7_quick_registration_browser_audit.py`: ejecuta el módulo de accesos rápidos real con Chromium a 320, 390 y 768 px. La capa de catálogo/Agregar está simulada y no contacta Supabase. Verifica el registro rápido, que se actualice Recientes, que el mensaje indique que hay que guardar la comida y que los alimentos incompletos queden bloqueados.
- Informe: `tests/artifacts/e7/quick-registration-browser-audit.json`.
- Capturas: `tests/artifacts/e7/quick-access-320px.png` y `quick-access-390px.png`.
- Mantener ejecutadas todas las suites `tests/*.test.cjs` y la auditoría visual E6.

## Pruebas manuales antes de dar por cerrada la etapa

1. Abrir una comida y añadir un alimento con cantidad personalizada (por ejemplo, 65 g); guardar la comida.
2. Abrir otra comida, seleccionar Recientes y pulsar `Agregar 65 g`. Comprobar que aparece una sola vez en el borrador y que los totales nutricionales se actualizan.
3. Guardar la comida y recargar; verificar que el alimento y los valores persisten.
4. Añadir un alimento medido en ml/unidades/porciones con su equivalencia configurada. Confirmar que se reutiliza la misma unidad; sin equivalencia válida, debe pedir revisión y no agregarlo automáticamente.
5. Favorito con nutrientes incompletos: el atajo debe abrir la selección y explicar el problema, sin añadirlo.
6. Cambiar de cuenta y confirmar que aparecen los favoritos/recientes de la cuenta correcta.
7. Repetir en pantalla de 320–390 px y escritorio. Comprobar que las acciones no se cortan, que el mensaje se ve y que `Guardar comida` sigue siendo una acción separada.

## Limitaciones

La prueba Playwright de esta etapa usa un catálogo simulado para probar la acción de la interfaz y el flujo de eventos del módulo. No certifica la persistencia de producción ni sustituye las pruebas de Supabase. La lista local no se comparte con otros dispositivos.
