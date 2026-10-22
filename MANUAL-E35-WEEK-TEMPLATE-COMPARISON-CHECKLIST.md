# Lista manual de comprobación E35

- [ ] Abrir el gestor de plantillas; la acción «Comparar» tiene nombre accesible y estado `aria-pressed` correcto.
- [ ] Elegir una plantilla A: se indica que falta seleccionar B.
- [ ] Elegir una plantilla B: aparece el panel con las diferencias.
- [ ] Comparar dos copias del mismo contenido: los identificadores distintos no se muestran como diferencias de contenido.
- [ ] Comparar plantillas distintas: se identifican comidas exclusivas de A y B y los cambios de ingredientes/cantidades.
- [ ] Verificar que un nutriente cero se distingue de un nutriente desconocido o incompleto.
- [ ] Limpiar la comparación: se cierra el panel y el foco vuelve al control de comparación.
- [ ] Comprobar que abrir, usar, cambiar o limpiar la comparación no modifica el plan semanal ni las preferencias.
- [ ] Probar en un ancho de 390 px y confirmar que no hay desbordamiento horizontal.
- [ ] Repetir en tema claro y oscuro; comprobar títulos, textos, diferencias y detalles.
- [ ] Probar teclado (Tab/Enter/Escape según control) y foco visible.

Esta lista manual complementa las pruebas automatizadas. La instancia de Supabase real no está conectada a la auditoría local.
