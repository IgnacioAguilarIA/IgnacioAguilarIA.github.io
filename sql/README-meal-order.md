# Orden personalizado de comidas

Ejecutá `04-nutrition-meal-order.sql` en Supabase SQL Editor, después de las migraciones del catálogo.

La tabla `nutrition_preferences` guarda el orden elegido por cada usuario. La aplicación también mantiene un fallback local por usuario/navegador para no bloquear la sección de Alimentación si la tabla todavía no fue creada o no hay conexión.
