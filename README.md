# Agenda FICH V96 — proyecto separado

Esta versión reconstruye la arquitectura separada usando como base el HTML V95 y recupera el orden de ejecución original del proyecto monolítico para evitar problemas de inicialización.

## Cambio clave
Los scripts ya no usan `defer`: se ejecutan en el mismo punto y orden que tenían los scripts inline originales. La Vista de entrenamiento usa el núcleo V82 probado, en especial para los controles del cronómetro/temporizador.

## Estructura
- index.html
- css/
- js/

Las versiones nuevas (clima, productividad, seguimiento y descanso) quedan separadas y al final del flujo.
