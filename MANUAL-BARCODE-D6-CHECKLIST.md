# Comprobación manual — Etapa D6

Esta etapa no necesita migración SQL nueva. Hacé estas pruebas en un entorno de prueba primero.

## Búsqueda por nombre
- Buscar un alimento con el nombre exacto: la coincidencia exacta debe aparecer antes de resultados aproximados.
- Probar un error pequeño de escritura (por ejemplo, omitir una letra): deben aparecer resultados similares si Open Food Facts devuelve datos.
- Cuando una misma ficha aparezca repetida con el mismo código, no debería mostrarse dos veces.
- Desconectar internet y comprobar que el buscador muestra el error apropiado sin bloquear los alimentos propios.

## Código de barras
- Abrir Alimentación → Buscar o elegir alimento → Escanear / ingresar código.
- Introducir un EAN/UPC conocido y confirmar que la ficha seleccionada coincide con el envase.
- Introducir un código inexistente: la aplicación debe informar que no lo encuentra sin añadir una comida automáticamente.
- Probar un código mal formado: debe explicar qué formato acepta.
- En navegador compatible y contexto HTTPS/localhost, permitir la cámara, escanear un envase y comprobar que la cámara se detenga tras detectar el código.
- Denegar el permiso de cámara (o usar un navegador sin `BarcodeDetector`): el ingreso manual debe continuar disponible.
- Cerrar el catálogo o enviar la página a segundo plano: la cámara debe detenerse.
- Probar un producto con nutrientes principales ausentes: debe mostrar cuáles faltan y no permitir sumarlo al registro ni guardarlo como si esos valores desconocidos fueran cero.
- Confirmar que seleccionar un producto no lo guarda ni lo añade automáticamente; las acciones requieren revisión y confirmación.

## Protección de otras funciones
- Registrar una comida de prueba con un producto completo y revisar sus totales.
- Abrir recetas, copiar día, planificar semana y lista de compras para comprobar que no hubo regresiones.
- Comprobar Agenda, Entrenamiento, autenticación y navegación, que no forman parte de los cambios D6.

La cámara requiere permisos y un contexto seguro. La información externa puede estar desactualizada o incompleta; cotejá siempre la etiqueta del envase antes de confirmar valores.
