# Agenda FICH — Etapa E3: despensa personal

## Qué incluye

La despensa agrega un inventario opcional por lotes personales, con cantidad, unidad, estado de preparación, vencimiento, ubicación y notas. Se integra con el plan semanal y la lista de compras de E2 sin modificar la rutina habitual ni registrar consumos ficticios.

- **Inventario:** crear lotes, sumar y retirar cantidades, editar metadatos y archivar/reactivar artículos sin borrar el historial.
- **Movimientos auditables:** cada existencia inicial, ingreso, retiro, corrección, compra y consumo queda registrada con cantidad anterior y posterior.
- **Faltantes de la semana:** compara los ingredientes planificados con los lotes activos y no vencidos. Solo convierte g ↔ kg y ml ↔ L; separa marcas, preparaciones y unidades incompatibles. No convierte volumen a masa ni inventa equivalencias.
- **Integración de compras:** cuando se regenera la lista, descuenta del requerimiento las existencias que coinciden con seguridad. Al marcar un producto comprado se ofrece agregarlo como lote nuevo a la despensa; la acción es idempotente para ese artículo de compra.
- **Uso confirmado de ingredientes:** permite confirmar una comida planificada y descontar los lotes compatibles con vencimiento más próximo primero. Se registra en una operación transaccional y no deja cantidades negativas. Una misma comida planificada no se puede descontar dos veces automáticamente.
- **Aislamiento por cuenta:** tablas con RLS, lectura de filas propias y funciones RPC `SECURITY DEFINER` con chequeo explícito de `auth.uid()`. Los usuarios no reciben permisos directos de escritura sobre las tablas de movimientos/stock; las cantidades se cambian por funciones transaccionales.
- **Accesibilidad y móvil:** controles táctiles, estados anunciados, foco visible, Escape y gestión del foco dentro del diálogo.

## Archivos cambiados o agregados

- `index.html`: carga el CSS y el módulo de despensa.
- `js/66-nutrition-pantry.js`: interfaz, inventario, faltantes, registro de compras y uso confirmado.
- `css/89-nutrition-pantry.css`: estilos encapsulados para la herramienta.
- `js/62-nutrition-week-planner-shopping.js`: integra la cobertura de despensa en la generación de compras y ofrece importar una compra marcada.
- `sql/23-nutrition-pantry.sql`: tablas, RLS, permisos mínimos y RPC de stock/consumo.
- `sql/24-nutrition-pantry-postcheck.sql`: postcheck de solo lectura.
- `tests/nutrition-pantry-stage-e3.test.cjs`: pruebas de cálculos, unidades, seguridad y carga.
- `tests/MANUAL-PANTRY-E3-CHECKLIST.md`: prueba manual en cuenta de prueba.

## Instalación

1. Hacé primero una copia de seguridad de Alimentación.
2. Verificá que estén instaladas las tablas de E2: `nutrition_weekly_plan_items`, `nutrition_shopping_items` y la tabla de recetas utilizada por el editor.
3. Ejecutá **una sola vez** `sql/23-nutrition-pantry.sql` en el SQL Editor de Supabase. La migración crea objetos nuevos de despensa; no elimina ni actualiza los registros de alimentación, agenda o entrenamiento existentes.
4. Ejecutá `sql/24-nutrition-pantry-postcheck.sql` y verificá que las tres tablas nuevas existan con RLS habilitado y los permisos RPC esperados.
5. Publicá `index.html`, `js/62-nutrition-week-planner-shopping.js`, `js/66-nutrition-pantry.js` y `css/89-nutrition-pantry.css`, respetando sus rutas.
6. Seguí `tests/MANUAL-PANTRY-E3-CHECKLIST.md` usando cuentas de prueba antes de cargar datos importantes.

## Límites que permanecen explícitos

- El inventario no es un sistema de lotes alimentarios certificado ni valida seguridad alimentaria; las fechas y cantidades son datos que ingresa el usuario.
- Los cálculos usan coincidencia conservadora por nombre, marca, unidad compatible y estado de preparación. No intentan inferir sinónimos.
- Las cantidades tienen precisión de tres decimales. En conversiones pequeñas de una unidad grande a una unidad pequeña, el descuento transaccional prefiere no retirar una fracción que la unidad almacenada no pueda representar con seguridad.
- Si la tabla de despensa aún no está instalada, la lista de compras E2 conserva el comportamiento previo y genera la lista completa sin descontar inventario, mostrando un aviso.
- Las pruebas locales inspeccionan el código y los cálculos puros, pero no prueban el proyecto real de Supabase. Deben verificarse RPC, permisos, RLS y consumo transaccional en una cuenta de prueba.

## Pruebas locales

Ejecutar desde el directorio del proyecto:

```bash
node tests/nutrition-pantry-stage-e3.test.cjs
for f in tests/*.test.cjs; do node "$f"; done
find js -name '*.js' -print0 | xargs -0 -n1 node --check
```

No se ejecutó la migración en la base real de Supabase desde esta entrega.
