# Instalación del parche E30

1. Hacé una copia de seguridad del repositorio y de los datos de prueba.
2. Extraé este ZIP.
3. Copiá los archivos conservando sus rutas relativas en la raíz del repositorio. Los archivos de ejecución son:
   - `index.html` — reemplazar.
   - `js/63-nutrition-week-plan-editor.js` — reemplazar.
   - `css/111-nutrition-recipe-portion-adjustment-e30.css` — agregar.
4. Los dos archivos `.test.cjs` antiguos incluidos aquí solo actualizan sus verificaciones del número de caché del editor a E30. Los archivos de prueba nuevos están en `tests/`.
5. No ejecutar SQL: esta etapa no agrega ni modifica migraciones.
6. Publicá primero en una rama de prueba y seguí `tests/MANUAL-E30-RECIPE-PORTION-ADJUSTMENT-CHECKLIST.md` contra tu Supabase real.

Las auditorías de navegador se deben ejecutar después de copiar el parche al repositorio completo, porque reutilizan los demás módulos y hojas de estilo de E29.
