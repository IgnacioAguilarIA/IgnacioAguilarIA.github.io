# Agenda FICH — Etapa E5: exportación útil y acabado cotidiano de Alimentación

## Alcance

Etapa incremental sobre E4B, limitada a los módulos propios de Alimentación para planificación fechada, despensa y estado de sincronización nutricional. No requiere migraciones SQL y no necesita cambios en `index.html`, CSS, Entrenamiento, Agenda ni Calendario.

## Mejoras incluidas

### 1. Exportar plan semanal fechado

- El editor de `Planificar semana` incorpora **Exportar plan CSV**.
- La exportación usa los registros cargados para la semana activa y vuelve a verificar que la cuenta no haya cambiado.
- El CSV incluye una fila resumen por comida y filas específicas de ingredientes. El resumen contiene las notas, los macros de referencia y la procedencia/rendimiento de la receta cuando están disponibles; las filas de ingrediente contienen marca, cantidad, estado de conocimiento de cantidad, unidad, preparación y categoría.
- Cuando una cantidad es desconocida se exporta vacía y marcada como no definida: no se convierte en cero.
- Al cambiar de semana, la caché anterior se limpia antes de iniciar la nueva lectura. Si la lectura falla, el botón permanece deshabilitado y no puede descargar filas antiguas con el nombre de una semana nueva.

### 2. Exportar las vistas de despensa

El botón **Exportar vista CSV** descarga los datos de la vista actualmente seleccionada:

- **Inventario:** lotes activos y archivados, marca, cantidad, unidad, preparación, vencimiento, ubicación, notas y fecha de actualización.
- **Faltantes de compras:** cantidad necesaria, stock compatible y cantidad faltante; los casos desconocidos continúan identificándose como desconocidos.
- **Uso de comidas:** instantáneas del plan fechado y los ingredientes que se seleccionaron para esa semana.
- **Movimientos:** últimos 100 movimientos que presenta la vista, con fecha, tipo, cambio, saldo anterior y posterior y motivo. El nombre del archivo indica expresamente que es la ventana de los últimos 100 registros, no un historial ilimitado.

Las exportaciones verifican la cuenta activa y limpian las cachés al cerrar la despensa o detectar un cambio de sesión. La exportación no modifica datos ni registra compras/consumos.

### 3. Seguridad y compatibilidad CSV

- Los archivos usan UTF-8 con BOM y separador `;`, apropiado para abrirse con aplicaciones de hojas de cálculo configuradas para español.
- Las celdas que comienzan con caracteres susceptibles de interpretarse como fórmula (`=`, `+`, `-`, `@`, incluso después de espacios) se neutralizan antes de entrecomillarse.
- Las URLs temporales de descarga no se revocan inmediatamente: se espera 1,5 segundos para dar tiempo al navegador a iniciar la descarga.
- Se mantiene la exportación existente de lista de compras; solo se ajusta la revocación del URL temporal.

### 4. Estado sin conexión más transparente

El aviso nutricional diferencia las preferencias/favoritos y determinados consumos que pueden conservarse localmente de las comidas, recetas, planificación, compras y despensa, que requieren conexión para confirmar el guardado. El mensaje deja explícito que no todas las operaciones se encolan automáticamente. No se agregó una promesa de funcionamiento sin conexión que el código actual no pueda garantizar.

## Archivos de runtime modificados

- `js/57-nutrition-account-sync.js`
- `js/62-nutrition-week-planner-shopping.js`
- `js/63-nutrition-week-plan-editor.js`
- `js/66-nutrition-pantry.js`
- `tests/nutrition-stage-e5-final-polish.test.cjs` (nueva suite)

No se cambian SQL, `index.html`, CSS ni módulos específicos de Entrenamiento. No se debe ejecutar ninguna migración por E5.

## Instalación

1. Si la última versión desplegada es E4B, reemplazá en GitHub los cuatro archivos JavaScript de runtime de arriba, respetando las rutas.
2. No hace falta modificar el HTML ni ejecutar consultas SQL nuevas.
3. Publicá la app y seguí la lista de pruebas manuales `tests/MANUAL-E5-EXPORT-OFFLINE-CHECKLIST.md`.
4. Verificá cada vista con una cuenta de prueba antes de exportar datos importantes.

## Pruebas automatizadas

Desde la raíz del proyecto:

```bash
node tests/nutrition-stage-e5-final-polish.test.cjs
for f in tests/*.test.cjs; do node "$f"; done
find js -name '*.js' -print0 | xargs -0 -n1 node --check
```

Estas pruebas cubren la composición del CSV, el alineamiento de columnas, la neutralización de fórmulas, el rechazo de cachés de otra semana y la separación de cuentas a nivel de código. No reemplazan la prueba visual en un teléfono ni la verificación con el proyecto real de Supabase.
