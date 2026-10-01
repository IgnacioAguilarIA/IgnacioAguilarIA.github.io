Agenda FICH — base preparada para catálogo de alimentos

Esta versión agrega una interfaz y una capa de normalización para conectar más adelante un catálogo externo (Open Food Facts) sin modificar el esquema actual de nutrition_meals.

La búsqueda externa todavía NO está conectada: el punto único de integración es window.AgendaFoodCatalog.search(query), que deberá devolver una lista de productos/items normalizados o compatibles con normalize().
