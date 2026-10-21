# Agenda FICH — proyecto web

## Última mejora incluida: E18 — Personalizar la vista de Alimentación

E18 permite elegir cómo se muestran los detalles nutricionales al abrir Alimentación: **Adaptable**, **Compacta** o **Completa**. También puede recordar la última herramienta utilizada y mostrar un acceso directo opcional dentro de «Más herramientas».

Las preferencias se guardan en este navegador con una clave independiente por cuenta. No alteran comidas, cantidades, nutrientes ni operaciones de guardado; tampoco se envían a Supabase ni se sincronizan a otros dispositivos.

- Guía de instalación: `README-ETAPA-E18.md`
- Código nuevo: `js/73-nutrition-view-preferences-e18.js`
- CSS nuevo: `css/100-nutrition-view-preferences-e18.css`
- Pruebas E18: `tests/nutrition-view-preferences-e18.test.cjs`
- Auditoría de navegador: `tests/e18_view_preferences_browser_audit.py`
- Checklist manual: `tests/MANUAL-VIEW-PREFERENCES-E18-CHECKLIST.md`

Para actualizar desde E17, reemplazá `index.html` y agregá los dos archivos nuevos respetando las rutas. No requiere SQL. Las pruebas locales no sustituyen las pruebas de producción contra Supabase ni una revisión en teléfonos físicos.

Para conocer los antecedentes y las instrucciones de cada etapa, consultá los respectivos `README-ETAPA-*.md`.
