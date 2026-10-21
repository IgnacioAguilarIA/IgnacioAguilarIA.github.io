# Lista de prueba manual — E14

Realizá estas comprobaciones con una cuenta de prueba antes de dar E14 por validada en producción.

## Carga diaria

- [ ] Abrí Alimentación con conexión y cambiá entre dos días. La carga muestra un indicador breve y luego la lista correcta.
- [ ] Desconectá Internet y cambiá de día. Debe aparecer «No pudimos cargar tus comidas», sin mostrar el estado vacío ni la guía de primera comida como si no hubiera datos.
- [ ] Si había comidas guardadas localmente, el mensaje debe aclarar que pueden estar desactualizadas.
- [ ] Volvé a conectarte y tocá «Reintentar». Debe volver a cargar el mismo día y retirar el aviso únicamente cuando la consulta tenga éxito.
- [ ] Cambiá de cuenta con un aviso visible. El reintento no debe mezclar datos de la cuenta anterior.

## Estados en herramientas

- [ ] Abrí Mis recetas, Mis alimentos, Historial y Estadísticas con conexión. Los estados «Cargando…» se reemplazan por resultados o estados vacíos claros.
- [ ] Simulá temporalmente un error de conexión en una herramienta compatible. El estado debe verse como error y ofrecer «Reintentar» solo si existe una acción de recarga segura.
- [ ] Tocá el reintento una vez y comprobá que no duplica registros ni hace dos consultas simultáneas visibles.
- [ ] Limpiá una búsqueda sin resultados. El estado vacío debe distinguirse del error de conexión.

## Móvil y accesibilidad

- [ ] Probá con un ancho cercano a 320 px y otro cercano a 390 px. No debe aparecer scroll horizontal accidental.
- [ ] El botón de reintento debe medir al menos 44 px de alto en móvil.
- [ ] Navegá por teclado y verificá el foco visible.
- [ ] Con movimiento reducido activado, el indicador no debe seguir animándose.
- [ ] Cambiá a Entrenamiento, Agenda y Calendario: sus estados visuales deben permanecer como antes.

## Límites de validación

- [ ] No dar por aprobada la etapa solo con las capturas estáticas: confirmar al menos un guardado/carga real con Supabase.
- [ ] No ejecutar ninguna migración SQL para E14; esta etapa es de interfaz y manejo del estado de carga.
