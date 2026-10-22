# Lista de comprobación manual — E30

Realizar en una rama de prueba y con una comida/receta de prueba. No usar datos importantes hasta comprobar guardado y reapertura.

## Ajustar porciones de una receta planificada

- [ ] Crear o elegir una receta con cantidades conocidas y guardarla dentro de una comida del plan semanal.
- [ ] Cerrar y volver a abrir el plan; verificar que la comida muestra el nombre de la receta y las porciones previstas.
- [ ] Pulsar **Ajustar porciones**; confirmar que el campo se abre enfocado con el valor actual.
- [ ] Cambiar de 2 a 3 porciones; comprobar que se anuncia un factor de ×1,5 y pulsar Guardar cambios.
- [ ] Volver a abrir la comida; verificar que las cantidades conocidas y los nutrientes disponibles se multiplicaron por 1,5.
- [ ] Confirmar que ingredientes con cantidad desconocida siguen marcados como desconocidos y que los nutrientes ausentes no se convierten en cero.
- [ ] Confirmar que el registro de la receta guardada no cambió: nombre, rendimiento, ingredientes y datos originales deben permanecer intactos.
- [ ] Regenerar la vista previa de la lista de compras y revisar las variaciones antes de confirmarlas.

## Protección de instantáneas

- [ ] Editar solo el título, el horario o las notas de otra comida basada en una receta.
- [ ] Volver a abrirla y confirmar que se conservaron procedencia, calidad de los datos, unidades y preparación de cada ingrediente.
- [ ] Cambiar los ingredientes de la receta original después de planificar la comida; confirmar que la instantánea semanal no cambia por sí sola.
- [ ] Intentar cantidades vacías, cero, negativas y superiores a 1.000 porciones; el editor debe bloquearlas con un mensaje comprensible.

## Sincronización real

- [ ] Con la misma cuenta abierta en dos dispositivos, modificar la comida en el segundo mientras el primero tiene el editor abierto. El primer dispositivo no debe sobrescribir la modificación reciente silenciosamente.
- [ ] Repetir con dos cuentas de prueba diferentes y confirmar que cada una ve únicamente sus propias comidas y recetas.
- [ ] Guardar, cerrar la aplicación y volver a abrirla para confirmar que el estado persiste en Supabase.

## Móvil y accesibilidad

- [ ] Probar un ancho de 320–390 px, con teclado abierto y en orientación vertical.
- [ ] Navegar el formulario con Tab/Mayús+Tab; verificar foco visible, etiquetas y lectura del texto de ayuda.
- [ ] Comprobar tema claro/oscuro y la preferencia de movimiento reducido.

**Importante:** la suite automatizada se ejecuta con Supabase simulado. Esta lista sirve para validar lo que solo puede comprobarse contra el proyecto real.
