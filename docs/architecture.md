# Arquitectura de Klisteni

Esta primera iteración reutiliza la organización de T3 Designer para separar datos comprobables, cálculo geométrico y presentación. Se trata de una aplicación estática que corre en el navegador; el modelo de entrenamiento reemplaza al modelo de departamento y sol.

## Mapa del repositorio

```text
apps/web/
  src/
    App.tsx                     Navegación, selección y composición de pantallas
    components/
      ExerciseViewer.tsx        Escena R3F, regiones musculares y controles
      Forms.tsx                 Rutina, sesión, cardio, ajustes y transferencia JSON
      Progress.tsx              Historial, semana y gamificación
      Modal.tsx                 Contenedor de diálogos
    data/exercises.ts           Catálogo, músculos, fuentes y rutina inicial
    lib/
      store.ts                  Estado Zustand y persistencia del navegador
      progress.ts               Fechas, validación y métricas puras
  test/                         Pruebas del dominio de la aplicación
  e2e/                          Flujos de navegador con Playwright
packages/
  scene-schema/src/index.ts     Contratos Zod y tipos inferidos
  geometry/src/index.ts         Poses, articulaciones y cinemática
docs/
  exercise-sources.md           Procedencia y límites de las decisiones educativas
```

El paquete `scene-schema` conserva el nombre de la arquitectura de referencia para sus contratos compartidos. No contiene geometría ni acceso al almacenamiento. `geometry` calcula coordenadas; `web` decide cómo mostrarlas. Ningún paquete compartido debe importar componentes de `apps/web`.

## Flujo de datos

```mermaid
flowchart LR
  S[scene-schema · Zod] --> D[Catálogo educativo]
  S --> P[Validación de registros]
  D --> A[App y formularios]
  A --> Z[Estado Zustand]
  Z --> L[localStorage]
  L --> P
  P --> Z
  Z --> M[Métricas de progreso]
  D --> V[Visor React Three Fiber]
  G[geometry · poses puras] --> V
```

El catálogo valida sus entradas con `ExerciseSchema` al cargar. Los tipos de ejercicio y músculo restringen los identificadores conocidos. Cada ficha incluye técnica, variantes, grupos principales y secundarios, además de enlaces de referencia. `getExercise` devuelve `undefined` cuando un identificador no pertenece al catálogo, para que la interfaz resuelva el caso explícitamente.

La rutina por defecto contiene seis movimientos sin equipo. El remo existe como ficha educativa opcional, y el editor de la rutina inicial solo ofrece ejercicios con `equipment: 'none'`. El alcance y la falta de tracción cargada se explican en la interfaz y en la documentación de fuentes.

## Modelo de movimiento

`getExercisePose(exerciseId, phase)` recibe un identificador y una fase de ciclo; devuelve pelvis, inclinación del torso y articulaciones de ambos brazos y piernas. El sistema usa metros, el eje Y hacia arriba y Z hacia el frente cuando el avatar está de pie.

`solveLimb` resuelve dos segmentos mediante cinemática inversa y conserva sus longitudes. Las poses colocan objetivos para manos y pies; el visor orienta y escala las mallas siguiendo esos puntos. El dead bug alterna diagonales durante el ciclo. El resto de los ejercicios recorre dos fases, con interpolación suave entre extremos.

El visor se carga de forma diferida desde `App.tsx`. React Three Fiber coordina la escena de Three.js y Drei aporta `OrbitControls`. La animación actualiza referencias durante los frames para evitar reconstruir toda la interfaz a cada paso; el estado visible de la línea de tiempo se actualiza con menor frecuencia. El usuario puede pausar, recorrer una fase, reducir velocidad y cambiar cámara.

Los músculos son superficies simplificadas que acompañan al torso o los segmentos. Su color expresa el papel asignado en el catálogo y no una simulación fisiológica. El modelo no tiene tejidos deformables, fuerzas, cargas articulares, reconocimiento de cámara ni validación personalizada del gesto. La W y el remo no se consideran equivalentes por compartir parte de la espalda coloreada.

No hay una dependencia de Blender en el arranque, build o runtime. Si se incorpora un avatar riggeado, conviene mantener el contrato de ejercicios y la capa de reproducción, versionar el archivo editable y documentar la correspondencia entre huesos, músculos y clips exportados. Una futura exportación GLB no sustituiría el archivo fuente de autoría.

## Sesiones, métricas y persistencia

Una sesión activa mantiene su avance dentro de `WorkoutSession`. Cada registro de serie guarda el ejercicio y las repeticiones introducidas; `sets: 1` representa esa serie concreta. La suma de esas entradas constituye una sesión guardada. No se infiere trabajo realizado a partir de la reproducción 3D, del tiempo abierto o de la rutina planeada.

`WorkoutLog` conserva ID, fecha local, timestamp de finalización, duración y series realizadas. `CardioLog` conserva ID, fecha local, actividad, minutos y distancia opcional. `ProgressData` usa `version: 1` y valida colecciones, límites numéricos, fechas reales e identificadores únicos antes de serializar o importar.

| Clave | Contenido |
| --- | --- |
| `klisteniapp.progress.v1` | Sesiones de fuerza y cardio validados |
| `klisteniapp.preferences.v1` | Ejercicios y orden, cantidad de series, objetivo semanal, movimiento reducido |
| `klisteniapp.progress.recovery` | Original ilegible preservado antes de escribir nuevo progreso, descargable desde Ajustes |

La transferencia JSON incluye solo `ProgressData`. Importar reemplaza el historial después de una confirmación en la interfaz; no modifica las preferencias ni fusiona registros. Las versiones futuras requieren una migración deliberada antes de aceptarlas. Un formato desconocido o corrupto produce un error visible, sin transformarlo en historial válido.

Antes de reemplazar un valor ilegible, se conserva el original en la clave de recuperación. Si esa copia tampoco puede escribirse, se mantiene el valor original y se indica que los cambios solo están en memoria. Una copia de recuperación anterior diferente se conserva con un sufijo de timestamp. El botón de descarga de Ajustes ofrece la copia más reciente.

`computeProgress` calcula las métricas a partir de registros guardados. La fecha `YYYY-MM-DD` se interpreta como el día local elegido y no se deriva de una conversión UTC. La semana empieza el lunes. Los desplazamientos usan calendario, no bloques fijos de 24 horas, para respetar los días de 23 o 25 horas. Los IDs duplicados y las fechas futuras no aumentan las recompensas.

Los XP son una regla de producto: 10 por serie y 1 por minuto de cardio; cada 100 XP cambia el nivel. La racha considera días consecutivos con registros y admite que hoy todavía no tenga actividad si ayer sí la tuvo. Los descansos no eliminan XP. Las cifras no se interpretan como intensidad, gasto energético, calidad del ejercicio ni cumplimiento automático de una guía aeróbica.

## Límites de esta versión

- El almacenamiento es por navegador y origen. No hay backend, cuentas ni sincronización; una exportación es la vía de portabilidad del historial.
- El estado de una sesión activa no persiste entre recargas. La interfaz avisa antes de abandonar y distingue series pendientes de guardar.
- No se implementa coordinación de escrituras entre varias pestañas. La operación recomendada es registrar desde una sola pestaña.
- La interfaz actual es española. `i18next` y `react-i18next` forman parte de las dependencias compartidas con T3, pero todavía no se conectaron a los textos.
- La escena requiere WebGL 2; si falla, las instrucciones textuales siguen disponibles. Las pruebas de navegador deben complementarse con una inspección visual en hardware real.
- Las fuentes se cargan desde Google Fonts. No existe service worker ni garantía de arranque sin conexión.
- La duración de una sesión mide el tiempo transcurrido desde el inicio, incluidos los descansos; no equivale a tiempo activo ni intensidad.

## Cambiar la aplicación sin perder consistencia

Para incorporar un ejercicio, primero definí su ID y el contrato; agregá la ficha con fuente y requisitos de equipo, después su pose y presentación. Revisá músculos, variantes y recorrido junto con el contenido, porque una prueba de longitudes óseas no confirma una técnica correcta. Una ficha con equipamiento no debe entrar automáticamente en la rutina sin equipo.

Los cambios de registro o XP pertenecen al esquema y las funciones de progreso antes de llegar al texto de la interfaz. Cambiar la versión del historial exige decidir una migración y probar exportación/importación. Los cambios visuales del avatar deben conservar el mapa de IDs musculares que utiliza el catálogo.

Ejecutá `pnpm check` para lint, tipos, tests y build. `pnpm test:e2e` levanta Vite en el puerto 4174 y recorre la interfaz de escritorio y móvil. `pnpm check:all` combina ambas comprobaciones. Los resultados concretos dependen de la ejecución actual; este documento describe la cobertura prevista y no certifica un despliegue o una revisión biomecánica.
