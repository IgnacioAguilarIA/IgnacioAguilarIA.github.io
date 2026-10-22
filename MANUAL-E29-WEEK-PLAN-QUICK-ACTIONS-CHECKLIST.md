# Lista de comprobación manual — E29

Realizar primero en una rama de prueba y con una copia de seguridad.

- [ ] Abrir Alimentación → Planificar semana y verificar que cada comida muestra los nutrientes presentes y que no muestra como cero un nutriente marcado como desconocido.
- [ ] En una comida con ingredientes y receta, elegir **Mover / organizar**, seleccionar otro día y confirmar. Recargar la página y verificar día, ingredientes, marcas, preparación, instantánea nutricional y advertencias.
- [ ] Abrir **Duplicar**, cambiar el día u horario y guardar. Confirmar que se crea una copia nueva, que la original permanece intacta y que la copia puede editarse de forma independiente.
- [ ] Usar **Duplicar en este día** desde el selector de organización. Verificar que el nuevo registro tiene clave independiente, pero conserva los ingredientes y metadatos de procedencia.
- [ ] Guardar una comida manual sin seleccionar plantilla ni receta. Debe guardar normalmente porque ambas opciones son opcionales.
- [ ] Abrir la misma comida en dos sesiones. Guardar un cambio desde la segunda sesión; al intentar guardar desde la primera, E29 debe rechazar el dato obsoleto y preservar los campos que estaban editándose.
- [ ] Tras recibir el aviso de conflicto, revisar la versión actualizada antes de pulsar Guardar cambios otra vez.
- [ ] Generar la vista previa de compras tras mover o duplicar comidas. Cancelar no debe escribir; confirmar debe reflejar el plan actualizado sin crear cantidades inventadas.
- [ ] Probar con una cuenta de prueba distinta y verificar que no puede leer ni modificar el plan de la primera cuenta.
- [ ] Probar ancho móvil (390 px aprox.), escritorio, tema claro y oscuro. Comprobar teclado, foco visible, ausencia de desbordamiento horizontal y navegación con Escape.

Si un paso falla, no continúes publicando la versión en producción hasta revisar el error.
