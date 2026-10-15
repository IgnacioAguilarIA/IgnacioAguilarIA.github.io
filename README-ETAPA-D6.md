# Agenda FICH — Etapa D6: buscador inteligente y lector de códigos

## Qué incorpora
- Búsqueda externa ordenada por relevancia, coincidencias exactas primero y tolerancia conservadora a errores tipográficos comunes.
- Deduplicación de respuestas de Open Food Facts. Cuando el mismo código aparece más de una vez, prioriza la copia con datos nutricionales más completos.
- Detección explícita de energía, proteínas, carbohidratos y grasas que no estén presentes como datos por 100 g. Un campo omitido no se presenta como si su valor cero estuviera confirmado.
- Panel de código de barras dentro del catálogo de Alimentación. Permite escribir manualmente códigos EAN-8, UPC-A, EAN-13 y GTIN-14.
- Escaneo con cámara cuando el navegador admite `BarcodeDetector` y `getUserMedia` (normalmente en HTTPS o localhost). Si no están disponibles o se deniega el permiso, el ingreso manual continúa funcionando.
- Detención de la cámara al cerrar el panel, al pasar la página a segundo plano o antes de abandonar la página.
- Al localizar un producto, se envía al selector actual de alimentos; no se guarda ni se añade a una comida automáticamente. El usuario debe revisar nombre, marca, cantidad y valores antes de confirmar.
- Los productos externos con cualquiera de los cuatro valores nutricionales principales desconocido no pueden añadirse a un registro ni guardarse como alimento propio hasta completar esos datos. Esto evita interpretar datos omitidos como ceros reales.
- Caché de búsqueda con nueva versión para no reutilizar indefinidamente resultados guardados con el formato anterior.

## Instalación
1. Hacé una copia de seguridad de D5.
2. Subí los archivos del proyecto completo o aplicá el parche manteniendo las rutas.
3. No requiere SQL nuevo ni cambios en Supabase.
4. Abrí Alimentación → Buscar o elegir alimento → Escanear / ingresar código.
5. La cámara requiere permiso del navegador y un contexto seguro. Podés usar siempre la entrada manual como alternativa.

## Límites importantes
- Open Food Facts puede no contener el producto o tener datos incompletos. Siempre revisá la etiqueta física antes de confirmar sus valores.
- Un código con dígito de control no válido se consulta igualmente, pero la interfaz muestra una advertencia; no se bloquean códigos que algunas fuentes gestionen de manera excepcional.
- El soporte real de cámara depende del navegador y del dispositivo; la ruta manual es la alternativa garantizada.
- La búsqueda por texto depende de Open Food Facts para resultados externos. El catálogo personal se sigue consultando primero.
- No se modifican comidas, recetas, historial, rutina semanal ni registros existentes.

## Pruebas
Ejecutar la prueba nueva:
```sh
node tests/nutrition-stage-d6-search-barcode.test.cjs
```
Y todas las suites:
```sh
for f in tests/*.test.cjs; do node "$f" || exit 1; done
```

## Alcance protegido
Solo se modifican el adaptador externo y el módulo de catálogo de Alimentación, el HTML de referencias, y se agregan recursos de lector, estilos, pruebas y documentación. No se modifican módulos de Entrenamiento, Agenda, autenticación ni navegación.
