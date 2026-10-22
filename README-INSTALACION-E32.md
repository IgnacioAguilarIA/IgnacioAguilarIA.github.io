# Instalación de AgendaFICH E32

## Antes de empezar

- Trabajá en una rama de prueba de GitHub.
- Guardá una copia de la versión E31.
- Confirmá que `sql/06-nutrition-account-sync.sql` se ejecutó previamente y que `nutrition_preferences` conserva el aislamiento por cuenta.

## 1. Ejecutar la migración

En el SQL Editor de Supabase, ejecutá una sola vez:

`sql/29-nutrition-weekly-plan-templates.sql`

Luego ejecutá `sql/30-nutrition-weekly-plan-templates-postcheck.sql`. El segundo archivo es de solo lectura. Confirmá que la columna existe, que la restricción de cantidad/tamaño está activa, que RLS sigue habilitado y que las políticas de `nutrition_preferences` mantienen `auth.uid() = user_id`.

No publiques E32 como funcionalidad activa si el postcheck falla. No hace falta ejecutar la migración otra vez cuando ya está aplicada.

## 2. Copiar los archivos del parche

Extraé `AgendaFICH_Alimentacion_E32_patch.zip` y copiá estos archivos al repositorio, manteniendo sus rutas:

| Archivo del paquete | Acción |
|---|---|
| `index.html` | Reemplazar el de la raíz |
| `js/63-nutrition-week-plan-editor.js` | Reemplazar el existente |
| `css/113-nutrition-week-templates-e32.css` | Agregar en `css/` |
| `sql/29-nutrition-weekly-plan-templates.sql` | Guardar en `sql/` y ejecutar una vez en Supabase |
| `sql/30-nutrition-weekly-plan-templates-postcheck.sql` | Guardar en `sql/`; ejecutar para verificar |
| `sql/README.md` | Reemplazar el índice de migraciones si querés conservar la documentación actualizada |

El paquete también incluye pruebas automatizadas y auditoría de navegador; no son necesarias para ejecutar la interfaz, pero conviene conservarlas en el repositorio.

## 3. Prueba mínima de aceptación

1. Abrí el editor semanal con una cuenta autenticada y guardá una semana no vacía con un nombre nuevo.
2. Intentá guardar el mismo nombre de nuevo; debe impedir el duplicado.
3. Seleccioná una semana completamente vacía y previsualizá la plantilla. La vista previa no debe escribir nada.
4. Confirmá la aplicación y verificá comidas, ingredientes, cantidades, horarios y metadatos conservados.
5. Aplicá de nuevo la misma plantilla: no debe duplicar sus filas.
6. Usá un destino con una comida manual en uno de los días; ese día debe omitirse y la comida existente debe permanecer.
7. Cambiá el destino desde otra sesión entre la vista previa y la confirmación; la aplicación debe rechazar la vista previa antigua.
8. Iniciá sesión con otra cuenta y verificá que no vea, edite ni elimine las plantillas de la primera.

La lista completa está en `tests/MANUAL-E32-WEEK-TEMPLATES-CHECKLIST.md`.

## Reversión

Para volver al comportamiento de E31, revertí `index.html`, `js/63-nutrition-week-plan-editor.js` y quitá el enlace al CSS E32 (o eliminá el archivo CSS E32 si ningún HTML lo carga). La columna SQL es aditiva y no afecta los registros previos; dejala en la base mientras no haya un motivo revisado para borrarla. **No ejecutes un `DROP COLUMN` como parte de una reversión rutinaria**, porque eliminaría las plantillas guardadas.
