# Lista de comprobación de sincronización real (cuenta de prueba)

Este procedimiento se ejecuta manualmente en la aplicación publicada porque los tests locales no tienen acceso a la sesión real de Supabase.

- [ ] Usar una cuenta de prueba sin datos importantes.
- [ ] Crear una comida temporal y añadir un alimento detallado con unidad/conversión válida.
- [ ] Marcar «Consumir», desmarcar y volver a marcar; recargar y comprobar que prevalezca la última acción.
- [ ] Revisar el historial: como máximo una entrada por usuario, alimento y fecha según la restricción existente.
- [ ] Activar modo Offline en DevTools, cambiar el estado y confirmar que la interfaz lo muestre pendiente, no como sincronizado.
- [ ] Volver Online y usar «Reintentar sincronización»; comprobar que la cola solo se limpia tras confirmación.
- [ ] En lo posible, cortar la respuesta de red después de enviar la petición; reintentar y comprobar que no duplica el historial.
- [ ] Iniciar sesión en una segunda cuenta de prueba y confirmar el aislamiento de comidas, alimentos propios, preferencias, recetas e historial.
- [ ] Verificar que los cambios de una cuenta no actualicen estados ni mensajes de sincronización de la otra.
- [ ] Eliminar los datos temporales de prueba y confirmar que los datos personales reales no cambiaron.

No compartir contraseñas, tokens de sesión, service_role, nombres de alimentos personales ni IDs privados al enviar resultados.
