# AgendaFICH — Etapa E25

## Objetivo

Mejorar la fiabilidad de las recetas nutricionales y la seguridad del editor, conservando la experiencia existente de Alimentación. E25 se aplica incrementalmente sobre el paquete E24 probado.

## Qué cambia

- `js/49-nutrition-persistence.js`: los cálculos de receta devuelven `unknownMetrics` cuando los ingredientes declaran nutrientes incompletos. Los nutrientes afectados usan un cero técnico únicamente para respetar las columnas numéricas `NOT NULL` del esquema actual; los controles visuales deben consultar `unknownMetrics` y mostrar “Datos incompletos”. Los ingredientes JSON mantienen la procedencia y los campos faltantes.
- `js/58-nutrition-advanced.js`: el editor, las tarjetas de recetas y el historial recalculan los valores desde las instantáneas de ingredientes para no presentar esos ceros técnicos como valores nutricionales reales. Los ingredientes sin información se etiquetan como “No informado”. El editor avisa al cerrar si hay modificaciones sin guardar y permite deshacer la eliminación de un ingrediente durante ocho segundos.
- `js/63-nutrition-week-plan-editor.js`: al planificar una receta, escala los valores conocidos al número de porciones indicado y conserva el conjunto de nutrientes incompletos en `nutrition_snapshot`. El plan muestra una advertencia y la exportación deja en blanco los valores desconocidos.
- `css/106-nutrition-recipe-quality-e25.css`: estilos acotados al editor y al plan de Alimentación, con soporte para móvil, foco visible, movimiento reducido, contraste forzado y tema oscuro de la aplicación.
- `index.html`: añade la hoja de estilos E25 y cambia las versiones de caché de los módulos modificados.

## Instalación

1. Hacé una copia de seguridad del repositorio o creá una rama de prueba.
2. Extraé `AgendaFICH_E25_patch.zip`.
3. Desde la carpeta `AgendaFICH_E25_patch`, reemplazá estos archivos conservando las rutas:
   - `index.html`
   - `js/49-nutrition-persistence.js`
   - `js/58-nutrition-advanced.js`
   - `js/63-nutrition-week-plan-editor.js`
4. Agregá `css/106-nutrition-recipe-quality-e25.css` dentro de `css/`.
5. Publicá los cambios. Después de la actualización, abrí la app con conexión para que el navegador/PWA obtenga las nuevas URLs con `?v=e25`.

**No ejecutes SQL nuevo para E25.** No se modificaron migraciones ni tablas. La base actual exige columnas numéricas `NOT NULL` para los totales de receta, por lo que un nutriente incompleto se almacena como cero técnico en esos campos; su significado se recupera desde `ingredients` y se muestra correctamente en las vistas de recetas y del plan semanal. No consumas directamente esos campos escalares como valores exactos cuando `unknownMetrics` indique datos faltantes.

## Comprobaciones automatizadas

- Node: `node --test tests/*.test.cjs` — 172/172 pruebas aprobadas.
- Sintaxis: `node --check` sobre los 76 archivos JavaScript — aprobado.
- Navegador E25: 5/5 — nutrientes desconocidos, deshacer ingrediente, cancelar cierre y confirmar descarte.
- Regresión E23: 7/7; E24: 8/8; E20: 7/7; E19: 8/8; E18: 8/8; E17: 8/8; E16: 8/8; E12: 28/28; E10: 14/14; E7: comportamiento de alta rápida; E6: 7 tamaños de pantalla.
- Recursos: 181 referencias locales del HTML, 0 faltantes.
- Alcance de entrenamiento: 29 archivos JS/CSS relacionados revisados contra E24, ninguno modificado.

## Verificación manual recomendada

- Abrir una receta con un ingrediente que indique `nutrition_missing_fields: ['proteínas']`: las proteínas deben decir “Datos incompletos”; energía, carbohidratos y grasas conocidas deben seguir visibles.
- Abrir una receta con valores cero explícitos y estado `user_verified`: esos ceros deben mantenerse como ceros válidos.
- Quitar un ingrediente y pulsar “Deshacer” dentro de ocho segundos.
- Modificar el nombre o las cantidades, pulsar cerrar y cancelar el descarte: el editor debe continuar abierto con los cambios intactos.
- Confirmar el descarte: el modal debe cerrarse.
- Planificar una receta para otra cantidad de porciones: los nutrientes conocidos deben escalar; los desconocidos deben quedar en blanco en los datos del plan y generar una advertencia.
- Verificar guardado y reapertura de una receta con la instancia real de Supabase.

Las pruebas de esta entrega usan datos controlados. No certifican la instancia real de Supabase ni reemplazan la comprobación en un dispositivo físico.

## Reversión

Restaurá los cinco archivos de ejecución indicados arriba desde tu copia de E24. E25 no cambia la base de datos, por lo que no hay migración que revertir.
