# Agenda FICH — Etapa D7: calidad, procedencia y exportación nutricional

## Objetivo

Añade trazabilidad legible de la procedencia de los alimentos, distingue registros verificados por el usuario de registros antiguos o manuales no verificados y permite exportar CSV del catálogo personal y del historial de consumo.

## Instalación

1. Hacer una copia de seguridad.
2. En Supabase SQL Editor, ejecutar una sola vez `sql/21-nutrition-quality-provenance.sql`.
3. Verificar el resultado con `sql/22-nutrition-quality-postcheck.sql`.
4. Publicar el proyecto manteniendo las rutas existentes.

La migración es aditiva, habilita restricciones sobre nuevas columnas y no elimina ni actualiza nutrientes históricos. Los registros existentes quedan etiquetados como `legacy_unverified` cuando no hay prueba de procedencia/verificación. No se deduce que un cero sea correcto a partir de su valor.

## Funciones

- Los resultados de Open Food Facts incluyen etiqueta y URL de origen, el estado `source_complete` si los campos principales están informados, y sus nutrientes faltantes si la fuente no los informa.
- Al guardar alimentos propios y artículos de comidas, la procedencia y el estado de calidad quedan copiados en la fila.
- Un usuario puede marcar un alimento propio como `user_verified` después de confirmar explícitamente que revisó su etiqueta; esto registra la confirmación del usuario y fecha, no una certificación independiente.
- El diálogo «Calidad y exportar» resume el catálogo personal y exporta todo el historial recuperado por páginas, con instantánea de procedencia y calidad.
- Los CSV neutralizan valores que podrían ser interpretados como fórmulas por hojas de cálculo.
- Las consultas del informe siempre filtran por la cuenta activa y se detienen si la sesión cambia.

## Notas y límites

- Debe ejecutarse SQL 21 antes de publicar los JS, ya que los guardados consultan las columnas nuevas.
- No se guardan enlaces externos si no utilizan HTTP/HTTPS.
- Los registros históricos existentes no se reescriben con datos actuales del catálogo. En el CSV se clasifican como no verificados si no contienen metadatos de procedencia.
- Las pruebas locales no sustituyen una prueba con dos cuentas reales ni una comprobación visual de móvil/escritorio.
- No se modifican los módulos de Entrenamiento, Agenda ni navegación.
