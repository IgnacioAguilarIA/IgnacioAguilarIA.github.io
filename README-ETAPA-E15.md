# Agenda FICH — Etapa E15
## Centro de herramientas por tarea y tarjetas de comidas progresivas

### Objetivo
Reducir la carga visual de Alimentación, especialmente en celulares, sin quitar herramientas ni cambiar las reglas de negocio. La vista principal sigue priorizando **Agregar comida**; las acciones secundarias se agrupan por la tarea que ayudan a realizar.

### Qué incorpora

- Agrupa herramientas secundarias en **Planificar**, **Preparar**, **Organizar** y **Consultar**.
- Conserva todos los botones existentes y sus manejadores; la agrupación se aplica a los elementos reales y no simula acciones de base de datos.
- Añade un acceso directo a **Mis recetas** que llama a la API existente `AgendaNutritionAdvanced.openRecipes()`.
- Reagrupa herramientas que otros módulos agreguen dinámicamente y mantiene actualizado el contador del apartado.
- Las tarjetas de comidas conservan siempre el título y las acciones principales. En la vista compacta muestran un resumen corto y las calorías cuando están disponibles; los alimentos completos, las notas y los nutrientes quedan en un desplegable en móvil.
- En escritorio el detalle se abre inicialmente para aprovechar el espacio; en móvil comienza cerrado. Si la persona elige abrir/cerrar el detalle, el cambio de ancho no pisa esa preferencia de la tarjeta.
- Mantiene los IDs originales y el punto de inserción de `nutrition-consumption-panel`, usado por el registro de consumo.
- Añade etiquetas accesibles a acciones de comida que antes dependían solo de iconos.
- Mantiene el alcance visual limitado a `#nutritionPanel`, respeta los temas claro/oscuro, foco de teclado, movimiento reducido y alto contraste.

### Archivos modificados/nuevos

- `index.html`: carga el nuevo CSS y el nuevo módulo al final de los módulos existentes.
- `js/70-nutrition-task-hub-e15.js`: agrupa herramientas y presenta progresivamente las tarjetas.
- `css/97-nutrition-task-hub-e15.css`: estilos adaptables y accesibles propios de Alimentación.

### Instalación desde E14

1. Conservá una copia de la versión actual del repositorio.
2. Reemplazá `index.html` con el archivo de E15.
3. Agregá `js/70-nutrition-task-hub-e15.js` y `css/97-nutrition-task-hub-e15.css` en esas rutas exactas.
4. No ejecutes SQL: esta etapa no cambia el esquema ni los datos.
5. Publicá y probá con una cuenta de prueba: abrir «Más herramientas», abrir «Mis recetas», expandir una tarjeta y comprobar Editar/Eliminar y el panel de consumo.

### Pruebas ejecutadas

- 112 pruebas Node registradas, ejecutadas en cuatro grupos para evitar el límite de tiempo del entorno; todas pasaron.
- Auditoría Chromium con datos simulados en 320×740, 390×844, 768×1024 y 1366×768.
- Verificación de agrupación inicial, botón de recetas, acciones originales, despliegue de detalles y ausencia de desbordamiento horizontal.
- Comprobación adicional de herramienta añadida dinámicamente: se agrupa en «Otras herramientas» y actualiza el total.
- Los controles táctiles simulados de la barra de herramientas y de las tarjetas miden al menos 44 px.
- Las pruebas usan datos simulados y no llaman a Supabase. No sustituyen una prueba física en iOS/Android ni una comprobación de sesión real.

Informe: `tests/artifacts/e15/task-hub-browser-audit.json`
Capturas: `tests/artifacts/e15/screenshots/`
Pruebas de módulo: `tests/nutrition-task-hub-e15.test.cjs`
Auditoría de navegador: `tests/e15_task_hub_browser_audit.py`
Lista de pruebas manuales: `tests/MANUAL-TASK-HUB-E15-CHECKLIST.md`
