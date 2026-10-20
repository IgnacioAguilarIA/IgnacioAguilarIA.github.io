# Agenda FICH — Etapa E1: primera protección del respaldo y restauración de Alimentación

## Alcance

Esta etapa trabaja solo las rutas de importación relacionadas con Alimentación. Los cambios de lógica se limitan a los bloques nutricionales de `js/03-inline-script-03.js` (importación) y `js/04-inline-script-04.js` (normalización de la cola en la exportación). No modifica cálculos, vistas ni operaciones de Entrenamiento, Agenda o Calendario; cuando Alimentación no está seleccionada, el flujo anterior de importación se conserva. No requiere migración SQL.

## Cambios

- Cuando se selecciona Alimentación, valida el formato y la versión declarados en el respaldo. Rechaza metadatos inconsistentes, formatos ajenos o versiones no compatibles antes de consultar o escribir datos.
- Para un respaldo versión 3, exige las seis colecciones nutricionales esperadas y la configuración local de Alimentación.
- La confirmación muestra nombre del archivo, versión, fecha/cuenta indicadas en el respaldo y cantidades de comidas, detalles, alimentos personales, recetas, historial y preferencias.
- El modo reemplazo no continúa si faltan colecciones nutricionales necesarias. Una copia parcial todavía puede utilizarse en modo agregar cuando sus datos sean compatibles.
- Captura de forma paginada los IDs históricos de la cuenta con un orden estable.
- Las inserciones del historial ocurren antes de limpiar los registros nutricionales anteriores. La limpieza histórica se limita a los IDs preexistentes capturados, en lugar de borrar toda la tabla del usuario después de insertar el nuevo historial.
- Los registros de consumo que estaban pendientes se remapean a los IDs nuevos de comidas y alimentos generados durante la importación, para no perder la intención de reintento por depender de identificadores antiguos.

## Pruebas locales

Ejecutar:

```sh
node tests/nutrition-restore-hardening-e1.test.cjs
node tests/nutrition-stage-a.test.cjs
node tests/nutrition-sync-hardening-d1.test.cjs
```

También conviene ejecutar todas las suites `tests/*.test.cjs` del proyecto.

## Límites que siguen abiertos

Esta es una mejora incremental de seguridad del flujo, **no convierte toda la restauración en una única transacción de Supabase**. Las solicitudes HTTP siguen siendo operaciones separadas; si la conexión se interrumpe durante la fase final de limpieza, puede quedar una combinación de filas importadas y antiguas. Además, la importación de alimentos personales utiliza una clave única por cuenta y huella, por lo que una coincidencia puede actualizar el registro existente antes de que termine todo el proceso. La solución completa requiere una función transaccional del lado servidor, contrastada con el esquema real instalado.

Por ese motivo, el reemplazo debe probarse primero con una cuenta de prueba y una copia recuperable. No se ejecutó ninguna operación contra Supabase real ni se considera cerrada la auditoría de producción con las pruebas locales solamente.

## Verificación local realizada

En la revisión de esta entrega:

- Pasaron las 16 suites automatizadas disponibles (`tests/*.test.cjs`), incluidas las pruebas de restauración, sincronización, aislamiento de cuentas, catálogo, recetas, unidades, accesibilidad, planificación e informes.
- Los 66 archivos JavaScript del proyecto pasaron la comprobación de sintaxis.
- No se ejecutaron migraciones ni operaciones contra una cuenta real de Supabase.

Estos resultados validan el código local y los escenarios simulados por las pruebas; no reemplazan el checklist manual de producción de `tests/MANUAL-SYNC-PRODUCTION-CHECKLIST.md`.
