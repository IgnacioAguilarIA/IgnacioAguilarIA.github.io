# Etapa E16 — Tarjetas de comidas más claras

## Objetivo
Refinar las tarjetas de comidas partiendo de E15, con un resumen breve y escaneable, sin perder datos existentes ni modificar la persistencia.

## Cambios
- Ordena la información visible en una fila breve con las calorías planificadas (si existen), proteína (si está disponible) y horario (si está definido).
- Las cifras se leen de los metadatos ya renderizados; no se estiman ni se inventan valores nutricionales.
- Conserva todos los chips nutricionales y la información original dentro del desplegable.
- En móvil, la acción de expansión muestra «Ver detalles»; al abrir, cambia a «Ocultar detalles». En escritorio, el texto inicial explica qué contiene el desplegable y cambia a «Ocultar detalles» al abrirse.
- Agrega `aria-expanded`, `aria-controls` hacia el cuerpo del detalle, nombres accesibles para acciones con iconos y una actualización de etiquetas al cambiar el tamaño de pantalla.
- Conserva el encabezado directo `.meal-card-head` requerido por el módulo de consumo.
- Reglas CSS limitadas a Alimentación; respeta tema claro/oscuro, foco de teclado, objetivos táctiles, movimiento reducido y alto contraste.
- No realiza operaciones de red o base de datos ni necesita migración SQL.

## Instalación desde E15
1. Reemplazar `index.html`.
2. Agregar `js/71-nutrition-meal-cards-e16.js`.
3. Agregar `css/98-nutrition-meal-cards-e16.css`.
4. Mantener las rutas originales.

## Pruebas
- `node --test tests/nutrition-meal-cards-e16.test.cjs`
- `python tests/e16_meal_cards_browser_audit.py --viewport all --theme all`
- Suite completa del proyecto ejecutada en grupos para respetar el límite de ejecución del entorno.

Las pruebas de navegador usan datos ficticios y no demuestran funcionamiento en un dispositivo físico o contra Supabase en producción.
