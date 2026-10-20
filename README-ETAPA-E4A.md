# Agenda FICH — Etapa E4A: recetas avanzadas y registro de preparaciones

## Alcance

Esta entrega se concentra en **Alimentación**. Amplía el sistema de recetas que ya existía; no cambia Entrenamiento, Agenda, Calendario, autenticación ni navegación general.

### Funciones incluidas

- **Instrucciones paso a paso:** cada receta puede conservar hasta 40 pasos; se recortan espacios y no se guardan líneas vacías. Cada paso admite hasta 1000 caracteres.
- **Tiempos:** tiempo estimado de preparación y de cocción, en minutos enteros de 0 a 1440.
- **Modo de cocina:** presenta un paso grande por pantalla/modal con progreso, navegación anterior/siguiente, compatibilidad con pantallas estrechas y solicitud de `Screen Wake Lock` cuando el navegador seguro lo permite. Al cerrar el modo, libera la solicitud de pantalla activa.
- **Variantes independientes:** “Crear variante” copia ingredientes, instrucciones y tiempos a una receta nueva relacionada con la original. La edición posterior no modifica la receta original. El servidor verifica que la relación padre-variante pertenezca a la misma cuenta.
- **Registrar preparación real:** fecha, porciones obtenidas, peso final medido opcional y notas de esa tanda.
- **Historial inmutable de preparaciones:** cada registro captura desde el servidor el nombre, los ingredientes, las instrucciones, tiempos y valores nutricionales de la receta tal como existían al registrar la tanda. Editar o eliminar la receta no reescribe esa instantánea histórica.
- **Idempotencia:** el registro usa una clave de operación única por cuenta; un reintento con la misma clave devuelve la preparación anterior en lugar de crear un duplicado.
- **Seguridad:** RLS para lectura del historial, escritura mediante RPC autenticada, verificación explícita del usuario dueño de la receta y permisos mínimos para el historial.
- **Sin efectos colaterales en inventario/consumo:** registrar una tanda no inventa consumos y no descuenta automáticamente la despensa.

## Archivos modificados o añadidos

- `js/49-nutrition-persistence.js`: guarda los metadatos de receta y expone operaciones de historial.
- `js/58-nutrition-advanced.js`: editor, variantes, modo paso a paso y registro/historial de preparaciones.
- `css/76-nutrition-advanced.css`: estilos locales y adaptables para las nuevas vistas.
- `sql/25-nutrition-recipes-advanced.sql`: migración aditiva de campos, vínculo de variantes, tabla de historial y RPC.
- `sql/26-nutrition-recipes-advanced-postcheck.sql`: comprobación SQL de solo lectura.
- `tests/nutrition-recipes-advanced-e4.test.cjs`: pruebas estáticas y dinámicas de la etapa.
- `tests/MANUAL-RECIPES-E4A-CHECKLIST.md`: validación manual en Supabase y navegador.

## Instalación

1. Hacé una exportación/copia de seguridad de Alimentación antes de modificar el esquema.
2. En Supabase SQL Editor, ejecutá **una sola vez** `sql/25-nutrition-recipes-advanced.sql`. Es una migración aditiva; no elimina filas ni reescribe las recetas que ya existen.
3. Ejecutá `sql/26-nutrition-recipes-advanced-postcheck.sql` y verificá que aparezcan las cuatro columnas nuevas, la tabla de historial con RLS habilitado, su política de lectura y el permiso `EXECUTE` de `nutrition_record_recipe_preparation` para `authenticated`.
4. Subí a GitHub los tres archivos de runtime modificados, respetando exactamente sus rutas. No se necesita editar `index.html`; estos módulos y estilos ya se cargaban.
5. Seguí la lista `tests/MANUAL-RECIPES-E4A-CHECKLIST.md` con una cuenta de prueba antes de usar datos importantes.

La migración no se ejecutó desde esta entrega porque no tengo una conexión autorizada a tu proyecto Supabase activo. No marques la etapa como probada en producción hasta completar el postcheck y la lista manual.

## Pruebas locales

```bash
node tests/nutrition-recipes-advanced-e4.test.cjs
for f in tests/*.test.cjs; do node "$f"; done
find js -name '*.js' -print0 | xargs -0 -n1 node --check
```

Las pruebas automáticas verifican las reglas de validación, el envío de los datos al RPC, el aislamiento por usuario en las consultas y la estructura de seguridad prevista. No reemplazan una prueba real con dos cuentas de Supabase ni una comprobación visual en todos los teléfonos.

## Reversión segura

Para volver a los archivos JavaScript/CSS anteriores, revertí esos archivos en GitHub. **No borres las columnas, la tabla de historial ni la función SQL después de haber registrado preparaciones**, ya que podrías eliminar el acceso a datos históricos. La migración está diseñada para permitir que el código anterior ignore los campos nuevos.
