# AgendaFICH E31 — Copiar un día completo con vista previa y control de cambios

## Objetivo

E31 facilita reutilizar un día completo del plan semanal sin tener que duplicar las comidas una por una. La nueva acción `Copiar día completo` ofrece una vista previa antes de escribir datos, conserva todas las comidas que ya existen en el destino y crea copias independientes de los registros elegidos.

## Qué incorpora

- **Selección de origen y destino:** permite elegir un día con comidas y otro día diferente de la misma semana.
- **Vista previa no destructiva:** enumera las comidas que se copiarán, cuenta ingredientes y avisa si encuentra cantidades o nutrientes incompletos. Nada se guarda hasta pulsar el botón de confirmación.
- **Destino aditivo:** las comidas que ya existían en el día destino no se reemplazan ni se eliminan. Las nuevas se agregan al final de la ordenación del día.
- **Copias independientes:** cada copia tiene `plan_key` propio y `source_meal_id = null`; se conservan los ingredientes, las instantáneas nutricionales, los metadatos de procedencia/calidad y los campos desconocidos.
- **Protección ante cambios concurrentes:** antes de escribir, relee la semana de Supabase y compara las firmas del origen y el destino con la vista previa. Si cualquiera cambió, cancela sin escribir y pide generar otra vista previa.
- **Reintento seguro:** las claves de operación son estables dentro de la vista previa. Si el servidor guardó la operación pero se perdió la respuesta, al reintentar el editor reconoce las claves ya confirmadas y evita crear una segunda copia.
- **Accesibilidad y móvil:** etiquetas explícitas, estado expandido del botón, foco que vuelve al control al cerrar y disposición responsive sin desbordamiento horizontal.

## Archivos de ejecución

| Ruta | Acción |
|---|---|
| `index.html` | Reemplazar; carga el CSS E31 y actualiza la versión de caché del editor |
| `js/63-nutrition-week-plan-editor.js` | Reemplazar |
| `css/112-nutrition-week-plan-copy-day-e31.css` | Agregar dentro de `css/` |

No renombrar archivos ni aplanar las carpetas.

## Datos y Supabase

No requiere migraciones SQL nuevas ni cambia las tablas o políticas. Usa `nutrition_weekly_plan_items` ya existente. La operación es aditiva, con claves idempotentes por comida de origen y operación. E31 nunca modifica las comidas fuente y no reemplaza filas en el destino.

Antes de publicar, debe comprobarse en Supabase real que las políticas de RLS sigan restringiendo la lectura y escritura a la cuenta autenticada. Las pruebas incluidas utilizan un proveedor Supabase simulado y no certifican producción.

## Validación ejecutada

- `node --test tests/*.test.cjs`: **178/178 pruebas automatizadas pasaron**.
- Pruebas puras E31: **12/12**.
- Auditoría de navegador E31: **18/18**, incluidos copia confirmada, destino existente preservado, cancelación sin escritura, respuesta de red ambigua, reintento idempotente, rechazo de vista previa obsoleta y viewport móvil/escritorio.
- Regresiones de navegador: E30 **29/29**, E29 **20/20**, E28 **12/12**, E27 **15/15**, E26 **9/9**, E25 **5/5**, E24 **8/8**, E23 **7/7**, E20 **7/7**, E19 **8/8**, E18 **8/8**, E17 **8/8**, E16 **8/8**, además de las auditorías E15, E14, E13, E12, E7 y E6.
- Sintaxis de JavaScript y referencias locales del HTML verificadas antes de preparar el paquete.
- No se modificaron tablas/migraciones SQL ni los archivos de ejecución de Entrenamiento.

## Prueba manual recomendada

Seguí `tests/MANUAL-E31-COPY-DAY-CHECKLIST.md` en una rama de prueba y con la instancia real de Supabase antes de publicarlo para todos los usuarios.
