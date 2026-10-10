# Agenda FICH V98 — Alimentación: etapas 1–5

Esta versión incluye los cambios de las etapas 1 a 5 y el ajuste visual posterior del menú «Agregar alimentos». Agrega alimentos personalizados, recetas basadas en ingredientes reales, historial de consumo por fecha y un formulario organizado en pasos. Los módulos específicos de Entrenamiento no se modifican. La guía de esta última mejora está en `README-MENU-AGREGAR-ALIMENTOS.md`.

## Cambios de la Etapa 4

- **Crear alimentos propios:** formulario para registrar nombre, marca opcional y calorías/proteínas/carbohidratos/grasas/fibra por 100 g. Se guardan en `user_foods`, aislados por usuario, y pueden buscarse y reutilizarse desde el catálogo.
- **Recetas:** se puede guardar la composición de los alimentos de una comida como receta. El sistema suma nutrientes según cantidades y calcula los valores por 100 g del peso completo. Después permite agregar una cantidad de porciones a una comida; la aplicación escala los ingredientes individuales y vuelve a calcular los macros.
- **Historial con fecha real:** al marcar un alimento como consumido, se registra una instantánea por cuenta y fecha local de Argentina/Córdoba. Si se desmarca el mismo día, se elimina el registro de ese día; registros de fechas anteriores se conservan. El historial muestra el período de 7, 30 o 90 días.
- **Estado diario de consumo:** un alimento de la plantilla semanal deja de figurar como consumido en el resumen al pasar a otro día. Al volver a marcarlo se registra un nuevo consumo con la fecha actual. Los registros antiguos con `consumed_at` sirven para poblar el historial de forma idempotente cuando vuelven a cargarse.
- **Copia de seguridad completa:** la exportación agrega recetas e historial. La importación de datos contempla estas tablas y mantiene compatibles los backups anteriores que no tenían esos campos.
- **Reutilización de comidas:** se conserva el botón existente para duplicar una comida a otro día/tipo/horario. Las recetas son una capa adicional, no sustituyen esa función.

## Migraciones de Supabase

**Acción requerida:** abrir el SQL Editor de Supabase y ejecutar `sql/07-nutrition-advanced.sql` después de las migraciones previas de Alimentación, en particular `01-nutrition-food-catalog.sql` y `06-nutrition-account-sync.sql`. La migración 07 crea `nutrition_recipes` y `nutrition_consumption_history`, índices y políticas RLS de acceso propio. Es idempotente para volver a ejecutarla.

La creación de alimentos personalizados usa la tabla existente `user_foods`; no requiere una tabla nueva. Si no se ejecuta la migración 07, las funciones básicas de catálogo pueden seguir funcionando, pero las recetas y el historial mostrarán un aviso que indica la migración faltante.

## Compatibilidad y límites

- Los alimentos de una receta son instantáneas: se conserva el nombre, cantidad y macros de cada ingrediente al guardar la receta. Editar un alimento del catálogo después no cambia silenciosamente una receta guardada.
- Al agregar una receta, se insertan sus ingredientes como alimentos individuales de la comida; cada elemento comienza sin marcarse como consumido.
- El historial registra las cantidades y macros calculados en el momento del consumo. No modifica ni borra los ingredientes planificados en el plan semanal.
- El historial utiliza la fecha local de `America/Argentina/Cordoba`, no la fecha UTC, para evitar que consumos cerca de medianoche se asignen al día equivocado.
- Los backups antiguos siguen importándose. Para importar recetas/historial de un backup nuevo deben existir las tablas 07 en el proyecto de destino.
- El proceso de importación de toda la aplicación no es una transacción única de base de datos. Se recomienda exportar una copia antes de reemplazar datos.
- Las verificaciones locales no sustituyen una prueba final en el navegador conectada a la cuenta real de Supabase.

## Archivos principales

- `index.html`: botones de creación de alimentos, recetas e historial; carga los módulos nuevos.
- `js/49-nutrition-persistence.js`: operaciones de recetas e historial, guardado/lectura de la base nutricional.
- `js/54-nutrition-consumption.js`: estado diario de los alimentos y recuperación idempotente del historial.
- `js/58-nutrition-advanced.js`: formularios de alimento personalizado, recetas y visor del historial.
- `css/76-nutrition-advanced.css`: estilos encapsulados de las nuevas ventanas.
- `js/03-inline-script-03.js` y `js/04-inline-script-04.js`: importación y exportación compatibles con las tablas nuevas.
- `sql/07-nutrition-advanced.sql`: migración de tablas e índices con RLS.

## Etapas incluidas

- **Etapa 1:** resumen planificado/consumido y cálculos por cantidad.
- **Etapa 2:** recientes, favoritos, edición de cantidades y duplicación de alimentos.
- **Etapa 3:** estado de sincronización, persistencia más conservadora, aislamiento por cuenta y copia de seguridad.
- **Etapa 4:** alimentos personalizados, recetas, reutilización e historial por fecha.
- **Etapa 5:** acabado visual, accesibilidad, rendimiento y pruebas de regresión.
- **Ajuste del menú de alta de alimentos:** formulario por pasos, catálogo y accesos rápidos reorganizados, detalle del producto plegable y controles adaptados a móvil.
