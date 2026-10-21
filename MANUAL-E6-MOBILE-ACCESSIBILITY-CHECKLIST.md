# Agenda FICH — E6: checklist manual de móvil y accesibilidad

Esta etapa agrega ajustes responsive y táctiles de Alimentación. Las pruebas automatizadas y las vistas previas del navegador no reemplazan estas verificaciones en una instalación real.

## Dispositivos y tamaños sugeridos

- 320 × 740 px: teléfono estrecho.
- 360 × 800 px y 390 × 844 px: tamaños comunes de teléfono.
- 430 × 932 px: teléfono ancho.
- 768 × 1024 px: tableta en vertical.
- 844 × 390 px: teléfono en horizontal.
- 1366 × 768 px: computadora.

## Alimentación principal

- [ ] Los nombres de calorías, proteínas, carbohidratos y grasas no se superponen entre tarjetas en 320 px.
- [ ] Se pueden pulsar los siete días; ninguno queda fuera de pantalla.
- [ ] Las pestañas de comidas se ajustan a dos columnas y permiten leer sus textos.
- [ ] Los botones de objetivos, historial, agregar comida y acciones de cada comida se alcanzan sin toques demasiado precisos.
- [ ] Con Alimentación activa en móvil, el botón flotante global no cubre las tarjetas; «Agregar comida» sigue disponible.
- [ ] No aparece desplazamiento horizontal global. Los carruseles intencionales pueden desplazarse horizontalmente dentro de su propio contenedor.
- [ ] La navegación flotante inferior no oculta acciones importantes al final de la sección.

## Formularios y ventanas

- [ ] Abrir y cerrar Agregar comida y Objetivos.
- [ ] En un viewport bajo (por ejemplo, al aparecer el teclado), la acción «Guardar objetivos» se mantiene visible y los campos pueden recorrerse.
- [ ] En móvil, los formularios se colocan como hoja inferior y su contenido se puede recorrer hasta el último campo y botón.
- [ ] Con el teclado abierto, el campo activo y el botón Guardar siguen localizables. Probar también Safari en iOS si es un dispositivo de destino.
- [ ] La cabecera y el botón de cierre siguen visibles al desplazarse.
- [ ] Probar recetas avanzadas, despensa, plan semanal, lista de compras, escáner e informes.
- [ ] Rotar el teléfono con un modal abierto y comprobar que se puede seguir cerrando y guardando.

## Accesibilidad

- [ ] Recorrer controles con teclado físico: el foco es visible y el orden es lógico.
- [ ] Probar lectura por voz en títulos, campos, botones de cierre y estados de guardado.
- [ ] Aumentar zoom/tamaño de texto y comprobar que no se recorten acciones.
- [ ] Probar modo claro/oscuro, movimiento reducido y, cuando corresponda, alto contraste.
- [ ] Verificar que los errores se explican mediante texto y no únicamente con colores.

## Persistencia y regresión

- [ ] Guardar una comida, cerrar el diálogo, recargar y confirmar que sigue presente.
- [ ] Abrir una segunda sección y volver a Alimentación; no debe cambiar la sección por sí sola ni perder el día seleccionado.
- [ ] Ejecutar los flujos de recetas, planificador, compras, despensa y exportación con una cuenta de prueba.
- [ ] Confirmar manualmente que Entrenamiento, Agenda, Calendario y autenticación conservan su comportamiento previo.

## Auditoría automatizada E6

La medición estática en Chromium pasó 7 viewports (320, 360, 390, 430, 768, 844 apaisado y 1366 px de ancho) y un viewport de altura reducida 320×400. El resultado reproducible está en `tests/artifacts/e6/viewport-audit.json`. Esta evidencia no marca como completada la lista manual ni sustituye pruebas en un dispositivo físico.

## Registro de resultados

Anotar dispositivo/navegador, ancho × alto, resultado, pasos para reproducir el fallo y una captura si se detecta un problema.
