# Dashboard personal

El resumen de **Mi salud** utiliza los datos de la cuenta ya cargados. No realiza envíos, no registra eventos de uso y no configura una conexión con el reloj. Umami sigue recibiendo únicamente la visita consentida y sanitizada; los gráficos personales son independientes de esa telemetría.

## Lectura de los gráficos

- **Período:** 7, 30 o 90 fechas de calendario, incluyendo hoy en la zona horaria de la cuenta. Este filtro afecta al dashboard; los objetivos conservan su fecha de inicio y los últimos registros muestran todo el historial. La aritmética de fechas evita desplazar el rango al cambiar el horario de verano.
- **Cuerpo:** se elige una medida y una fuente/dispositivo. Cada punto es la última observación de esa fecha, ordenada por instante real, sin interpolar días ausentes. El cambio compara primera y última fecha observadas dentro del período, no una fecha inventada al comienzo. Un solo punto no produce un cambio. La escala vertical se ajusta a los valores y está rotulada; nunca se mezclan kg, cm y porcentajes en un eje.
- **Descanso:** horas por fecha de despertar y promedio sobre días utilizables. Se detectan superposiciones antes de recortar el período para no perder conflictos en el límite. Noches ambiguas quedan excluidas y visibles como pendientes de revisión; faltantes no equivalen a cero horas.
- **Constancia:** fechas distintas con sesiones de fuerza en Klisteni. Dos sesiones un día cuentan una vez. Los registros importados de actividad no se suman como otra sesión. El calendario indica presencia de registros, no asegura ausencia de ejercicio fuera de la plataforma.
- **Comidas:** suma de los campos presentes y cantidad de registros que aportan cada nutriente. Los campos ausentes no se vuelven cero; un cero registrado sí cuenta. No es un promedio diario completo ni una estimación de déficit.
- **Suplementos:** registros marcados como tomados o no tomados, agrupados por nombre, y fechas con anotaciones. No calcula dosis, prescripciones ni porcentaje de adherencia sin un plan definido.
- **Cobertura:** cantidad y última fecha de observación de cada categoría en el período. La fecha de observación no representa una sincronización reciente.

Las fuentes son las declaradas en cada registro. Los filtros por fuente corporal evitan comparar aparatos distintos involuntariamente, pero no autentican datos importados. Los totales de alimentación describen los registros existentes; conviene corregir entradas que representen la misma comida antes de interpretarlos.

## Interfaz y verificación

React mantiene controles y selección efímera; el helper puro transforma datos y los dos gráficos SVG dibujan puntos/barras. No se guardan selecciones sensibles en URL ni en localStorage. Las tablas desplegables permiten leer fechas y valores sin depender de hover, color o precisión táctil. El diseño pasa a una columna en pantallas estrechas; no requiere animación ni una librería de gráficos adicional.

```sh
pnpm --filter @klisteniapp/b2c-web exec node --test test/health-dashboard.test.ts
pnpm --filter @klisteniapp/b2c-web typecheck
pnpm --filter @klisteniapp/b2c-web exec playwright test --config playwright.health.config.ts
```

Las pruebas de dominio cubren límites de calendario y horario de verano, doble entrenamiento diario, sueño ambiguo cruzando el rango, nutrientes ausentes/cero, fuentes separadas y orden de timestamps con offsets. El recorrido de navegador comprueba filtros de período/fuente/medida, tablas y layout móvil con una cuenta simulada: esos valores son fixtures de prueba, no datos del usuario. Los filtros son de solo lectura.

Para conectar observaciones nuevas automáticamente falta implementar y validar el [puente Android y el protocolo de sincronización](health-sync.md). La interfaz lo indica expresamente.
