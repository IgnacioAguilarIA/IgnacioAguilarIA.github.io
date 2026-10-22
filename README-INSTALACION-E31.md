# Instalación de AgendaFICH E31 sobre E30

## Antes de publicar
1. Conservá una copia de seguridad de la versión E30 y trabajá primero en una rama de prueba de GitHub.
2. Extraé `AgendaFICH_Alimentacion_E31_patch.zip` sin aplanar sus carpetas.
3. Copiá los archivos respetando sus rutas en el repositorio.

## Archivos de ejecución
- `index.html` — reemplazar.
- `js/63-nutrition-week-plan-editor.js` — reemplazar.
- `css/112-nutrition-week-plan-copy-day-e31.css` — agregar en `css/`.

El parche incluye también la prueba nueva E31, el informe de navegador, la lista de comprobación manual y los tres tests históricos que verifican las referencias de caché del editor. Los tests/documentación son complementarios para la ejecución de la app.

## Cómo probarlo
1. Abrí Alimentación y entrá en la planificación semanal.
2. Elegí `Copiar día completo`; comprobá que no se escriba nada al abrir la vista previa o cancelarla.
3. Confirmá una copia y comprobá que las comidas del destino queden intactas y las nuevas aparezcan una sola vez.
4. Probá que una modificación del origen/destino desde otra sesión invalide la vista previa.
5. Seguí `tests/MANUAL-E31-COPY-DAY-CHECKLIST.md` antes de publicarlo para todos los usuarios.

## Base de datos
E31 no incluye migraciones SQL nuevas ni modifica tablas o políticas. Las pruebas automatizadas usan un proveedor Supabase simulado; verificar RLS, aislamiento entre cuentas y sincronización en producción requiere una prueba manual contra la instancia real.

## Entrenamiento
El cambio existente de JavaScript se limita a `js/63-nutrition-week-plan-editor.js` (planificación de Alimentación), y el CSS añadido es nuevo y exclusivo de esa mejora. No se modifican archivos SQL ni archivos existentes de Entrenamiento.
