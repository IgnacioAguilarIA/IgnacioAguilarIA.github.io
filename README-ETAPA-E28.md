# AgendaFICH — Etapa E28
## Recuperación de productos archivados y edición segura de compras manuales

**Base:** E27.  
**Alcance:** exclusivamente la lista de compras de Alimentación.  
**Cambios SQL:** ninguno.  
**Entrenamiento:** los archivos existentes de JavaScript y CSS de Entrenamiento se conservan sin cambios.

## Qué cambia

### 1. Recuperar productos archivados
- La lista de compras muestra un acceso a «Ver archivados» solo cuando la semana tiene productos generados archivados.
- La sección muestra nombre, categoría, cantidad conocida/desconocida y preparación.
- «Restaurar» devuelve un producto a la lista activa como pendiente de compra; no lo marca como comprado.
- La operación vuelve a leer el registro desde Supabase, valida cuenta, semana, estado de archivo y versión `updated_at`, y actualiza únicamente el registro de esa cuenta y semana.
- Los archivados siguen excluidos del resumen de progreso hasta que se restauran.

### 2. Editar productos agregados manualmente
- Los productos manuales activos y todavía pendientes incluyen una acción «Editar» en línea.
- Se pueden cambiar nombre, cantidad, unidad y categoría sin eliminar ni crear otro registro.
- Se mantienen `id`, `item_key`, cuenta, semana, origen manual y estado de compra.
- Los artículos comprados no muestran la acción de edición; primero hay que desmarcarlos conscientemente.
- Cancelar la edición no escribe cambios.
- Antes de guardar se compara la versión más reciente con `updated_at`. Si otra sesión modificó el registro, se rechaza la edición y se recarga la lista en vez de sobrescribir ese cambio.
- Se usa también un filtro de versión en la escritura para reducir la ventana de carrera entre lectura y actualización.

### 3. Presentación y accesibilidad
- Diseño adaptable para pantallas pequeñas, sin desbordamiento horizontal en el viewport móvil probado.
- Nombres accesibles de botones, mensajes de estado con `aria-live`, foco visible y soporte para movimiento reducido y colores forzados.
- Las acciones de archivados quedan bloqueadas mientras se revisa una propuesta E27 o la lista está sincronizándose.

## Archivos de ejecución para aplicar el parche

1. `index.html` — actualiza la versión de caché del módulo 62 a E28 y carga el CSS nuevo.
2. `js/62-nutrition-week-planner-shopping.js` — recuperación y edición protegida.
3. `css/109-nutrition-shopping-recovery-e28.css` — estilos nuevos.

Las pruebas actualizadas incluidas en el parche son opcionales para ejecutar la aplicación, pero se recomienda conservarlas en GitHub.

## Instalación

1. Hacé una copia de seguridad de E27 o trabajá en una rama de prueba.
2. Extraé el ZIP `AgendaFICH_Alimentacion_E28_patch.zip`.
3. Reemplazá `index.html` y `js/62-nutrition-week-planner-shopping.js` por los incluidos.
4. Agregá `css/109-nutrition-shopping-recovery-e28.css` dentro de `css/`.
5. Si guardás las pruebas en el repositorio, incorporá los archivos de `tests/` que vienen en el parche.
6. Publicá la rama y abrí la app con conexión. Probá recuperar un producto archivado y editar un producto manual pendiente.

**No hace falta ejecutar SQL.** E28 no añade ni modifica tablas, columnas, políticas, funciones de base de datos ni migraciones.

## Pruebas incluidas y realizadas

- Suite Node.js del proyecto: **175/175 aprobadas**.
- Auditoría de navegador E28: **12/12 aprobadas**.
- Auditoría de sincronización previa E27: **15/15 aprobadas**.
- Auditoría del flujo de compras E26: **9/9 aprobadas**.
- Auditorías del editor de recetas E25, editor seguro E24, integridad nutricional E23, autocompletado E20, consistencia E19, preferencias E18, microinteracciones E17, tarjetas E16, estados E14, divulgación E13, filtros E12, acabado E10, registro rápido E7 y vista móvil E6: aprobadas en sus ejecuciones individuales.
- 76 archivos JavaScript: comprobación sintáctica.
- 184 referencias locales de `index.html`: comprobadas, ninguna ausente.
- Se compararon los archivos existentes de Entrenamiento contra E27: no se modificaron.
- Se aplicó el parche sobre una copia recién extraída de E27 y se repitieron la suite Node y la auditoría de navegador E28.

## Limitaciones

La auditoría de navegador usa un proveedor Supabase simulado. No certifica las políticas ni la sincronización entre dispositivos de la instancia real de producción. Después de instalar, comprobá con una cuenta real que la restauración y edición se confirmen en el servidor. Probá también que dos cuentas distintas no puedan modificar los productos una de otra.

## Reversión

Restaurá `index.html` y `js/62-nutrition-week-planner-shopping.js` desde tu copia de E27 y eliminá `css/109-nutrition-shopping-recovery-e28.css`. No hay migraciones SQL que revertir.
