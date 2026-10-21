# Etapa E11 — Rediseño visual premium de Alimentación

## Objetivo

Elevar la presentación real de Alimentación para que tenga una jerarquía visual más clara, superficies y controles coherentes, mejores contrastes y un uso más cuidado en escritorio, tableta y teléfono. La etapa es visual: no cambia la lógica nutricional, el guardado, las tablas ni las operaciones de Supabase.

## Cambios

- Encabezado con etiqueta editorial, título más claro y jerarquía entre acciones secundarias y acción principal.
- Estado de sincronización compacto con estados distinguibles para guardado, pendiente, advertencia y error.
- Resumen diario con contraste mejorado, barras de progreso legibles y separación clara entre planificación y consumo real.
- Tarjetas nutricionales y objetivos con cifras alineadas, bordes y espaciado coherentes.
- Selector semanal y pestañas de comidas con estados activos más visibles.
- Tarjetas de comidas con lectura más fácil, acciones consistentes y sin una barra de desplazamiento interna innecesaria.
- Formularios y paneles secundarios alineados con el mismo lenguaje visual.
- Navegación compartida ajustada solo mientras Alimentación está activa; su comportamiento en otras secciones permanece fuera del alcance de E11.
- Reglas responsive, foco visible, movimiento reducido y alto contraste conservados.

## Instalación

Si la aplicación ya utiliza E10, hay que:

1. Reemplazar `index.html` por el incluido en el paquete de actualización.
2. Añadir `css/93-nutrition-premium-dashboard-e11.css` a la carpeta `css/` respetando exactamente la ruta.
3. Publicar y recargar sin caché para comprobar la hoja nueva.

No se requiere migración SQL ni reemplazo de JavaScript.

## Pruebas

- Pruebas Node de regresión de las etapas anteriores.
- Pruebas estáticas de E11 (`tests/nutrition-premium-dashboard-e11.test.cjs`).
- Auditoría Chromium E10 en temas oscuro y claro, incluyendo siete tamaños de viewport.
- Auditoría de accesibilidad visual E6 y de registro rápido E7.

Las auditorías Chromium usan un fixture HTML estático; no equivalen a una prueba física en iOS/Android ni a verificación de Supabase en producción.
