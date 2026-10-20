# Agenda FICH — Etapa E6: auditoría visual, uso táctil y accesibilidad móvil

## Objetivo

Refinar la presentación y la interacción de **Alimentación** en móviles y tabletas sin cambiar reglas globales ni lógica de Entrenamiento, Agenda o Calendario. Esta etapa no agrega funciones de nutrición ni altera datos; trabaja sobre la capa de presentación y pruebas.

## Cambios implementados

- Los nombres de calorías, proteínas, carbohidratos y grasas pueden envolverse correctamente en tarjetas estrechas; los valores largos no invaden la tarjeta contigua.
- El selector de días pasa a cuadrícula responsiva, con cuatro columnas en móviles habituales y tres en los anchos más estrechos.
- Las pestañas de comidas y las acciones principales se adaptan a columnas flexibles, sin forzar un ancho mínimo que provoque desplazamiento horizontal.
- Los objetivos táctiles de los controles importantes de Alimentación llegan a un mínimo de 44 px en teléfonos y dispositivos táctiles tipo tableta; los controles no pierden su separación ni sus rótulos.
- Los campos de texto de los formularios nutricionales usan 16 px en dispositivos táctiles pequeños para reducir el zoom automático de Safari al enfocarlos.
- Los diálogos de comida y objetivos respetan los márgenes seguros, la altura dinámica del viewport y el desplazamiento interno. La cabecera de cierre y la acción de guardar permanecen disponibles al recorrer formularios largos.
- En teléfonos apaisados y tabletas táctiles, el editor de comida mantiene el cierre y el guardado visibles mientras su contenido se desplaza.
- Se conserva un indicador de foco visible, movimiento reducido y presentación en colores forzados/alto contraste.
- Las reglas CSS están limitadas a `#nutritionPanel` y a los diálogos de Alimentación; no se añadieron reglas globales de `body`, `html`, navegación, Agenda, Calendario ni Entrenamiento.

## Archivos necesarios para instalar

Esta etapa requiere **solo dos archivos de runtime**:

1. `index.html` — incluye el enlace a la hoja E6 después de los estilos previos de Alimentación.
2. `css/90-nutrition-mobile-e6.css` — contiene los ajustes responsive y de accesibilidad.

No requiere JavaScript nuevo, migraciones SQL ni cambios en Supabase. En GitHub hay que conservar la ruta `css/90-nutrition-mobile-e6.css` exactamente.

## Comprobaciones automatizadas

- La suite `tests/nutrition-mobile-accessibility-e6.test.cjs` pasa 20 aserciones de estructura y CSS.
- La auditoría visual en Chromium comprobó 7 viewports: `320×740`, `360×800`, `390×844`, `430×932`, `768×1024` (entrada táctil), `844×390` (apaisado táctil) y `1366×768` (escritorio).
- Se agregó además una medición de altura reducida `320×400` como aproximación al área visible cuando aparece un teclado móvil. No es un teclado real.
- En los viewports táctiles evaluados no se detectó desbordamiento horizontal, etiquetas nutricionales desbordadas ni controles visibles menores de 44 px. Los diálogos permanecen dentro del ancho y su contenido se desplaza internamente; la acción de guardar queda visible en las vistas táctiles comprobadas.
- El informe JSON está en `tests/artifacts/e6/viewport-audit.json`; las capturas de vista previa están en `tests/artifacts/e6/screenshots/`.
- La batería de pruebas Node del proyecto debe ejecutarse para verificar las regresiones de las etapas anteriores.

### Reproducir la auditoría visual (opcional)

Requiere Python, Playwright para Python y Chromium:

```bash
python -m pip install playwright
python -m playwright install chromium
python tests/e6_mobile_viewport_audit.py --screenshots
```

El script elimina los scripts de la app y crea un fixture estático a partir del HTML/CSS para evitar llamadas de autenticación o Supabase. **Evalúa layout y tamaños, no la ejecución completa de la app ni los datos reales de una cuenta.**

## Límites de la verificación

La simulación de Chromium no equivale a probar físicamente Safari/iOS, Chrome/Android, un teclado real, VoiceOver/TalkBack o la conexión a Supabase. Antes de dar por cerrada la etapa, completá `tests/MANUAL-E6-MOBILE-ACCESSIBILITY-CHECKLIST.md` en al menos un teléfono y una tableta si forman parte de los dispositivos de uso.

## Checklist manual

Ver `tests/MANUAL-E6-MOBILE-ACCESSIBILITY-CHECKLIST.md`. Es importante abrir los diálogos reales de recetas, despensa, planificación, compras, escáner e informes, ya que la auditoría automática mide principalmente la sección principal y el formulario de comida.
