# D8 — lista de prueba funcional en navegador

Esta etapa no requiere migración SQL nueva. El CSV del SQL 22 no mostró problemas de procedencia en los contadores revisados; se recomienda probar con datos de prueba y no alterar registros reales innecesariamente.

## Informe por período

1. Abrí Alimentación → «Calidad y exportar». El rango inicial debe abarcar los últimos 30 días locales.
2. Confirmá que el informe muestra el número de alimentos propios y los consumos del rango seleccionado.
3. Elegí un rango de 7 días y pulsá «Aplicar período». Comprobá que el historial se actualice y que el nombre del CSV incluya esas fechas.
4. Cambiá las fechas sin pulsar «Aplicar período». Las exportaciones de historial/resumen diario deben quedar deshabilitadas y mostrarse un aviso de que hay que aplicar el período.
5. Intentá una fecha inicial posterior a la final y un rango mayor a 366 días. Debe mostrarse un error y no debe quedar visible un resumen anterior como si correspondiera al rango inválido.

## Interpretación de datos

6. En un rango con un día sin entradas, la columna de estado debe decir «Sin registros» y las cantidades numéricas deben quedar en blanco.
7. Si hay un registro cuyos nutrientes realmente son cero, debe aparecer «Con registros» y el valor `0`, no un campo vacío.
8. Si falta un dato nutricional en una instantánea histórica, ese nutriente debe quedar sin total numérico y aumentar el contador de registros incompletos.

## Exportaciones

9. Exportá el historial y comprobá fecha, comida, alimento, cantidad/unidad, procedencia, estado de calidad, preparación y nutrientes faltantes.
10. Exportá el resumen diario y comprobá que haya una fila por cada fecha del rango, incluidos los días sin registros.
11. Exportá alimentos y verificá procedencia/URL/estado de calidad. El CSV debe abrirse sin que valores de texto sean interpretados como fórmulas.

## Producción

12. Realizá una prueba de lectura con la cuenta de prueba, y si tenés dos cuentas autorizadas, verificá que cambiar de cuenta no mantenga los resultados anteriores.
13. Recargá la página; revisá que no se cambien los datos ni el historial. Esta etapa no escribe ni modifica filas nutricionales.
