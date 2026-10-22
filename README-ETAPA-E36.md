# Etapa E36 — Selección de comidas específicas desde plantillas

E36 permite abrir una plantilla semanal guardada, seleccionar una o varias comidas y previsualizar solo la selección antes de aplicarla a otra semana. Esto evita tener que aplicar toda la plantilla cuando solo se necesitan determinados platos.

## Qué cambia

- Panel accesible por plantilla con casillas de selección, seleccionar todo, limpiar y contador de comidas seleccionadas.
- Vista previa limitada exactamente a las comidas marcadas. Si se abre una selección parcial, se preservan las comidas del destino y las comidas no seleccionadas de la plantilla no se copian.
- La vista previa se invalida al cambiar una casilla; no se puede confirmar accidentalmente un borrador viejo.
- La operación comprueba nuevamente la plantilla y la firma del plan de destino antes de guardar; si hay cambios concurrentes, cancela y solicita una nueva vista previa.
- Usa las claves estables de E32 para reconocer las comidas ya aplicadas y prevenir duplicados en reintentos.
- Conserva los ingredientes, snapshots nutricionales y metadatos de calidad/procedencia. No modifica la plantilla guardada.
- CSS aislado con soporte para temas claro/oscuro, teclado, foco visible, contraste forzado y movimiento reducido.

## Instalación

Sobre E35, respaldá el repositorio y reemplazá `index.html` y `js/63-nutrition-week-plan-editor.js`. Agregá `css/117-nutrition-week-template-selection-e36.css` respetando la ruta. No requiere SQL nuevo.

## Límites de validación

Las pruebas automatizadas usan datos controlados y un proveedor de Supabase simulado. Antes de producción, probar con la instancia real que el aislamiento por cuenta y la persistencia funcionen. La auditoría E18 anterior no se pudo completar en la tanda de esta entrega porque Chromium quedó bloqueado al arrancar; no se considera aprobada por ese intento.
