# E15 — Pruebas manuales

Probar primero con una cuenta de prueba y después con el uso normal.

## Centro «Más herramientas»
- [ ] En un celular, solo «Agregar comida» y el acceso «Más herramientas» se ven en la cabecera inicial.
- [ ] Al abrir «Más herramientas» se muestran las categorías Planificar, Preparar, Organizar y Consultar.
- [ ] «Mis recetas» abre la lista de recetas existente.
- [ ] Objetivos, historial, estadísticas, calidad/informes, planificación semanal, copiar día, compras y despensa siguen abriendo sus pantallas existentes.
- [ ] El contador refleja la cantidad de botones disponibles.
- [ ] Si se inicializa una herramienta después de abrir Alimentación (por ejemplo tras cambiar sesión), aparece en el grupo correcto y conserva su acción.
- [ ] Al cerrar el apartado, no ocupa espacio con los grupos.

## Tarjetas de comidas
- [ ] En celular se ven nombre, resumen breve, calorías conocidas y botones de acción.
- [ ] «Ver ingredientes, notas y nutrientes» expande y contrae los detalles.
- [ ] En escritorio el detalle comienza visible.
- [ ] Editar abre la comida correcta.
- [ ] Eliminar sigue mostrando la confirmación habitual y elimina solo la comida elegida.
- [ ] Los botones de duplicar y el panel de consumo de ingredientes siguen funcionando.
- [ ] Las comidas antiguas sin ingredientes detallados siguen pudiéndose editar.
- [ ] Los alimentos con datos incompletos no se convierten en nutrientes cero por este cambio visual.

## Responsive y accesibilidad
- [ ] Probar 320, 390, 768 y 1366 px; no debe aparecer scroll horizontal.
- [ ] En teléfono/tableta táctil, las acciones principales son fáciles de tocar (objetivo mínimo de 44 px).
- [ ] Tab y Shift+Tab muestran el foco visible.
- [ ] Probar tema claro y oscuro.
- [ ] Con preferencia de movimiento reducido, los cambios no dependen de animaciones.

## Alcance
- [ ] Entrenamiento, Agenda y Calendario se comportan como antes.
- [ ] No se ejecuta SQL ni se modifican registros por abrir/cerrar herramientas o detalles.
