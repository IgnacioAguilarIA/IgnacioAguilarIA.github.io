Agenda FICH V95 — corrección de cronómetro y temporizador

Archivo modificado:
js/07-v31-training-persistence.js

La corrección usa marcas de tiempo reales (Date.now) y un bucle de refresco híbrido para que el cronómetro/temporizador no dependan de que setInterval se ejecute exactamente cada segundo. También mantiene el estado al pausar, recargar y volver a la sesión.
