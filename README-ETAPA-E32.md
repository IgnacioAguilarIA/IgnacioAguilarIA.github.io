# AgendaFICH E32 — Plantillas semanales reutilizables

## Objetivo

E32 permite guardar una semana planificada como plantilla y reutilizarla en otras fechas sin reconstruir las comidas. La función se integra con el editor semanal de Alimentación y conserva las comidas existentes.

## Qué incorpora

- **Guardar una semana como plantilla de cuenta.** Se guarda una instantánea de las comidas, horarios, notas, ingredientes, cantidades, datos nutricionales y metadatos de procedencia/calidad permitidos. No se guardan los IDs de las filas originales ni se modifica la semana de origen.
- **Límite de tamaño y cantidad.** Hasta 12 plantillas por cuenta y 80 comidas por plantilla. Los límites se verifican en JavaScript y con una restricción `CHECK` en PostgreSQL.
- **Vista previa no destructiva.** Antes de aplicar se muestran los días y las comidas que se agregarán, las comidas ya aplicadas y los días que se omitirán porque ya tienen contenido.
- **Conservación del destino.** Solo se agregan comidas a días vacíos. Un día que ya contiene comidas manuales u otras comidas planificadas se omite completo; no se reemplazan registros existentes.
- **Reintentos idempotentes.** Cada elemento de una plantilla tiene una clave estable para el plan destino. Si se pierde una respuesta del servidor después de escribir, el reintento reconoce las filas existentes y evita duplicados.
- **Control de concurrencia.** Antes de guardar, se revalidan las filas del plan y la versión de las preferencias. Si el origen, el destino o las plantillas cambiaron desde la vista previa, se cancela y se solicita una vista previa nueva.
- **Gestión de plantillas.** Permite previsualizar, eliminar y aplicar plantillas guardadas. Eliminar una plantilla no elimina comidas que ya se hubieran aplicado.
- **Accesibilidad y adaptación.** Panel con estados ARIA, foco, estilos para celular y escritorio, movimiento reducido y contraste forzado.

## Archivos de ejecución

| Ruta | Acción |
|---|---|
| `index.html` | Reemplazar; carga el CSS E32 y actualiza la versión de caché del editor semanal |
| `js/63-nutrition-week-plan-editor.js` | Reemplazar |
| `css/113-nutrition-week-templates-e32.css` | Agregar dentro de `css/` |

No aplanes las carpetas ni cambies los nombres de archivo.

## Supabase y migración requerida

La función requiere que exista `public.nutrition_preferences` y que conserve las políticas RLS que limitan la fila a `auth.uid() = user_id` (establecidas por `sql/06-nutrition-account-sync.sql`).

1. Hacé una copia de seguridad/confirmá que podés volver a E31.
2. En Supabase SQL Editor ejecutá una vez `sql/29-nutrition-weekly-plan-templates.sql`.
3. Ejecutá `sql/30-nutrition-weekly-plan-templates-postcheck.sql`, que es **solo lectura**, para verificar columna, restricción y políticas.
4. Recién después publicá los archivos de ejecución E32.

La migración es aditiva: agrega `weekly_plan_templates` como JSONB, restringe su forma a un arreglo de hasta 12 elementos y su tamaño a 245.760 bytes, y mantiene habilitado RLS. No crea permisos públicos ni una política nueva; utiliza el aislamiento por cuenta ya existente en `nutrition_preferences`. No modifica filas de comidas, recetas, listas de compras ni tablas de Entrenamiento.

Si todavía no se aplicó la migración, la planificación semanal normal permanece disponible, pero la función de plantillas no puede guardar ni cargar sus datos y muestra un aviso. No publiques la función como disponible para uso real hasta completar el postcheck.

## Límites y comportamiento deliberado

- Máximo 12 plantillas por cuenta.
- Máximo 80 comidas por plantilla.
- Si un día destino contiene cualquier comida que no pertenezca ya a esa plantilla, ese día se omite completo para preservar lo existente.
- Reaplicar una misma plantilla no duplica las comidas ya aplicadas.
- Borrar una plantilla no elimina comidas copiadas anteriormente.
- La prueba automatizada usa un proveedor Supabase simulado; no certifica producción, RLS entre cuentas reales ni una recuperación de red con el proyecto en vivo.

## Validación ejecutada en esta entrega

- `node --test tests/*.test.cjs`: **179/179 pruebas aprobadas**.
- Pruebas E32 de lógica pura: **10/10**.
- Auditoría de navegador E32: **13/13**.
- Regresión E31: **18/18**; E30: **29/29**; E29: **20/20**; E28: **12/12**; E27: **15/15**; E26: **9/9**; E25: **5/5**; E24: **8/8**; E23: **7/7**; E20: **7/7**; E19 y E18: **8/8 cada una**; E17 y E16: **8/8 cada una**; E14 y E13 sin fallos; E12: **28/28**; E10: **14/14**; E7 y E6 aprobadas.
- Sintaxis de JavaScript: **76/76 archivos**.
- Referencias locales de recursos en `index.html`: **188 comprobadas, ninguna ausente**.
- Se comprobó la instalación del parche sobre una copia limpia de E31.
- No se modificaron archivos de ejecución existentes de Entrenamiento.

Estas pruebas usan navegador automatizado y datos/proveedores simulados. Antes de dar por validada la sincronización en producción, completá `tests/MANUAL-E32-WEEK-TEMPLATES-CHECKLIST.md` con dos cuentas de prueba y tu instancia real de Supabase.
