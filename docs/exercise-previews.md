# Miniaturas del movimiento

**Estado del 11 de octubre de 2026:** la generación y validación completa de previews están diferidas por decisión del usuario hasta terminar los modelos 3D y sus cambios relacionados. Conservar los archivos existentes. Esta guía describe cómo retomarlas después; no es una tarea de arranque en la Mac. El [roadmap](roadmap-implementacion.md) y la [entrega](b2b-release.md) registran qué quedó pendiente y por qué no se declara el gate completo de previews aprobado.

Las tarjetas de **Mi rutina** y **Ejercicios** usan imágenes del mismo atlas anatómico y del mismo movimiento que el visor 3D. Las miniaturas se generan localmente con Chromium, desde una entrada de captura de Vite. La interfaz sirve los archivos resultantes como imágenes: cada tarjeta no crea otro canvas ni carga otra instancia del modelo. **Mi cuerpo** muestra miniaturas estáticas de las regiones anatómicas aisladas, descritas al final de esta guía.

El formato que consume la aplicación es **WebP animado**, acompañado de un **poster WebP estático**. Se puede exportar también GIF para compartir o comparar, pero la interfaz no lo necesita.

La preferencia global **Modelo corporal** selecciona la representación masculina (`male`) o femenina (`female`) para el visor y para las imágenes de ejercicios. El generador captura ambas con la misma escena, cámara y trayectoria, aplicando la morfología paramétrica compartida de `anatomy-variants.ts`. La selección de modelo visual no cambia la prescripción del ejercicio ni permite inferir sexo, género o condiciones de salud de la persona.

## Requisitos

- Node.js 24 o superior y pnpm 12.7.0, como el resto del repositorio.
- Dependencias instaladas y los archivos anatómicos existentes en `packages/model-assets/public/models`.
- Chromium de Playwright, con WebGL disponible para renderizar la escena.
- `cwebp` e `img2webp`, incluidos en las herramientas de WebP.
- Solo para `--gif`: FFmpeg.

Desde la raíz del repositorio:

```sh
pnpm install --frozen-lockfile
pnpm --filter @klisteniapp/web exec playwright install chromium

# macOS con Homebrew: codificadores WebP
brew install webp

# Opcional, para exportar GIF
brew install ffmpeg
```

El script busca los codificadores en `PATH`. Para instalaciones en otras rutas, admite `WEBP_CWEBP_BIN`, `WEBP_IMG2WEBP_BIN` y `FFMPEG_BIN`, cada una con la ruta de su ejecutable. No hace falta Blender para capturar el modelo ya preparado.

En un servidor sin GPU, `PREVIEW_SOFTWARE_WEBGL=1` activa explícitamente SwiftShader para los tres generadores. Los argumentos de Chromium quedan registrados en el manifiesto. Por ejemplo: `PREVIEW_SOFTWARE_WEBGL=1 pnpm previews:generate --gif`. Los frames temporales se eliminan después de publicar cada captura, manteniendo el uso de disco acotado durante una regeneración completa.

Los tres generadores aceptan `--only-stale` para retomar una ejecución interrumpida. Antes de omitir una captura comparan las fuentes actuales, las dimensiones/fps solicitadas, las versiones del navegador y codificadores, los argumentos del renderer y el hash y tamaño real de cada archivo. Exigen una fecha ISO UTC válida, con hasta cinco minutos de diferencia futura para tolerar relojes de distintos hosts. No cambian la fecha ni el manifiesto de las capturas verificadas. Para conservar también todos los GIF existentes, usar `PREVIEW_SOFTWARE_WEBGL=1 pnpm previews:generate --gif --only-stale`. En yoga, combinarlo con `--contact-sheets` vuelve a renderizar sólo las tres fases de revisión de los ítems ya verificados; los archivos publicados conservan su procedencia original.

Una regeneración completa y reanudable en Linux puede ejecutarse en serie así, conservando el log de cada familia y las planchas de revisión:

```sh
mkdir -p .cache/preview-review
PREVIEW_SOFTWARE_WEBGL=1 pnpm previews:generate --gif --only-stale > .cache/preview-review/exercise.log 2>&1
PREVIEW_SOFTWARE_WEBGL=1 pnpm body-previews:generate --only-stale --contact-sheet .cache/preview-review/body.png > .cache/preview-review/body.log 2>&1
PREVIEW_SOFTWARE_WEBGL=1 pnpm yoga-previews:generate --only-stale --contact-sheets .cache/preview-review/yoga > .cache/preview-review/yoga.log 2>&1
pnpm previews:check
```

Mantener las fuentes quietas durante la captura; el generador rechaza publicarlas si cambiaron entre frames. Si una ejecución se interrumpe, corregir la causa y repetir el mismo comando con sus mismos parámetros. El registro por ítem distingue `Capturing` de `Verified current`. Una captura incompleta o un archivo ausente/corrupto se vuelve a generar, sin inventar comprobantes para los archivos previos. La comprobación final no necesita acceso a Git ni al recibo histórico cuando todas las capturas corresponden a las fuentes actuales.

## Generar y comprobar

```sh
# Regenerar todo el catálogo en ambos modelos conservando los GIF
pnpm previews:generate --gif

# Iterar un ejercicio
pnpm previews:generate --exercise squat --gif

# Iterar solo la representación femenina de un ejercicio
pnpm previews:generate --exercise squat --model female --gif

# Regenerar varios ejercicios concretos
pnpm previews:generate --exercise pushup --exercise dead-bug --gif

# Añadir un GIF junto a los dos WebP de un modelo
pnpm previews:generate --exercise squat --model female --gif

# Comprobar fuentes y archivos de todo el catálogo sin renderizar
pnpm previews:check

# Equivalente directo y ayuda
node scripts/generate-exercise-previews.mjs --check
pnpm previews:generate --help
```

El catálogo incluye 37 identificadores, definidos en `ExerciseIdSchema` y en `packages/catalog-base/src/exercises.ts`. A los quince movimientos anteriores se agregan `quarter-squat`, `paused-squat`, `knee-narrow-pushup`, `narrow-pushup`, `dead-bug-heel-tap`, `quadruped-leg-extension`, `prone-t-raise`, `prone-y-raise`, `split-squat`, `single-leg-calf-raise`, `bridge-march` y `single-leg-glute-bridge`. La tercera ampliación suma `bent-knee-row`, `dead-bug-arm-only`, `sumo-squat`, `single-leg-deadlift`, `forward-lunge`, `quadruped-arm-raise`, `prone-hip-extension`, `supine-march`, `supine-heel-slide` y `plank-shoulder-tap`. El script valida los identificadores y arranca su propio servidor Vite en `127.0.0.1`, usando un puerto libre; no requiere una sesión de `pnpm dev` abierta. Cierra el navegador y el servidor al terminar.

Los resultados quedan en `packages/model-assets/public/previews`:

| Archivo | Uso |
| --- | --- |
| `{id}-poster.webp` | Imagen estática de una fase representativa |
| `{id}.webp` | Ciclo completo animado en bucle |
| `{id}.gif` | Exportación opcional con `--gif` |
| `female/{id}-poster.webp`, `female/{id}.webp`, `female/{id}.gif` | Los mismos formatos para la representación femenina |
| `manifest.json` | Parámetros, versiones del renderizador y hashes de procedencia y resultados |
| `NOTICE.md` | Créditos y licencia de las imágenes anatómicas |

Los archivos sin prefijo conservan los enlaces existentes de la representación masculina. [`exercise-preview-assets.ts`](../apps/web/src/lib/exercise-preview-assets.ts) resuelve las rutas de poster, animación y GIF para ambos modelos. `--model male`, `--model female` o `--model all` selecciona la captura; el valor predeterminado es `all`. Una generación sin `--gif` elimina el GIF previo del ejercicio y modelo regenerados. La aplicación sigue usando WebP en ambos casos.

El manifiesto de versión 2 guarda cada catálogo en `variants.male.exercises` y `variants.female.exercises`; cada entrada registra `modelVariant`, sus fuentes y sus archivos. Al regenerar desde un manifiesto antiguo se conserva el historial masculino hasta reemplazar cada entrada por una captura nueva.

La consola informa por ejercicio la cantidad de frames, la duración y el tamaño real del WebP generado. Consultá los campos `bytes` de `manifest.json` para conocer el peso de cada archivo; no hay un peso fijo prometido para todas las poses o resoluciones.

## Resolución, tiempo y encuadre

Los valores predeterminados son **256 × 256 píxeles**, **12 frames por segundo**, DPR 1 y fondo opaco `#172526`. Cada ciclo bilateral o unilateral dura **6 segundos / 72 frames**. Los movimientos con metadata `laterality: alternating` duran **10 segundos / 120 frames** para mostrar ambos lados con una vuelta al centro: dead bug, sus toques de talón, zancada atrás y lateral, bird dog, extensión de pierna en cuadrupedia, escaladores, marcha de puente, dead bug solo de brazos, zancada adelante, elevación de brazo en cuadrupedia, marcha supina, deslizamiento de talón y toques de hombro en plancha. El visor y el generador comparten esas duraciones en `exercise-animation.ts`; los rótulos del visor siguen también las dos mitades de cada ciclo alternado.

`split-squat`, `single-leg-calf-raise`, `single-leg-glute-bridge`, `single-leg-deadlift` y `prone-hip-extension` se practican por series de un lado antes de cambiar. Su metadata es `unilateral`, sus repeticiones se registran por lado y la demostración muestra un lado. Las fichas explicitan el cambio de pierna; no se simula una alternancia que convertiría el movimiento en otro ejercicio. La sentadilla con pausa sigue siendo un movimiento por repeticiones, con una meseta en la trayectoria: no incorpora un registro por segundos.

Se pueden explorar otras resoluciones o cadencias:

```sh
pnpm previews:generate --exercise squat --size 384 --fps 16
```

`--size` admite enteros entre 64 y 1024; `--fps`, entre 1 y 60. Cambiar estos valores modifica los archivos con los mismos nombres. Los parámetros usados quedan registrados por ejercicio; para recuperar los valores predeterminados, regenerá sin esas opciones. El poster se codifica con calidad 86 y la animación con calidad 78. El GIF opcional utiliza una paleta calculada desde sus frames.

Las cámaras están en [`exercise-preview-config.ts`](../packages/anatomy-viewer/src/exercise-preview-config.ts). Cada ejercicio define posición, objetivo, altura del encuadre ortográfico y `posterPhase`. La cámara permanece fija durante todo el ciclo. Para mejorar un ángulo o evitar recortes, cambiá esos datos y revisá todo el movimiento; no ajustes la imagen de una única fase olvidando los extremos.

## De dónde sale cada frame

[`ExerciseStage.tsx`](../packages/anatomy-viewer/src/ExerciseStage.tsx) es la escena compartida entre `AnatomyViewer` y la captura. Reúne `AnatomicalModel`, `AnatomyStudio` y la barra de los dos remos, con piernas extendidas o rodillas flexionadas. La captura usa el GLB, las referencias articulares y el rig de la aplicación, con la capa muscular y sin resaltado de grupos. No mantiene una segunda animación dibujada a mano.

[`preview-capture.tsx`](../apps/web/src/preview-capture.tsx) espera que el modelo esté preparado y expone `window.__exerciseCapture.frame(phase)`. El generador solicita fases exactas `frame / frameCount`: actualiza la pose, renderiza y obtiene el PNG de ese mismo frame. No depende de esperar una cantidad de milisegundos ni de grabar la pantalla a velocidad real. Se excluye el extremo duplicado de fase 1 para evitar una pausa al cerrar el bucle. Antes de guardar el poster se renderiza una fase de calentamiento del estudio y sus materiales.

La entrada [`preview-capture.html`](../apps/web/preview-capture.html) es una página separada para desarrollo, accesible en el servidor Vite con `?exercise=squat&model=female` (sin `model`, usa `male`). No está importada por la aplicación ni configurada como entrada del build de producción. La web de producción consume los archivos de `public/previews`; no incluye la página ni el controlador `__exerciseCapture`.

La secuencia de fases y la cámara son deterministas. **No se promete igualdad de píxeles entre distintas GPU, sistemas operativos o versiones de Chromium y los codificadores.** El manifiesto guarda fecha, versiones de Chromium, `cwebp`, `img2webp` y plataforma por ejercicio para conservar la procedencia al regenerar solo una parte. El visor y la captura comparten exposición, tone mapping y tipo de sombras en `anatomy-render-settings.ts`.

## Detectar miniaturas desactualizadas

[`generate-exercise-previews.mjs`](../scripts/generate-exercise-previews.mjs) calcula SHA-256 de las fuentes relevantes: generador, entrada de captura, cámaras, rutas de recursos, escena, modelo, morfología paramétrica, estudio, rig, catálogo y metadata de planificación, geometría, esquemas, GLB, referencias articulares y lockfile. La metadata participa porque determina si la demostración alterna lados. Cada entrada del manifiesto conserva el hash combinado de esas fuentes, los parámetros de captura y el hash de cada archivo generado.

La extracción a paquetes conserva las capturas originales de ejercicios y yoga, incluidos GIF, fecha y hashes originales. Un [registro de procedencia verificable](../packages/model-assets/provenance/README.md) demuestra la equivalencia de las fuentes trasladadas y fija los hashes actuales; cualquier cambio posterior lo invalida y requiere capturar otra vez. Las 24 imágenes de regiones musculares sí se generaron nuevamente con la implementación compartida.

`pnpm previews:check` comprueba **todos los ejercicios en ambos modelos** (74 combinaciones), aunque la última generación haya usado `--exercise` o `--model`. También forma parte de `pnpm check`. Falla si falta una entrada, sus fuentes cambiaron, el modelo o la ruta no corresponden, falta un archivo o su contenido ya no coincide con el hash registrado. No necesita Chromium ni los codificadores porque solo lee archivos.

El hash de fuentes es global: modificar, por ejemplo, una cámara o una pose marca como antiguas las otras entradas también. Regenerar una sola es útil mientras iterás; antes de dar por terminada la actualización, ejecutá:

```sh
pnpm previews:generate --gif
pnpm body-previews:generate
pnpm yoga-previews:generate
pnpm previews:check
pnpm check
pnpm test:e2e
```

Versioná las miniaturas, su manifiesto y los cambios de fuentes juntos. El chequeo valida trazabilidad e integridad; no compara visualmente las poses ni impone que todos los ejercicios tengan el mismo `size` o `fps`.

## Miniaturas de regiones del atlas

`pnpm body-previews:generate` prepara los dos modelos y captura las doce regiones musculares de cada uno. Usa la entrada de desarrollo `body-preview-capture.html?model=female`, el mismo `prepareAnatomy` del visor y una cámara ortográfica ajustada a los vértices visibles. Conserva las cámaras, el lado representativo, los colores y el fondo transparente del atlas. La variante mujer aplica primero la misma transformación paramétrica que el visor; no incorpora un atlas clínico independiente.

Los archivos se guardan en `public/previews/body` y `public/previews/female/body`, con sus propios manifiestos y créditos. Cada entrada registra variante, estructuras, triángulos, límites, cámara, versiones de herramientas y hashes de fuentes y WebP. `pnpm body-previews:check` verifica las 24 imágenes, incluidas dimensiones, selección anatómica y procedencia, sin abrir Chromium. `pnpm previews:check` incluye esta comprobación.

```sh
pnpm body-previews:generate --model female --region pectorals
pnpm body-previews:generate --contact-sheet /tmp/klisteni-body.png
pnpm body-previews:check
```

El segundo comando genera las dos variantes y dos hojas para revisión visual: `/tmp/klisteni-body.png` y `/tmp/klisteni-body-female.png`. Revisá ambas sobre fondo claro y oscuro y a tamaño de tarjeta. El generador rechaza fuentes que cambian durante la captura; si otra iteración modifica el renderer o el modelo, esperá a que se estabilice y repetí la generación. Una interrupción puede dejar un subconjunto actualizado; la comprobación identifica las imágenes pendientes.

## Comportamiento de las tarjetas

- El poster se carga de forma diferida y permanece como base mientras se carga el movimiento.
- En **Mi rutina**, se anima el ejercicio seleccionado. En ambas vistas también se anima la tarjeta al pasar el puntero o recibir foco.
- El movimiento se desmonta cuando la miniatura queda fuera del viewport o se oculta la pestaña. Al volver a activarse, se muestra otra vez el recurso animado; no conserva una fase sincronizada con el visor.
- Tanto **Reducir animaciones** en Ajustes como `prefers-reduced-motion` del sistema dejan solo el poster. Los cambios se aplican sin recargar.
- Si falla el movimiento, queda el poster; si falla el poster, aparece un símbolo discreto de reproducción. Las tarjetas siguen siendo utilizables.
- Al cambiar el modelo corporal, las tarjetas seleccionan sus nuevos recursos inmediatamente y conservan las reglas de movimiento reducido. Un error de carga de una representación no bloquea los recursos de la otra.
- Las imágenes son decorativas para lectores de pantalla: el nombre y la información del ejercicio ya están en el texto de la tarjeta.

## Revisión y recuperación

Después de modificar una pose, el rig, el modelo o una cámara, comprobá el poster y el bucle a tamaño real de tarjeta, tanto en móvil como en escritorio. Revisá extremos, mitad de recorrido, manos, pies y apoyo en suelo, y comparalos con el visor. Probá también hover, foco con teclado y movimiento reducido. Un archivo que carga correctamente puede seguir teniendo un encuadre o una deformación que necesite corregirse.

El generador captura y codifica en `.cache/exercise-previews-*`. Los tres generadores escriben el manifiesto completo en un archivo temporal antes de reemplazar cualquier imagen: si esa escritura falla por falta de espacio, se conservan los archivos publicados y su manifiesto anterior. Después reemplazan los recursos solicitados y, al final, renombran el manifiesto. El conjunto de varias URLs no forma una sola transacción del sistema de archivos: una interrupción entre esos renombrados puede dejar imágenes nuevas con el manifiesto anterior; los hashes detectan esa situación y `--only-stale` vuelve a capturar el ítem. No se actualizan hashes para aceptar archivos incompletos.

Si falla a mitad del catálogo, los ejercicios ya terminados quedan guardados; el resto puede seguir pendiente. El bloque de limpieza cierra procesos y retira temporales cuando el script sale normalmente o maneja un error. Después de un fallo o una interrupción, ejecutá `pnpm previews:check` y regenerá lo que indique; no asumas que todo el catálogo quedó actualizado.

Si falta un codificador, el error identifica su ejecutable. Si Chromium no está instalado, ejecutá su comando de instalación de arriba. La preparación tiene un límite de 90 segundos y cada frame de 30 segundos: si el render no responde, el comando falla y limpia sus recursos. Si WebGL o la escena fallan, resolvé ese problema antes de aceptar imágenes nuevas; no reemplaces una captura fallida por una miniatura de otro ejercicio.

La fidelidad de estas imágenes es **respecto del modelo y las trayectorias implementadas**. Comparte sus límites de deformación educativa: no certifica técnica, activación muscular, contacto físico ni validez clínica. Consultá [fuentes y límites anatómicos](anatomy-model-sources.md) y [criterio educativo](exercise-sources.md).

Las imágenes derivan de Z-Anatomy / BodyParts3D y conservan **CC BY-SA 4.0**, separada de la licencia del código. Los créditos y las adaptaciones están en [`public/previews/NOTICE.md`](../packages/model-assets/public/previews/NOTICE.md).
