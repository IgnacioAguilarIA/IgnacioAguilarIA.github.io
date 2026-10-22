# AgendaFICH — Etapa E27
## Revisión segura antes de sincronizar la lista de compras

**Base:** E26  
**Alcance:** exclusivamente Alimentación, en particular la conversión del plan semanal en una lista de compras.  
**Cambios SQL:** ninguno.  
**Entrenamiento:** no se modificó ningún archivo JavaScript o CSS existente de Entrenamiento.

## Qué cambia

- «Generar desde el plan» abre una vista previa; no escribe cambios antes de que la persona los revise y confirme.
- La vista previa desglosa productos nuevos, reactivados, actualizados y pendientes generados que se archivarán. Los productos obsoletos no se borran físicamente.
- Los productos manuales permanecen en la lista. Los productos que ya están marcados como comprados se conservan por defecto, y la cantidad comprada no cambia salvo que se active expresamente la opción para actualizarla.
- Las cantidades o unidades desconocidas se identifican como tales; no se transforman en cantidades conocidas iguales a cero.
- Antes de aplicar los cambios, el módulo vuelve a consultar el plan y la lista actuales y compara sus firmas con las de la propuesta. Si otro dispositivo o sesión modificó la información durante la revisión, se cancela la propuesta sin aplicar escrituras y se solicita volver a generar la vista previa.
- Mientras se revisa la propuesta, las acciones conflictivas de la lista quedan bloqueadas. El foco se mueve al título de revisión para mejorar la navegación por teclado y lector de pantalla.
- La interfaz se adapta a pantallas pequeñas, foco visible, movimiento reducido y modos de alto contraste.

## Archivos de ejecución incluidos en el parche

1. `index.html` — actualiza la versión del módulo y carga la nueva hoja de estilos.
2. `js/62-nutrition-week-planner-shopping.js` — genera, valida y aplica la propuesta de sincronización.
3. `css/108-nutrition-shopping-review-e27.css` — estilos de la revisión.

El parche también lleva los tests actualizados para que puedan incorporarse al repositorio.

## Instalación

1. Hacé una copia de seguridad de tu versión E26 o creá una rama de prueba en GitHub.
2. Extraé el ZIP del parche.
3. Copiá los tres archivos de ejecución a las mismas rutas de tu repositorio y reemplazá los archivos cuando corresponda.
4. Conservá el directorio `js/` y `css/`; no cambies los nombres.
5. Publicá y abrí la aplicación con conexión para que se carguen los recursos nuevos.
6. Probá generar una lista, cancelar la revisión y comprobar que no haya cambios; luego repetí y confirmá. Revisá además un producto comprado, un artículo manual y una cantidad desconocida.

**No hace falta ejecutar SQL.** E27 no agrega ni cambia columnas, tablas, políticas, funciones de base de datos ni migraciones.

## Pruebas incluidas

- `tests/nutrition-shopping-review-e27.test.cjs`: pruebas unitarias del generador de diferencias y protección de la sincronización.
- `tests/e27_shopping_review_browser_audit.py`: auditoría de navegador con proveedor Supabase simulado.
- `tests/nutrition-shopping-workflow-e26.test.cjs`: regresión del flujo de compras actualizado.
- `tests/nutrition-week-plan-recipes-e2.test.cjs`: regresión de cantidades y recetas del plan semanal.
- `tests/artifacts/e27/shopping-review-browser-audit.json`: informe de la auditoría E27.

## Validación realizada

- Suite completa Node.js: **174/174 aprobadas**.
- Auditoría E27 en Chromium: **15/15 aprobadas**.
- Auditoría de regresión E26 ejecutada con el módulo E27: **9/9 aprobadas**.
- Auditorías de navegador E25 (5/5), E24 (8/8), E23 (7/7), E20 (7/7), E19 (8/8), E18 (8/8), E17 (8/8), E16 (8/8), E12 (28/28) y E10 (14/14): aprobadas en ejecuciones individuales. También concluyeron correctamente las auditorías E14, E13, E7 y E6.
- Sintaxis JavaScript: **76/76 archivos** comprobados.
- Referencias locales de `index.html`: **183 comprobadas, 0 faltantes**.
- Comparación de archivos contra E26: solo cambia el módulo existente `js/62-nutrition-week-planner-shopping.js`; se agrega `css/108-nutrition-shopping-review-e27.css`. En `index.html` solo cambia la versión de caché del módulo 62 y se enlaza el CSS nuevo.
- Los archivos JavaScript y CSS preexistentes ajenos al módulo de compras son idénticos a E26; no se tocó Entrenamiento.

## Alcance y limitaciones

Las pruebas de navegador usan una base/proveedor Supabase simulado. Confirman el comportamiento del cliente en escenarios controlados, pero no certifican las políticas ni el funcionamiento de la instancia real de producción. Después de instalar, probá en tu entorno real la lectura y escritura de la lista, la sincronización entre dos dispositivos y los permisos de dos cuentas distintas.

## Reversión

Si necesitás volver atrás, restaurá desde tu copia de E26 `index.html` y `js/62-nutrition-week-planner-shopping.js`, y eliminá `css/108-nutrition-shopping-review-e27.css`. No hay ninguna migración SQL que revertir.
