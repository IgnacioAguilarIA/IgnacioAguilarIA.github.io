# Prueba manual D7 — procedencia y CSV

Realizar tras ejecutar `sql/21-nutrition-quality-provenance.sql` y publicar D7. Preferir una cuenta de prueba.

1. Abrir Alimentación → **Calidad y exportar**. Confirmar que el informe carga sin errores y muestra estados diferentes para registros anteriores, cargas manuales y productos de fuente externa.
2. Abrir un alimento guardado que se pueda revisar con su etiqueta. Comparar nombre, marca, porción y valores. Usar **Confirmé la etiqueta** solo si efectivamente se revisaron esos datos; comprobar que el estado y la fecha de verificación se guardaron después de actualizar el informe.
3. Exportar alimentos a CSV y abrirlo en una hoja de cálculo. Confirmar que los nombres con comas, comillas, tildes o caracteres de fórmula no se interpretan como fórmulas.
4. Exportar el historial a CSV. Verificar fecha, comida, cantidad/unidad, nutrientes, procedencia y el estado de calidad de la instantánea guardada.
5. Probar con historial mayor a 500 registros, si lo hay, y confirmar que el CSV incluye registros de más de una página sin duplicados.
6. Cerrar sesión o cambiar de usuario con una lista de prueba; el informe debe fallar de forma segura y no mostrar datos de la cuenta anterior.
7. Confirmar que los consumos históricos no cambian solo porque se marque como verificado el alimento propio actual.

Los valores `legacy_unverified` no deben reinterpretarse como verificados automáticamente. La acción de verificación registra una confirmación explícita del usuario, no una certificación independiente.
