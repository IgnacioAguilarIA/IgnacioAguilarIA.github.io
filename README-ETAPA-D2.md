# Agenda FICH — Etapa D2: privilegios mínimos en Supabase

## Qué reveló la auditoría real

El CSV exportado el 2026-10-12 muestra RLS habilitado en las siete tablas de Alimentación y policies propias para las operaciones esperadas. También muestra que `authenticated` conserva permisos de tabla más amplios en las seis tablas personales: `TRUNCATE`, `TRIGGER`, `REFERENCES` y `MAINTAIN`, además de CRUD. RLS no protege contra `TRUNCATE`, por lo que no conviene mantener ese permiso innecesario.

## Corrección

Ejecutar `sql/14-nutrition-minimum-privileges.sql` en Supabase SQL Editor. La migración:

- verifica que estén las siete tablas, RLS y las policies de lectura/CRUD que espera la app;
- revoca privilegios de tabla a `PUBLIC`, `anon` y `authenticated` en esas tablas;
- concede solo `SELECT` en `food_catalog` para `authenticated`;
- concede solo `SELECT`, `INSERT`, `UPDATE`, `DELETE` en las seis tablas personales;
- conserva sin cambios las policies RLS, las filas y los grants directos de `service_role`;
- verifica los privilegios efectivos después del cambio. Si alguna comprobación falla, la transacción se aborta y revierte.

El SQL no modifica datos ni elimina tablas, políticas o índices. No corrige datos históricos porque el CSV de auditoría es un reporte de esquema/permisos, no un informe de anomalías de filas.

## Verificación posterior

1. Ejecutar el SQL de D2 una sola vez en SQL Editor.
2. Esperar `Success. No rows returned`.
3. Volver a ejecutar `sql/13-nutrition-sync-audit-readonly.sql` y exportar el resultado. En `table_grant`, `authenticated` debe tener solo CRUD en tablas personales, `SELECT` en `food_catalog`, y no deben aparecer grants `anon`.
4. Probar con cuentas de prueba: guardar y desmarcar un consumo, recargar y confirmar estado e historial; repetir sin conexión y al reconectar. Verificar que el historial no se duplique.

## Límites de la verificación

Las pruebas automatizadas de la app usan Supabase simulado. No sustituyen la ejecución del SQL en el proyecto real ni la prueba manual con dos cuentas y dispositivos. Nunca compartir una clave `service_role` ni tokens de sesión.
