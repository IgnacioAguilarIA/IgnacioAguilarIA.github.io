# AgendaFICH E29 — Acciones rápidas para el plan semanal

## Objetivo

E29 mejora la edición del plan semanal de Alimentación sin alterar la rutina habitual ni cambiar el esquema de Supabase. Permite mover o duplicar comidas desde la tarjeta de cada comida, muestra los datos nutricionales guardados y protege las escrituras ante cambios concurrentes.

## Cambios incluidos

- **Mover comida a otro día:** abre un selector accesible dentro de la tarjeta. La operación comprueba cuenta, semana e `updated_at`, y cambia el día con una escritura condicional.
- **Duplicar en otro día:** crea una comida independiente con clave de plan nueva. Conserva la instantánea de ingredientes y nutrientes, sus metadatos de procedencia y las banderas de datos incompletos. No comparte la clave de la rutina original.
- **Duplicar desde el editor:** abre un formulario precompletado para ajustar día, horario o notas antes de guardar la copia. La comida original queda intacta.
- **Resumen nutricional por comida:** muestra solo campos numéricos presentes y omite los nutrientes marcados explícitamente como desconocidos; un cero explícito y no marcado como desconocido se conserva.
- **Conflictos de edición:** las modificaciones usan `updated_at` como control de concurrencia. Si una comida cambió en el servidor, no se sobrescribe; se conservan los valores escritos en el formulario para que la persona revise y decida si desea volver a guardar.
- **Selectores opcionales corregidos:** los selectores de plantilla y receta, rotulados como opcionales, ya no bloquean el guardado manual.
- **Diseño responsive:** acciones, resumen y selector de día son utilizables en pantallas móviles y escritorio, con foco visible, movimiento reducido y contraste forzado.

## Archivos de ejecución

| Archivo | Acción |
|---|---|
| `index.html` | Reemplazar; carga el CSS E29 y fuerza una nueva versión de caché del editor |
| `js/63-nutrition-week-plan-editor.js` | Reemplazar |
| `css/110-nutrition-week-plan-quick-actions-e29.css` | Agregar |

Todas las rutas son relativas a la raíz del repositorio. No cambiar los nombres.

## Base de datos

E29 **no requiere SQL nuevo**: no modifica tablas, columnas, índices ni políticas RLS. Utiliza `updated_at` existente en `nutrition_weekly_plan_items` para rechazar escrituras basadas en una versión obsoleta. No se validó la conexión de producción desde este paquete; la prueba final contra el proyecto real de Supabase debe hacerse tras instalar.

## Pruebas ejecutadas

- Suite Node del proyecto: **176/176 aprobadas**.
- Pruebas puras E29: **13/13 aprobadas**.
- Auditoría de navegador E29: **20/20 aprobadas**.
- Regresión de lista de compras E26: **9/9 aprobadas**.
- Regresión de revisión de compras E27: **15/15 aprobadas**.
- Regresión de recuperación/edición de compras E28: **12/12 aprobadas**.
- 76 archivos JavaScript: sintaxis comprobada.
- 185 referencias locales de `index.html`: todas existen.
- No se modificaron archivos de ejecución de Entrenamiento. Los archivos de código modificados son el HTML principal y el editor semanal de Alimentación; se agregó un CSS nuevo.

Las pruebas usan datos controlados y una implementación simulada de Supabase. No sustituyen la prueba en producción con dos sesiones reales.

## Comprobación manual recomendada

Seguí `tests/MANUAL-E29-WEEK-PLAN-QUICK-ACTIONS-CHECKLIST.md` después de instalar la actualización en una rama de prueba.
