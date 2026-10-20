# Agenda FICH — Etapa D8: informes nutricionales por período

## Objetivo

Mejora el informe de calidad/procedencia de D7 para analizar el historial por un rango de fechas sin descargar toda la historia cada vez, exportar detalle histórico y exportar un resumen diario. No requiere migración de base de datos.

## Instalación

1. Hacé una copia de seguridad de la versión D7.
2. Aplicá los archivos del parche conservando sus rutas originales; o subí el proyecto completo.
3. No ejecutes SQL: D8 solo utiliza las columnas existentes instaladas en D7.

## Cambios

- Filtros de fechas inclusivos, validados y limitados a 366 días.
- La consulta histórica aplica `user_id`, fecha inicial y final del lado de Supabase, con paginación por bloques de 500 filas y verificaciones de cambio de cuenta.
- Resumen diario de 30 días por defecto, configurable para un rango de hasta 366 días.
- Los días sin registros se distinguen de los días con registro y valores cero.
- Los nutrientes desconocidos permanecen vacíos; nunca se transforman automáticamente en cero.
- CSV separado para alimentos y procedencia, historial detallado por período y resumen diario.
- El CSV neutraliza celdas que podrían interpretarse como fórmulas.
- Si el rango es inválido o falla una consulta, se deshabilitan las exportaciones del informe anterior para no producir archivos con filtros/fechas engañosos.

## Pruebas

Ejecutar `node tests/nutrition-stage-d8-period-report.test.cjs` y las suites de `tests/*.test.cjs`. Estas pruebas no reemplazan la validación con dos cuentas reales en Supabase.

## Alcance

Solo cambia `js/49-nutrition-persistence.js`, `js/65-nutrition-quality-report.js` y `css/88-nutrition-quality-report.css`. No cambia SQL, comidas, recetas, historial ni los módulos específicos de Entrenamiento, Agenda o navegación.
