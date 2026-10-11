# Yoga

Yoga tiene un espacio propio en la navegación: biblioteca de asanas, prácticas
personales e historial. El catálogo educativo está en español y conserva los
nombres sánscritos y equivalentes ingleses para buscar. Cada ficha reúne entrada,
ejecución, salida, respiración, sensaciones, adaptaciones, cuidados y contexto
histórico y cultural. Los [criterios y fuentes](yoga-sources.md) documentan el
alcance editorial. Las 24 asanas tienen una representación del mismo atlas
anatómico que usa la biblioteca de ejercicios.

## Representación 3D

La preferencia global **Modelo corporal: Hombre / Mujer** se aplica a las tarjetas,
la ficha y la práctica guiada. Es una elección visual: no modifica tiempos,
indicaciones ni registros. Las dos representaciones usan el atlas existente y la
misma transformación paramétrica del resto de Klisteni.

Las tarjetas parten de una imagen estática y muestran una secuencia animada al
explorarlas, sin crear un canvas por postura. La ficha y la sesión permiten abrir
un visor 3D, elegir el ángulo y explorar las capas del modelo. Si el dispositivo
no puede usar WebGL, conservan la imagen renderizada y las instrucciones. La
representación acompaña la explicación y sus adaptaciones; no mide la movilidad
ni las proporciones de la persona que está practicando.

Cada demostración recorre preparación, entrada, permanencia y salida en un ciclo
ilustrativo de 12 segundos. El cuerpo se mueve dentro de un encuadre fijo; la
cámara solo cambia al usar sus controles. Se puede pausar, recorrer la secuencia,
reiniciar y elegir velocidad normal o media. El ciclo no prescribe la duración
de una asana ni una cadencia respiratoria, y verlo no pone en marcha el reloj de
la práctica ni crea un registro.

La preferencia de movimiento reducido, tanto del sistema como de la aplicación,
evita la reproducción automática. El visor se puede reproducir expresamente y
se pausa al ocultarse o suspenderse. Las miniaturas conservan su poster cuando
no están a la vista o no corresponde reproducir movimiento.

Las posturas asimétricas tienen poses y renders independientes para izquierda y
derecha. En una práctica guiada el modelo sigue el lado del tramo actual. Cambiar
la cámara no cambia el lado anatómico, y la interfaz no espeja una imagen para
simular el otro lado.

Yoga conserva los 17 segmentos originales y las longitudes de las extremidades,
y añade nueve controles axiales y dos controles intermedios de hombro:
**28 huesos en el rig de Yoga**. La
influencia del torso se reparte a lo largo de esos controles para representar la
curva de Gato/Vaca, flexiones y extensiones sin mover los anclajes de hombros y
pelvis. Los controles de hombro reparten el giro entre torso y húmero para
conservar la superficie al elevar o plegar los brazos. Cada estructura ósea usa
un control rígido; la piel y los músculos interpolan sus influencias.
El atlas fuente y el rig de los ejercicios conservan
su geometría y comportamiento. La curva de la columna es una aproximación
educativa, no una simulación vértebra por vértebra ni de tejidos blandos.

La entrada y la salida coordinan base, torso, cabeza y extremidades con tiempos
propios; las manos libres siguen arcos y los apoyos se resuelven de nuevo en cada
cuadro. Una pequeña variación del tórax durante la permanencia evita un cuerpo
inmóvil, sin prescribir un patrón respiratorio. El encuadre mide todo el ciclo,
incluidos la salida y esos pequeños cambios. El estudio de Yoga emplea luz suave,
sombras cortas, una colchoneta con espesor y bloques de bordes redondeados. Los
ángulos predeterminados muestran el perfil de la columna y los apoyos.

Algunos tendones largos ligados a la tibia pueden intersectar el piso
en la capa muscular al flexionar mucho el tobillo; los apoyos se verifican sobre
la superficie de piel. Yoga calibra rodillas y apoyo anterior de pelvis usando
la superficie deformada de cada modelo, para evitar que queden suspendidos sobre
la colchoneta. Las pruebas del GLB comprueban esa superficie para ambos modelos
y el apoyo de cabeza y espalda en las posturas supinas.

## Prácticas y registro

Una práctica guarda nombre, intención y una secuencia ordenada. Cada aparición de
una asana tiene su propio identificador, tiempo y lado; repetir una postura es
válido. Las posturas asimétricas se practican por lado, con temporizadores
separados. Las propuestas iniciales se pueden adaptar antes de guardar.

La práctica guiada permite pausar, continuar, omitir posturas y terminar antes.
El registro conserva una copia de la secuencia y solo los tramos realizados:
editar o borrar una práctica no cambia su historial. El tiempo pausado y los
tramos omitidos no generan minutos registrados. La pantalla de revisión permite
añadir notas antes de guardar.

Yoga aparece también en **Mi progreso**. Cuenta para los días activos y suma un
XP por minuto acumulado de práctica registrada. No completa objetivos de fuerza
ni genera repeticiones, series o minutos de cardio.

## Persistencia

Los esquemas compartidos están en `packages/scene-schema/src/yoga.ts`.
`PersonalSettings.yoga` es opcional para mantener compatibles las copias v2 y
los clientes antiguos: omitir este campo no borra datos existentes. Contiene
`practices` y `logs`; los registros validan que sus pasos, lados y duraciones
correspondan a la secuencia guardada y que la duración total sea su suma.

La demo guarda estos datos en la copia personal local. Una instancia usa la
cuenta activa y revisiones del servidor; los datos de otra cuenta no se mezclan
con la biblioteca pública ni con la copia local. Un fallo de guardado conserva
el formulario para reintentar. La exportación personal incluye yoga. Al importar
en una cuenta, los registros se combinan por identificador; restaurar ajustes
incluye también las prácticas. Conflictos con el mismo identificador y otro
contenido se rechazan.

## Archivos principales

- `apps/b2c-web/src/data/yoga.ts`: contenido y secuencias iniciales.
- `apps/b2c-web/src/components/YogaPage.tsx`: biblioteca y prácticas.
- `apps/b2c-web/src/components/YogaPracticeEditor.tsx`: editor de secuencias.
- `apps/b2c-web/src/components/YogaSession.tsx`: guía, tiempos y revisión.
- `apps/b2c-web/src/components/YogaAsanaArt.tsx`: posters del atlas para cada modelo y lado.
- `apps/b2c-web/src/components/YogaViewer.tsx`: visor interactivo y alternativa estática.
- `apps/b2c-web/src/components/YogaStage.tsx`: atlas, pose y cámara compartidos con la captura.
- `apps/b2c-web/src/lib/yoga-rig.ts`: poses de las 24 asanas sobre el rig anatómico.
- `apps/b2c-web/src/lib/yoga-anatomy.ts`: preparación del atlas y controles axiales exclusivos de Yoga.
- `apps/b2c-web/src/lib/yoga-motion.ts`: ciclo, fases e interpolación del movimiento.
- `apps/b2c-web/src/lib/yoga-rendering.ts`: encuadre de la pose y vistas del modelo.
- `apps/b2c-web/src/lib/yoga-preview-assets.ts`: rutas de las imágenes por asana, modelo y lado.
- `apps/b2c-web/src/lib/store.yoga.ts`: operaciones compartidas de persistencia.
- `apps/b2c-web/src/lib/yoga-practice.ts`: búsqueda, lados y tiempos.
- `scripts/export-yoga-blender.mjs`: exportación del rig y sus ciclos a GLB con animaciones.
- `scripts/blender/build_yoga.py`: preparación de la escena editable de Blender.

Las validaciones de yoga se ejecutan con las pruebas de schema, web y API.
La aceptación del flujo de usuario está en `apps/b2c-web/e2e/yoga.spec.ts`.
`apps/b2c-web/e2e/yoga-3d.spec.ts` cubre los posters realmente cargados, la preferencia
global, los lados de la práctica, la alternativa sin WebGL y el visor interactivo.
Los casos estáticos simulan la falta de un contexto WebGL en una página aislada.
La comprobación interactiva exige que llegue el GLB real, que el atlas esté listo
y que los controles de cámara cambien la imagen del canvas. Guarda capturas de
ambos modelos para revisión visual.
Los casos de movimiento comparan el raster durante reproducción, pausa y cambio
de fase. Además, observan las matrices que llegan a WebGL para comprobar que el
cuerpo cambia sin mover la cámara. Cubren ambas representaciones y lados,
velocidad, movimiento reducido, ocultación y suspensión, y comprueban que mirar
la demostración no inicia el temporizador ni añade tiempo al historial.

```sh
pnpm --filter @klisteniapp/b2c-web exec playwright test e2e/yoga-3d.spec.ts e2e/yoga.spec.ts e2e/model-variant.spec.ts
```

El flujo de instancia se comprueba con `apps/b2c-web/e2e/yoga-account.spec.ts`:
conflictos de revisión, recuperación como copia, borrado con acceso vencido y
reintento de un fallo de red. Su configuración autónoma usa un bundle de
instancia y una API simulada:

```sh
pnpm --filter @klisteniapp/b2c-web exec playwright test --config playwright.yoga-account.config.ts
```

Estas pruebas no sustituyen la integración PostgreSQL de `apps/b2c-api/tests`:
esa integración requiere una base desechable y no debe usar cuentas reales.

## Generar posters y animaciones

Desde la raíz del repositorio:

```sh
pnpm yoga-previews:generate
pnpm yoga-previews:check

# Iterar una asana y una representación
pnpm yoga-previews:generate --asana vrksasana --model female

# Exportar hojas de contacto para comparar todas las poses
pnpm yoga-previews:generate --contact-sheets /tmp/klisteni-yoga-review
```

El generador `scripts/generate-yoga-previews.mjs` renderiza las poses en Chromium
con WebGL y codifica un poster y una animación WebP por variante. Requiere las
dependencias del repositorio, Chromium de Playwright, `cwebp` e `img2webp`, igual
que las miniaturas anatómicas de ejercicios. No requiere una cuenta ni datos
personales.

Las imágenes se guardan en
`packages/model-assets/public/previews/yoga/{male|female}/{asanaId}-{both|left|right}.webp` y la
animación añade el sufijo `-motion.webp`. Cada modelo tiene una pareja para cada
postura bilateral y dos parejas para cada postura asimétrica: **64 posters y 64
animaciones para las 24 asanas y los dos modelos**. El manifiesto
registra las fuentes y los hashes de las imágenes. `yoga-previews:check` detecta
archivos ausentes o desactualizados sin volver a renderizar y forma parte de
`pnpm previews:check`.

El generador y el visor comparten la pose y el modelo. Al cambiar una pose, su
encuadre o las fuentes del atlas, regenerá las imágenes y revisá visualmente ambas
representaciones y los dos lados. Los hashes prueban la procedencia de los
archivos; no sustituyen esa revisión visual.

La entrada de captura es `apps/b2c-web/yoga-preview-capture.html`, servida por un Vite
aislado durante la generación. Usa `YogaStage` con la capa muscular y una cámara
ortográfica que encuadra el ciclo completo una sola vez, incluida la morfología
elegida. Los posters predeterminados miden **512 × 384 píxeles** y las animaciones
**384 × 288**, con 240 muestras a 20 cuadros por segundo para el ciclo de 12
segundos. `--size` cambia el ancho del poster entre 128 y 1024; la altura conserva
la relación 4:3 y la animación limita su ancho a 384. `--fps` admite 4, 5, 8, 10,
20 o 25. Las capturas de desarrollo no se incorporan al build público.

Para revisar otras capas sin cambiar los posters, esa entrada admite
`?asana=marjaryasana&model=female&layer=skin&view=side`. `layer` acepta `muscles`,
`skin`, `skeleton` o `combined`; `view` acepta `perspective`, `front`, `side` o
`back`. Los valores predeterminados siguen siendo `muscles` y `perspective`.
La API de captura `window.__yogaCapture.frame(fase)` permite inspeccionar de
forma determinista cualquier punto del ciclo entre 0 y 1.

`--contact-sheets` exporta tanto las posturas de permanencia como comparaciones
de preparación, entrada y permanencia, para revisar las trayectorias de ambos
modelos y cada lado.

El manifiesto incluye variante, lado, límites geométricos, cámara, versión de las
herramientas, procedencia del atlas, duración, cuadros distintos y hashes de
fuentes y WebP. El chequeo también valida la duración y el bucle del archivo
animado a través de sus bloques ANIM/ANMF. El manifiesto usa la versión 2 y el
generador exige que el cuerpo produzca cuadros distintos manteniendo la cámara
y los límites del encuadre constantes en cada cuadro. Las imágenes son
renders derivados del atlas y conservan sus [créditos y licencia](../packages/model-assets/public/previews/yoga/NOTICE.md).
No se promete igualdad de píxeles entre GPU o versiones de Chromium distintas.

## Taller de Blender

`node scripts/export-yoga-blender.mjs` exporta a
`artifacts/yoga-quality/blender/` el atlas preparado, los pesos y los mismos
movimientos que utiliza el visor. Produce un GLB por modelo, con 32 clips cada
uno: **64 clips** para las 24 asanas y sus lados.
Los clips se muestrean a 24 cuadros por segundo e incluyen preparación, entrada,
permanencia y salida. Un manifiesto enumera modelos, huesos y acciones.

`scripts/blender/build_yoga.py` prepara esos archivos como un taller editable y
guarda `assets/blender/yoga-quality.blend`, con una escena por modelo y acciones
que se pueden elegir en el editor de acciones. Ese archivo se genera desde las
fuentes; el atlas original permanece en su propio archivo.

El constructor verifica los hashes de fuentes y GLB, los huesos, las acciones y
sus tiempos antes de guardar. La reproducción cubre los cuadros 1–288 a 24 fps;
el cuadro 289 conserva la clave de cierre, igual al primero.
Elimina sólo claves interiores redundantes de tramos constantes con interpolación
lineal, conservando ambos extremos y cada muestra que cambia. También limpia los
buffers del explorador de archivos antes de guardar el archivo público.
La cámara fija mide la geometría deformada en 33 fases de cada acción, incluye
los bloques y ambas orientaciones de colchoneta, y conserva margen en los bordes.
El archivo incluye los créditos del atlas y el texto completo de su licencia.

Los bloques se organizan en colecciones por acción bajo **Pose supports**,
excluidas por defecto. Activá la colección correspondiente cuando una asana usa
bloques y desactivala al cambiar de postura. La colchoneta se puede girar 90°
alrededor de Z para Guerrero II y Triángulo. No requiere ejecutar scripts al
abrir el archivo para reproducir las acciones o mostrar los apoyos.

Las exportaciones son artefactos de trabajo derivados del atlas; los ajustes
permanentes de la aplicación siguen viviendo en las fuentes de Yoga. Después de
cambiar esos ajustes, regenerá el taller y las miniaturas para mantenerlos de
acuerdo con el visor, y conservá los créditos y la licencia del atlas.
