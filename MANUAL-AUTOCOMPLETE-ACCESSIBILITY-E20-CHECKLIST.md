# Lista manual — E20 Autocompletado accesible de Alimentación

## Preparación

- [ ] Abrir Alimentación y entrar en «Agregar comida».
- [ ] Probar tanto «Nombre de la comida» como «Buscar alimento».
- [ ] Repetir en móvil y escritorio; probar tema claro y oscuro si están disponibles.

## Teclado

- [ ] Escribir al menos dos letras y comprobar que aparezcan sugerencias.
- [ ] Pulsar `ArrowDown` y `ArrowUp`: el resultado activo debe cambiar visualmente y mantenerse visible.
- [ ] Pulsar `Enter`: debe seleccionarse el resultado activo, cerrarse el menú y quitarse la selección activa del campo.
- [ ] Abrir otra vez las sugerencias, elegir una opción con flechas y pulsar `Escape`: el menú debe cerrarse sin dejar una opción marcada.
- [ ] Pulsar `Tab` después de cerrar el menú: el foco debe continuar por el formulario en orden lógico.

## Lector de pantalla

- [ ] El campo debe anunciarse como cuadro combinado con sugerencias.
- [ ] Al recorrer resultados con flechas, el lector debe identificar la opción activa y su nombre.
- [ ] Durante la consulta debe anunciarse el estado de carga sin presentarlo como alimento.
- [ ] Si no hay coincidencias, debe anunciarse un mensaje informativo y no una opción seleccionable.

## Integridad funcional

- [ ] Confirmar que elegir una sugerencia conserva los datos del alimento y conduce al campo de cantidad tal como hacía antes.
- [ ] Confirmar que la búsqueda del título sigue pudiendo completarse escribiendo un nombre propio sin elegir sugerencia.
- [ ] Confirmar que el botón «Buscar alimento», los accesos rápidos y el escaneo/carga manual de código siguen disponibles.
- [ ] Guardar una comida de prueba y revisar su registro en la aplicación como de costumbre.
- [ ] Confirmar visualmente que Entrenamiento, Agenda y Calendario no recibieron cambios.

> La auditoría automatizada usa datos de prueba en Chromium. No reemplaza estas pruebas con lector de pantalla, dispositivo físico ni conexión real a Supabase/Open Food Facts.
