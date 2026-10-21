# Lista manual de verificación — Etapa E5

Realizá estas pruebas con una cuenta de prueba y datos no sensibles.

## Instalación y alcance

- [ ] Reemplazar solamente `js/57-nutrition-account-sync.js`, `js/62-nutrition-week-planner-shopping.js`, `js/63-nutrition-week-plan-editor.js` y `js/66-nutrition-pantry.js`.
- [ ] Confirmar que no se ejecuta SQL para esta etapa.
- [ ] Abrir Alimentación, Entrenamiento, Agenda y Calendario; comprobar que siguen abriendo y cambiando de sección normalmente.

## Planificación fechada

- [ ] Abrir «Planificar semana», elegir una semana con comidas y pulsar «Exportar plan CSV».
- [ ] Abrir el CSV en una hoja de cálculo y verificar que hay una fila resumen por comida y filas separadas por ingrediente.
- [ ] Verificar que las notas, las categorías, las unidades, los estados crudo/cocido y los metadatos de receta aparecen en las columnas correctas.
- [ ] Probar una cantidad desconocida y confirmar que queda vacía y marcada como no definida, nunca convertida en cero.
- [ ] Cambiar a una semana sin datos o simular que la consulta falla. La exportación debe deshabilitarse; no debe descargar la semana anterior bajo la fecha nueva.
- [ ] Probar un título de comida que empiece con `=`, `+` o `@`; el CSV debe neutralizarlo como texto.

## Lista de compras y despensa

- [ ] Exportar una lista semanal y verificar categoría, producto, unidad y marca «comprado».
- [ ] En Despensa → Inventario, exportar con lotes activos y archivados y comprobar el estado de cada lote.
- [ ] En Despensa → Faltantes de compras, comprobar que se exportan las cantidades conocidas y que los valores desconocidos siguen marcados.
- [ ] En Despensa → Uso de comidas, comprobar que se exportan las instantáneas de los ingredientes de la semana activa.
- [ ] En Despensa → Movimientos, comprobar que el archivo se identifica como los últimos 100 movimientos.
- [ ] Introducir en notas o nombres de prueba texto que comience con `=`, `+`, `-` o `@`, y comprobar que el archivo neutraliza fórmulas al abrirlo en la hoja de cálculo.
- [ ] Confirmar que exportar no cambia cantidades, no marca artículos comprados y no registra consumo.

## Cuenta y conectividad

- [ ] Abrir la despensa con la cuenta de prueba A, cerrar sesión, entrar con la cuenta B y verificar que no se puede exportar la vista anterior antes de recargar la cuenta activa.
- [ ] Probar exportación en un teléfono, en orientación vertical y con el teclado cerrado; los botones deben poder alcanzarse y enfocarse.
- [ ] Desactivar la conexión y revisar que el estado distingue las operaciones locales de las que necesitan conexión para confirmar el guardado.
- [ ] Volver a conectar y comprobar el estado individual de cada operación; no asumir que todas las acciones se sincronizan automáticamente.
