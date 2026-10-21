# Agenda FICH — Alimentación: etapas 1–10

Esta versión conserva las etapas anteriores y sus ajustes posteriores, incluyendo E5–E9, exportaciones, accesibilidad móvil, registro rápido y protección de operaciones de guardado. Agrega alimentos personalizados, recetas basadas en ingredientes reales, historial de consumo por fecha y un formulario organizado en pasos. Los módulos específicos de Entrenamiento no se modifican. La guía histórica del menú de alta está en `README-MENU-AGREGAR-ALIMENTOS.md`.

## Última mejora: Etapa E10 — acabado visual profesional

E10 unifica el estado de sincronización, la jerarquía tipográfica, las tarjetas de resumen, objetivos y comidas, los estados activos, el foco de teclado y el estilo de diálogos de Alimentación. Incluye variantes para tema oscuro/claro, móvil estrecho, movimiento reducido y alto contraste. Los selectores están limitados al panel nutricional y sus propios diálogos; no cambia JavaScript ni requiere migración SQL. Para instalar desde E9, reemplazá `index.html` y agregá `css/92-nutrition-professional-finish-e10.css`. La auditoría visual está en `tests/artifacts/e10/professional-visual-audit.json`; la documentación de instalación y límites está en `README-ETAPA-E10.md`. El fixture de Chromium es estático: no reemplaza la prueba física en iOS/Android ni la validación de Supabase.


## Etapas anteriores de experiencia móvil
- Etapa E6: responsive y accesibilidad móvil; ver `README-ETAPA-E6.md`.
- Etapa E7: registro rápido de alimentos recientes y favoritos; ver `README-ETAPA-E7.md`.

E6 refina las tarjetas nutricionales en pantallas angostas, la cuadrícula de días, las pestañas y los objetivos táctiles; adapta los formularios de comida/objetivos a la altura dinámica del móvil y mantiene el cierre y guardado disponibles al desplazarse, incluso en orientación apaisada y tabletas táctiles. En móvil oculta el FAB genérico solo durante Alimentación para evitar que tape las tarjetas; la acción «Agregar comida» sigue visible. Agrega una auditoría visual en Chromium para 7 tamaños y un viewport reducido de 320×400. No modifica JavaScript ni requiere SQL. Para instalar, reemplazá `index.html` y agregá `css/90-nutrition-mobile-e6.css`. Ver `README-ETAPA-E6.md`, `tests/MANUAL-E6-MOBILE-ACCESSIBILITY-CHECKLIST.md` y `tests/artifacts/e6/viewport-audit.json`. La simulación visual no reemplaza la prueba en un teléfono real.

## Etapa E5 — exportaciones y claridad sin conexión

E5 incorpora exportaciones CSV para el plan semanal fechado y las vistas de inventario, faltantes, uso planificado y movimientos de la despensa. Neutraliza celdas que podrían ejecutarse como fórmulas, espera antes de liberar las URLs temporales de descarga y evita ofrecer exportar datos de una semana vieja si falla la lectura de la semana nueva. También aclara los límites actuales del modo sin conexión. Consultá `README-ETAPA-E5.md` y `tests/MANUAL-E5-EXPORT-OFFLINE-CHECKLIST.md`.

## Etapa D2 — privilegios mínimos de Supabase

La auditoría real encontró que `authenticated` conservaba privilegios innecesarios (`TRUNCATE`, `TRIGGER`, `REFERENCES` y `MAINTAIN`) en las tablas personales. Revisá `README-ETAPA-D2.md` y ejecutá `sql/14-nutrition-minimum-privileges.sql` antes de considerar cerrada la auditoría. La migración limita permisos de tabla sin modificar filas ni políticas RLS, y verifica el resultado antes de confirmar la transacción.


## Etapa E1 — protección incremental de respaldo y restauración de Alimentación

La guía está en `README-ETAPA-E1.md`. Cuando Alimentación está seleccionada, la importación valida el formato y versión del JSON, muestra una vista previa de las cantidades y bloquea el reemplazo si faltan colecciones nutricionales. También inserta el historial antes de limpiar IDs antiguos y vuelve a asociar las operaciones de consumo pendientes con los IDs nuevos. La exportación normaliza la cola pendiente para que no genere una copia v3 con un tipo de dato inválido. Los cambios se limitan a los bloques nutricionales de `js/03-inline-script-03.js` y `js/04-inline-script-04.js`; no requiere SQL nuevo. Esta etapa no convierte la restauración en una transacción única: antes de usar «reemplazar» con datos importantes hay que completar las pruebas en cuentas de prueba y después abordar el RPC transaccional.

## Cambios de la Etapa 4

- **Crear alimentos propios:** formulario para registrar nombre, marca opcional y calorías/proteínas/carbohidratos/grasas/fibra por 100 g. Se guardan en `user_foods`, aislados por usuario, y pueden buscarse y reutilizarse desde el catálogo.
- **Recetas:** se puede guardar la composición de los alimentos de una comida como receta. El sistema suma nutrientes según cantidades y calcula los valores por 100 g del peso completo. Después permite agregar una cantidad de porciones a una comida; la aplicación escala los ingredientes individuales y vuelve a calcular los macros.
- **Historial con fecha real:** al marcar un alimento como consumido, se registra una instantánea por cuenta y fecha local de Argentina/Córdoba. Si se desmarca el mismo día, se elimina el registro de ese día; registros de fechas anteriores se conservan. El historial muestra el período de 7, 30 o 90 días.
- **Estado diario de consumo:** un alimento de la plantilla semanal deja de figurar como consumido en el resumen al pasar a otro día. Al volver a marcarlo se registra un nuevo consumo con la fecha actual. Los registros antiguos con `consumed_at` sirven para poblar el historial de forma idempotente cuando vuelven a cargarse.
- **Copia de seguridad completa:** la exportación agrega recetas e historial. La importación de datos contempla estas tablas y mantiene compatibles los backups anteriores que no tenían esos campos.
- **Reutilización de comidas:** se conserva el botón existente para duplicar una comida a otro día/tipo/horario. Las recetas son una capa adicional, no sustituyen esa función.

## Migraciones de Supabase

**Acción requerida:** abrir el SQL Editor de Supabase y ejecutar `sql/07-nutrition-advanced.sql` después de las migraciones previas de Alimentación, en particular `01-nutrition-food-catalog.sql` y `06-nutrition-account-sync.sql`. La migración 07 crea `nutrition_recipes` y `nutrition_consumption_history`, índices y políticas RLS de acceso propio. Es idempotente para volver a ejecutarla.

La creación de alimentos personalizados usa la tabla existente `user_foods`; no requiere una tabla nueva. Si no se ejecuta la migración 07, las funciones básicas de catálogo pueden seguir funcionando, pero las recetas y el historial mostrarán un aviso que indica la migración faltante.

## Compatibilidad y límites

- Los alimentos de una receta son instantáneas: se conserva el nombre, cantidad y macros de cada ingrediente al guardar la receta. Editar un alimento del catálogo después no cambia silenciosamente una receta guardada.
- Al agregar una receta, se insertan sus ingredientes como alimentos individuales de la comida; cada elemento comienza sin marcarse como consumido.
- El historial registra las cantidades y macros calculados en el momento del consumo. No modifica ni borra los ingredientes planificados en el plan semanal.
- El historial utiliza la fecha local de `America/Argentina/Cordoba`, no la fecha UTC, para evitar que consumos cerca de medianoche se asignen al día equivocado.
- Los backups antiguos siguen siendo compatibles con el modo agregar. Para reemplazar Alimentación, la copia debe incluir todas las colecciones nutricionales; los respaldos nuevos deben existir en formato v3. Para importar recetas/historial deben existir las tablas 07 en el proyecto de destino.
- El proceso de importación de toda la aplicación no es una transacción única de base de datos. Se recomienda exportar una copia antes de reemplazar datos.
- Las verificaciones locales no sustituyen una prueba final en el navegador conectada a la cuenta real de Supabase.

## Archivos principales

- `index.html`: botones de creación de alimentos, recetas e historial; carga los módulos nuevos.
- `js/49-nutrition-persistence.js`: operaciones de recetas e historial, guardado/lectura de la base nutricional.
- `js/54-nutrition-consumption.js`: estado diario de los alimentos y recuperación idempotente del historial.
- `js/58-nutrition-advanced.js`: formularios de alimento personalizado, recetas y visor del historial.
- `css/76-nutrition-advanced.css`: estilos encapsulados de las nuevas ventanas.
- `js/03-inline-script-03.js` y `js/04-inline-script-04.js`: importación y exportación compatibles con las tablas nuevas.
- `sql/07-nutrition-advanced.sql`: migración de tablas e índices con RLS.

## Etapas incluidas

- **Etapa 1:** resumen planificado/consumido y cálculos por cantidad.
- **Etapa 2:** recientes, favoritos, edición de cantidades y duplicación de alimentos.
- **Etapa 3:** estado de sincronización, persistencia más conservadora, aislamiento por cuenta y copia de seguridad.
- **Etapa 4:** alimentos personalizados, recetas, reutilización e historial por fecha.
- **Etapa 5:** acabado visual, accesibilidad, rendimiento y pruebas de regresión.
- **Ajuste del menú de alta de alimentos:** formulario por pasos, catálogo y accesos rápidos reorganizados, detalle del producto plegable y controles adaptados a móvil.

## Etapa E2 — recetas, plan semanal y lista de compras

La implementación y la guía de validación están en `README-ETAPA-E2.md`. El editor de planificación fechada permite elegir recetas propias, escalar sus ingredientes por porciones y conservar una instantánea de la receta utilizada. La lista de compras se genera desde esas instantáneas, agrupa solo unidades y preparaciones compatibles y solicita una decisión si la cantidad de un artículo generado ya marcado como comprado cambia. Los artículos manuales se conservan y el plan no se confunde con el consumo real. No requiere SQL nuevo, pero depende de las tablas de planificación, compras y recetas instaladas en las etapas anteriores.

## Etapa E3 — despensa personal

La guía completa está en `README-ETAPA-E3.md`. Añade inventario por lotes, fecha de vencimiento, ubicación, notas, ajustes trazables y cálculo de faltantes desde la planificación fechada. La generación de compras puede restar existencias compatibles y, al marcar un artículo comprado, ofrece agregarlo a la despensa. El descuento de ingredientes se realiza solo después de una confirmación explícita y mediante RPC transaccional, con protección contra doble descuento.

**Requiere una migración nueva:** después de confirmar que E2 está instalada, ejecutá `sql/23-nutrition-pantry.sql` y revisá el postcheck de solo lectura `sql/24-nutrition-pantry-postcheck.sql`. La migración es aditiva; no modifica registros anteriores ni tablas de otras secciones. Consultá `tests/MANUAL-PANTRY-E3-CHECKLIST.md` antes de usar la despensa con datos reales.

## Etapa E4A — recetas avanzadas

La ampliación de recetas e historial de preparaciones está documentada en [README-ETAPA-E4A.md](README-ETAPA-E4A.md). Requiere ejecutar `sql/25-nutrition-recipes-advanced.sql` una vez y validar con `sql/26-nutrition-recipes-advanced-postcheck.sql`. No se considera validada en producción hasta completar `tests/MANUAL-RECIPES-E4A-CHECKLIST.md`.

## Última mejora de Alimentación: Etapa E4B

Se añadió una auditoría orientativa de calidad nutricional, comparación con el período anterior de igual duración y filtro del historial por categoría. Los hallazgos nunca alteran ni borran datos; los totales con información faltante se etiquetan como parciales o incompletos. Ver `README-ETAPA-E4B.md` y `tests/MANUAL-QUALITY-REPORT-E4B-CHECKLIST.md` para instalación y validación. Esta etapa no requiere una migración SQL nueva.


## Etapa E5 — exportaciones y claridad sin conexión

Se completaron exportaciones del plan fechado y de vistas de la despensa, además de protecciones para evitar exportar datos de una semana anterior como si fueran actuales. Ver `README-ETAPA-E5.md`.

## Etapa E6 — auditoría visual y accesibilidad móvil

La hoja `css/90-nutrition-mobile-e6.css` ajusta el responsive y la accesibilidad de Alimentación, con auditoría estática de Chromium y checklist manual. Ver `README-ETAPA-E6.md`.

## Etapa E7 — registro rápido de alimentos

Se añadió `Agregar rápido` a recientes/favoritos, con última cantidad/unidad compatible, validaciones nutricionales, estado accesible y protección por cuenta. Ver `README-ETAPA-E7.md` y `tests/MANUAL-QUICK-REGISTRATION-E7-CHECKLIST.md`. No requiere SQL; favoritos y recientes se mantienen locales por navegador y cuenta.


## Última mejora: Etapa E8 — guardado idempotente de comidas

La creación de comidas ahora usa una clave UUID única por cuenta/operación. Si la conexión se corta después de que la base escriba pero antes de recibir la respuesta, reintentar con la misma clave reutiliza la misma fila en lugar de insertar otra. Antes de enviar a Supabase se conserva un borrador local del formulario y sus alimentos estructurados; si el resultado queda incierto, se ofrece recuperarlo para repetir el intento de forma segura. El borrador se elimina únicamente tras confirmar tanto la comida como sus alimentos detallados.

**Instalación:** después de respaldar datos, ejecutá `sql/27-nutrition-meal-save-idempotency.sql` y comprobá `sql/28-nutrition-meal-save-idempotency-postcheck.sql` antes de publicar el código. La migración es aditiva y exige que la tabla `nutrition_meals` ya exista con RLS activo. Ver `README-ETAPA-E8.md` y `tests/MANUAL-MEAL-SAVE-E8-CHECKLIST.md`. Las pruebas locales no sustituyen la validación con una cuenta real en Supabase.


## Etapa E9 — auditoría integrada de Alimentación

Se reforzó el guardado del detalle para que nunca cambie silenciosamente de cuenta y se incorporó un diario local idempotente para operaciones de varios pasos. Tanto la copia individual de comidas como «Repetir un día» conservan una instantánea y claves estables antes de escribir; ante una respuesta incierta no eliminan copias a ciegas y pueden reintentarse con la misma clave. E9 no requiere SQL nuevo, pero depende de que la migración E8 (SQL 27) esté aplicada. Consultá `README-ETAPA-E9.md` y `tests/MANUAL-INTEGRATED-E9-CHECKLIST.md`. La validación de producción sigue pendiente de una prueba real con una cuenta de Supabase.

## Etapa E11 — Rediseño visual premium de Alimentación

Se agregó `css/93-nutrition-premium-dashboard-e11.css` después de los estilos E10. La etapa actualiza jerarquía visual, resumen nutricional, métricas, objetivos, tarjetas de comida, controles y navegación contextual únicamente mientras Alimentación está activa. Es un cambio visual: no requiere SQL ni cambios de lógica. Consultá `README-ETAPA-E11.md` y `tests/MANUAL-E11-PREMIUM-DESIGN-CHECKLIST.md`.


## Etapa E12 — búsqueda y filtros profesionales

Se agregó búsqueda por texto y filtros estructurales a Mis recetas; búsqueda y filtro por preparación en Mis alimentos; y búsqueda/filtro por categoría en el historial de consumo. Los términos no distinguen acentos ni mayúsculas. Los filtros son locales sobre la consulta cargada y no cambian los registros. Ver `README-ETAPA-E12.md` y `tests/MANUAL-BROWSE-FILTERS-E12-CHECKLIST.md`. No requiere SQL.

## Etapa E13 — Reorganización guiada para móvil

E13 reduce la información visible de Alimentación en pantallas pequeñas mediante divulgación progresiva: acción principal “Agregar comida”, herramientas secundarias agrupadas, métricas y objetivos plegables, tipos de comida en una fila horizontal y una guía para cuentas sin comidas conocidas. Los mismos IDs dinámicos y callbacks se conservan. No requiere SQL. Ver `README-ETAPA-E13.md` y `tests/MANUAL-GUIDED-LAYOUT-E13-CHECKLIST.md`.
