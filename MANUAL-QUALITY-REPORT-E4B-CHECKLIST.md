# Lista manual — E4B calidad nutricional e informes

Usá una cuenta de prueba y evitá modificar registros de producción para fabricar casos anómalos. Las alteraciones de valores para probar alertas deben hacerse en datos de prueba y luego descartarse.

## Instalación y regresión

- [ ] Subir los archivos `js/49-nutrition-persistence.js`, `js/65-nutrition-quality-report.js` y `css/88-nutrition-quality-report.css` conservando sus rutas.
- [ ] Confirmar que `index.html` continúa cargando `js/65-nutrition-quality-report.js` y `css/88-nutrition-quality-report.css`.
- [ ] Abrir Alimentación en computadora y teléfono; abrir el panel «Calidad y exportar» y cerrar con el botón, Escape y el control de cierre visual.
- [ ] Confirmar que no aparecen errores JavaScript y que el resto de las secciones sigue accesible sin cambios.

## Auditoría de datos

- [ ] Un alimento con valores completos y coherentes, procedencia identificada y fecha de verificación reciente no debe producir alertas innecesarias.
- [ ] Un alimento con un nutriente faltante debe mostrar qué dato falta y no convertirlo en cero.
- [ ] Un alimento de prueba con un valor negativo debe generar un hallazgo; el valor debe permanecer intacto.
- [ ] Un alimento con valores altos por 100 g debe recibir una advertencia, no bloquearse ni borrarse automáticamente.
- [ ] Un registro con estado `source_complete` y nutrientes faltantes debe marcarse como contradictorio.
- [ ] Un valor energético muy distinto de la estimación de macronutrientes debe mostrar una advertencia orientativa, explicando que no prueba por sí misma un error.
- [ ] Un alimento con procedencia no identificable debe producir un hallazgo.
- [ ] Revisar que la fecha de verificación se vea cuando está disponible y que la acción «Confirmé la etiqueta» explique que solo registra la confirmación del usuario.
- [ ] Exportar la auditoría CSV y comprobar que incluye hallazgos, detalles y filas explícitas para alimentos sin alertas.
- [ ] Exportar los alimentos CSV y comprobar que incluye el conteo y los títulos de las alertas.

## Filtros y comparación de períodos

- [ ] Seleccionar siete días y confirmar que el período de comparación cubre los siete días inmediatamente anteriores, sin solapamiento.
- [ ] Probar una semana con días sin registros: esos días deben verse como «Sin registros», nunca como consumo cero.
- [ ] Probar un día con calorías registradas en cero: el valor debe permanecer como cero.
- [ ] Probar un período donde una comida no tenga un nutriente. El total del período para ese nutriente no debe presentarse como completo; cualquier subtotal y promedio debe especificar cuántos días sí tenían datos.
- [ ] Confirmar que el porcentaje de cambio no se calcula si falta un total completo o si la base anterior es cero.
- [ ] Cambiar la categoría a Almuerzo y verificar que se filtren el resumen, la comparación y el CSV, incluyendo tanto datos históricos `lunch` como datos en español `almuerzo`.
- [ ] Probar Merienda, Cena, Colación, Pre/Post entrenamiento y Otra/sin categoría con registros de prueba.
- [ ] Cambiar fechas sin aplicar y comprobar que las exportaciones de historial y resumen queden desactivadas hasta recargar el período.
- [ ] Si falla la consulta del período anterior, confirmar que el informe actual sigue siendo útil y el error de comparación se informa explícitamente.

## Cuenta, fuente de datos y CSV

- [ ] Iniciar sesión con dos cuentas de prueba y verificar que cada informe muestra solo los datos de la cuenta activa.
- [ ] Cambiar de cuenta durante las pruebas y asegurarse de que no queden visibles los datos del usuario anterior.
- [ ] Exportar el historial filtrado y comprobar que la categoría y el período del nombre coinciden con lo mostrado.
- [ ] Abrir los CSV en un editor de texto y comprobar que los nombres que empiezan con `=`, `+`, `-` o `@` están neutralizados para evitar la interpretación como fórmula en una hoja de cálculo.
- [ ] Confirmar que los datos del catálogo y el historial no fueron modificados solo por visualizar o exportar el informe.
