# E16 — Lista de comprobación manual

## Instalación
- [ ] Reemplazar `index.html` del paquete E16.
- [ ] Agregar `js/71-nutrition-meal-cards-e16.js`.
- [ ] Agregar `css/98-nutrition-meal-cards-e16.css`.
- [ ] Confirmar que se conservan las rutas `js/` y `css/`.
- [ ] Recargar la página sin caché y entrar en Alimentación.

## Tarjetas
- [ ] Abrir una comida que tenga calorías, proteínas y hora.
- [ ] Confirmar que el resumen muestra calorías, proteína y hora una sola vez en la fila rápida.
- [ ] Abrir «Ver detalles» y confirmar que se ven todos los ingredientes, las notas y los nutrientes originales.
- [ ] Cerrar los detalles y confirmar que el rótulo cambia a «Ver detalles» en móvil o «Ingredientes, notas y nutrientes» en escritorio.
- [ ] Comprobar una comida sin proteína o sin hora: no debe inventar valores ni mostrar chips vacíos.
- [ ] Comprobar una comida sin calorías: no debe aparecer una insignia de calorías inventada.
- [ ] Confirmar que Editar y Eliminar siguen abriendo las acciones originales.
- [ ] Marcar/desmarcar alimentos consumidos y confirmar que el panel de consumo conserva su lugar y funcionamiento.

## Responsive y accesibilidad
- [ ] Probar 320, 390 y 430 px, una tableta y escritorio.
- [ ] Confirmar que no existe desplazamiento horizontal involuntario.
- [ ] Usar la tecla Tab para llegar a Editar, Eliminar y el desplegable de detalles.
- [ ] Comprobar el anuncio accesible del desplegable cuando abre y cierra.
- [ ] Revisar tema claro y oscuro.
- [ ] Revisar preferencia «reducir movimiento» y modo de alto contraste si están disponibles.

## Alcance de las pruebas
La auditoría de Chromium utiliza comidas ficticias y valida la presentación y los manejadores simulados. No sustituye una prueba en teléfono físico ni las pruebas de guardado contra la cuenta de Supabase real.
