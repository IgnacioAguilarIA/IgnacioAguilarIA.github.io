# Migración 05 — consumo de alimentos

Ejecutá `05-nutrition-meal-item-consumption.sql` en Supabase después de las migraciones 01–04.

Agrega a `nutrition_meal_items`:
- `consumed`: indica si el usuario consumió ese alimento.
- `consumed_at`: fecha y hora en la que se marcó como consumido.

La interfaz tiene un fallback local para que marcar/desmarcar no rompa la aplicación mientras esta migración todavía no fue ejecutada. Para sincronizar el estado entre dispositivos, la migración sí es necesaria.
