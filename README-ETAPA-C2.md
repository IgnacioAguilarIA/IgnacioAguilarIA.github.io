# Agenda FICH — Etapa C2: auditoría final de Alimentación

Esta etapa parte de la C1 aceptada y se limita a estados, mensajes, sincronización y pruebas de regresión de Alimentación.

## Cambios
- Normaliza roles `status`, `aria-live="polite"` y `aria-atomic` para estados estáticos y generados dinámicamente en Alimentación.
- Clasifica mensajes de estado para dar señales visuales coherentes de error, pendiente o éxito sin sustituir el texto original.
- Añade una acción de **Reintentar sincronización** cuando la aplicación detecta un estado de error/advertencia, hay una cuenta activa y el dispositivo está en línea.
- El reintento lanza los mecanismos existentes de sincronización de preferencias y cola de consumo. No marca nada como guardado por sí mismo; solo los módulos propietarios pueden confirmar ese estado.
- El reintento está asociado al usuario activo, deshabilitado mientras trabaja y oculto si no hay conexión o si la sincronización ya se informó como guardada.
- Los módulos existentes de búsqueda ya descartan respuestas obsoletas; se agregaron pruebas de regresión para esa garantía.
- Se mantiene la navegación por teclado, el foco visible y los objetivos táctiles de la C1.

## Archivos modificados
- `index.html` (solo referencias al nuevo CSS/JS de Alimentación).

## Archivos nuevos
- `js/61-nutrition-final-audit.js`
- `css/82-nutrition-final-audit.css`
- `tests/nutrition-stage-c2.test.cjs`

## Pruebas
Ejecutar desde la carpeta del proyecto:

```bash
node tests/nutrition-stage-c2.test.cjs
```

No requiere migración SQL adicional. Las pruebas locales no sustituyen una prueba de integración contra el proyecto Supabase real o una inspección visual manual en dispositivos reales.
