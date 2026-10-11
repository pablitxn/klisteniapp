# Roadmap de implementación: marca blanca B2B, sedes, contenido 3D y UI

Actualizado: **11 de octubre de 2026**. Entrega de código: `508e9e1`; evidencia de runtime: `5187b27`. La base histórica del plan era `3fbfe10`.

**Entrega implementada:** el commit `508e9e1`, sobre `d70b2cb`, agrega recuperación/concurrencia de editores, QR con diagnóstico, registro móvil y voz opcional, prescripción por tiempo/RPE, plano 2D y vista estática del espacio, comparación de clips y exploración educativa B2C. Consultar [entrega y verificación de release](b2b-release.md) y [matriz de navegadores](b2b-browser-validation.md). El modelado/autoría Blender se realiza localmente por decisión del usuario. La validación con personas, teléfonos físicos y contenido revisado conserva sus criterios propios; no se confunde con las pruebas automatizadas.

**Próxima prioridad acordada el 11/10/2026:** una aplicación B2B compartida con dominio y experiencia propios por marca, login y permisos por contexto, **varias sedes desde la primera entrega**, diseños configurables, módulos y contenido por marca/sede. El [plan detallado de marca blanca](b2b-white-label.md) define el refactor completo WL-0 a WL-8, migración y aceptación E2E. Esta definición es documental: esas capacidades todavía no están implementadas.

La implementación puede continuar desde otra instancia de Codex en un VPS con la Mac apagada siguiendo el [relevo remoto](development-vps.md). La generación y validación de miniaturas/previews se difieren hasta completar los modelos 3D y los cambios relacionados; los derivados existentes se conservan. Este trabajo diferido no bloquea el cierre de código y runtime.

Este documento ordena el trabajo desde la implementación actual. Separa tres líneas: **producto y código**, **producción de contenido 3D** e **iteración de UI probándola**. Define entregas y dependencias; no compromete fechas. La referencia técnica de lo que ya funciona es [Producto B2B](b2b.md).

## Estado de entrega y continuación entre Mac y VPS

| Estado | Alcance | Evidencia o siguiente acción |
| --- | --- | --- |
| Código implementado y comprobado | E1/E2, matriz automatizada E4 y extensiones de la sección 8; API, miembro y backoffice separados de B2C | [Resultados de la entrega](b2b-release.md) y [matriz B2B](b2b-browser-validation.md) |
| Runtime local de producción comprobado | Imágenes reales, HTTPS, migraciones, permisos, persistencia y restauración de DB/medios; 8/8 grupos | [Informe versionado](validation/b2b-runtime-2026-10-11.json), ejecutado sobre `508e9e1` con árbol limpio |
| Plan nuevo; implementación pendiente | WL-0 a WL-8: dominios, marca, sedes, permisos, temas y módulos | [Especificación y matriz D01–D19](b2b-white-label.md); comenzar por WL-0 y WL-1 |
| Preparado para recibir contenido | Visor y carga de GLB estático, alternativa sin WebGL, validación binaria y hashes | `pnpm equipment:check /ruta/maquina.glb --poster /ruta/maquina.png` |
| Pendiente en Blender local | Máquina real E3, autoría/integración del primer movimiento E5 y segundo caso visual E6 | Elegir máquina y medidas; producir fuentes, recursos y procedencia; revisión humana |
| Pendiente de aceptación física | Piloto con administrador/profesor/socio, voces del dispositivo, Safari/iPhone y QR impreso | Instancia HTTPS accesible y personas que completen el recorrido |
| Diferido por decisión del usuario | Regeneración y revisión completa de previews tras los cambios de modelos | Conservar lo existente; retomar B4 cuando los recursos estén listos |

El código puede continuar en [macOS](development-macos.md) o en el [VPS mediante SSH y tmux](development-vps.md); la autoría Blender conserva su trabajo local. El checkout transporta código, documentación y assets versionados; las bases, credenciales y cachés no forman parte de Git. Antes de apagar la Mac, publicar en Git el checkpoint elegido del setup y esta documentación y verificar su SHA en el VPS: la edición local no los sincroniza automáticamente.

**Límite del cierre:** el smoke local no acredita un despliegue público. `pnpm check`, `check:all`, `check:release` y el job GitLab `quality` mantienen la comprobación completa de previews, pendiente; no se declaran verdes ni se modifica la procedencia para hacerlos pasar. Los resultados de código/runtime se registran por separado. Las tablas históricas y criterios siguientes conservan el alcance original; esta tabla indica el estado actual.

## 1. Punto de partida y decisiones que conservamos

- B2B tiene **backend, PostgreSQL, sesiones y archivos independientes desde el inicio**. Backoffice y app del socio consumen esa API. B2C conserva su aplicación, backend, datos y suscripción autogestionada.
- Compartimos catálogo, modelos, geometría y visores mediante paquetes internos. Cada producto sirve sus recursos; B2B no depende de la API ni del dominio B2C.
- Un modelo de máquina es reutilizable; cada unidad física pertenece a un gimnasio y tiene ubicación, ajustes y QR. Una definición de máquina en el catálogo no implica que exista su modelo 3D.
- El website básico del gimnasio forma parte de la entrega B2B: presentación, actividades, horarios, catálogo público y entrada de socios.
- La prescripción publicada y la ejecución real son registros distintos. Las sustituciones tienen permisos y motivo. Abrir un QR o ver una animación no registra entrenamiento.
- La demo usa el producto real con datos ficticios reiniciables. Los avances de UI se pueden probar con fotos, texto y recursos existentes mientras se producen nuevos modelos.
- La evolución acordada mantiene **organización = empresa/marca**, incorpora **sede = establecimiento** y resuelve la marca desde un dominio verificado antes del login. La ubicación textual de una unidad no representa una sede. Los permisos nuevos se aplican en servidor a marca, sede, rol y recurso; ver el [modelo propuesto](b2b-white-label.md#4-modelo-de-marca-sede-y-permisos).

### Estado de la base revisada, anterior a esta entrega

**Implementado** significa presente en el código; no acredita validación con usuarios, teléfonos reales ni un despliegue público.

| Área | Implementado en esta base | Trabajo siguiente |
| --- | --- | --- |
| Separación B2B/B2C | API y DB propias; contratos, dominio, cliente, hooks y UI en paquetes; control automático de dependencias | Mantener estos límites al agregar capacidades |
| Gimnasio y contenido | Marca, personas, modelos y unidades, biblioteca de archivos, revisión/publicación, website y etiquetas QR | Probar la preparación completa con contenido representativo y corregir fricciones |
| Entrenamiento | Rutinas versionadas, asignaciones, alternativas, series reales, borradores, reintentos e historial comparado | Iterar prescripción y ejecución en móvil, incluyendo errores y recuperación |
| Anatomía y movimientos | Visor compartido, movimientos registrados, recursos y previews; yoga ya existe en B2C | Revisar los movimientos reutilizados y producir los nuevos que requieran máquinas |
| Máquinas 3D | Visor optativo y carga de GLB estático | Crear la primera máquina propia: no hay biblioteca de GLB dedicados de máquinas |
| Pruebas de UI | E2E de recorridos, sesión, borradores, permisos y medios; algunas capturas en ancho móvil | Dispositivos táctiles, otros motores, accesibilidad, comparación visual selectiva y escaneo físico |
| Extensiones | La base no incorpora voz guiada, plano interactivo ni recorrido virtual | Evaluarlas después de cerrar el recorrido principal; el espacio 3D es experimental |

## 2. Orden de entregas

### 2.1. Próxima entrega: marca blanca y varias sedes

Todas estas etapas están **pendientes de implementación**. El [plan detallado](b2b-white-label.md) es la referencia para contratos, permisos, publicación, migraciones, pruebas y rollback; esta tabla fija el orden de trabajo.

| Etapa | Resultado | Dependencia |
| --- | --- | --- |
| **WL-0** | Inventario del código/datos y decisiones concretas de permisos, sedes y compatibilidad | Base actual y definición acordada |
| **WL-1** | Contratos, migraciones y fixtures: Atlas y Sur, dos sedes por marca | WL-0 |
| **WL-2** | Host confiable, registro de dominios y contexto de marca antes del login | WL-1 |
| **WL-3** | Sesiones ligadas a marca y autorización por sede/rol en todas las rutas | WL-2 |
| **WL-4** | Login común, gestión/selección de sedes, destinos por rol e invitaciones/QR | WL-3 |
| **WL-5** | Temas y plantillas, preview, publicación y reversión de identidad y websites | WL-4 |
| **WL-6** | Módulos efectivos, catálogo por sede, traslados y archivo con historial preservado | WL-4 y contratos WL-5 |
| **WL-7** | Operación de DNS/TLS, dominio principal/alias, cambios y diagnóstico | Comienza tras WL-2; integra WL-3 a WL-6 |
| **WL-8** | Matriz E2E D01–D19, migración/restauración y piloto HTTPS | WL-1 a WL-7 |

El primer recorrido vertical de WL-4 ya incluye varias sedes. El cierre completo exige dos marcas con diseños distintos y al menos dos sedes cada una, servidas por el mismo despliegue, con el circuito administrador → entrenador → socio → seguimiento y rechazos de acceso cruzado. Cambiar nombres o colores por URL no cumple esta aceptación.

La siguiente sesión empieza por WL-0 y WL-1 desde el [relevo al VPS](development-vps.md), sin depender de nuevos modelos Blender. Probar cada fase antes de avanzar; los informes de `508e9e1` siguen siendo evidencia de la base anterior, no de estos cambios futuros.

### 2.2. Entregas E1–E6 y aceptación que conservamos

La historia base se conserva durante el refactor: **administrador prepara y publica → profesor prescribe → socio abre rutina/QR y registra → profesor consulta lo realizado**. La tabla siguiente mantiene las entregas originales de producto, contenido y aceptación; su estado está resumido al inicio de este documento.

| Entrega | Trabajo | Depende de | Criterio de cierre |
| --- | --- | --- | --- |
| **E1. Recorrido de referencia** | Elegir un gimnasio ficticio, una máquina con dos unidades y ejercicios base/propios; recorrer los tres roles y registrar problemas reproducibles | Base actual | Historia repetible con datos conocidos y lista concreta de ajustes de UI/código |
| **E2. UI usable de punta a punta** | Resolver esos problemas en preparación, catálogo, prescripción y registro; agregar regresiones de los comportamientos corregidos | E1 | Recorrido completo en escritorio y móvil, con estados de guardado, errores y recuperación claros |
| **E3. Primera máquina 3D estática** | Modelar, exportar, revisar e integrar un recurso real con su imagen de respaldo | Selección de máquina en E1; puede avanzar junto a E2 | Modelo aprobado que carga desde la ficha y el QR sin impedir leer el contenido si falla 3D |
| **E4. Validación integrada del gimnasio** | Revisar contenido, publicación, permisos y QR desde teléfono; probar el circuito completo en una instancia B2B accesible | E2; E3 se integra si está lista | Evidencia de los recorridos y correcciones verificadas; el 3D nuevo no bloquea esta entrega |
| **E5. Primer ejercicio con máquina animada** | Autoría del movimiento, contactos, cámaras, integración y previews | Recurso y revisión de E3; contrato de animación elegido | Movimiento revisado desde varios ángulos y fases, con regresión B2C si cambia el renderer compartido |
| **E6. Ampliación por lotes** | Segundo tipo de máquina/ejercicio; mejoras surgidas del uso; luego extensiones priorizadas | Aprendizajes de E4/E5 según el cambio | Reutilización demostrada en casos distintos, sin introducir dependencias de B2C |

Camino principal: **E1 → E2 → E4**. Producción 3D: **E1 → E3 → E5**. Se integran cuando cada recurso está revisado. El plano del gimnasio y los clips generados tienen su propia evaluación, fuera de estas dependencias.

## 3. Línea A: producto, código y paquetes internos

### A1. Consolidar el recorrido existente

Usar Atlas y Sur para probar aislamiento, con administrador, profesor y socio. Preparar contenido que fuerce casos reales: nombres largos, dos unidades del mismo modelo, un ejercicio propio sin animación, una alternativa autorizada y una ficha sin publicar.

1. Preparar marca, inventario y website desde el backoffice; subir contenido y revisar/publicar.
2. Crear y asignar una rutina desde el profesor. Confirmar que editar el catálogo después no cambia su versión asignada.
3. Abrir la ficha pública de una unidad y entrar como socio. Registrar series en borrador, recargar y guardar una sesión completa. En una sesión distinta, probar el guardado parcial; comprobar también el reintento exacto tras una respuesta perdida. Una ejecución confirmada es inmutable: guardar parcial no habilita continuar editando ese registro.
4. Comparar prescripción y ejecución desde el profesor asignado. Verificar que otro gimnasio y un profesor sin asignación no acceden.
5. Convertir cada bloqueo observado en un cambio pequeño con un caso de reproducción y un criterio de aceptación.

Los lugares de trabajo son [backoffice](../apps/backoffice/src), [features del socio](../apps/member-web/src/features) y [API B2B](../apps/b2b-api/src). El ciclo de prueba visual se detalla en la línea C.

### A2. Extender sin duplicar reglas ni acoplar productos

| Tipo de cambio | Lugar adecuado | Regla |
| --- | --- | --- |
| Forma de una petición/respuesta | [b2b-contracts](../packages/b2b-contracts) | Schema y export público por dominio; conservar compatibilidad o migrarla explícitamente |
| Compatibilidad, prescripción o ejecución | [b2b-domain](../packages/b2b-domain) | Regla pura; autorización efectiva y persistencia siguen en la API |
| Endpoint o persistencia | [b2b-api](../apps/b2b-api) | Aislamiento por organización; migraciones sólo en DB B2B |
| HTTP, cancelación y errores | [b2b-client](../packages/b2b-client) | Sin React; consumidores por su API pública |
| Sesión y cargas React | [b2b-react](../packages/b2b-react) | Preservar cancelación, cambio de cuenta/gimnasio y descarte de respuestas tardías |
| Controles y medios compartidos | [b2b-ui](../packages/b2b-ui) | Presentación con acciones inyectadas; visores opcionales en `/content` |
| Navegación y comportamiento de una pantalla | La feature de cada app | Mantener el flujo local hasta que exista una segunda necesidad compartida |
| Ejercicio educativo reutilizable | [catalog-base](../packages/catalog-base) | ID estable; una adaptación local conserva su procedencia |
| Movimiento, render o recurso visual | [geometry](../packages/geometry), [anatomy-viewer](../packages/anatomy-viewer), [model-assets](../packages/model-assets) | Sin cuentas, organizaciones ni reglas comerciales |

Para una capacidad nueva: contrato → regla de dominio, si corresponde → persistencia/endpoint → cliente → feature → prueba del recorrido. Para un ajuste visual no hace falta modificar todas las capas. Extraer otro paquete cuando tenga una responsabilidad estable y consumidores reales; comprobar exports, dependencias y ciclos con `pnpm check:b2b:boundaries`.

### A3. Condiciones para conservar B2C

- Mantener IDs, rutas de recursos y semántica del catálogo compartido. Las variaciones B2B viven en sus entidades locales.
- Conservar los adaptadores de compatibilidad de B2C mientras existan consumidores. No extraer su store personal, billing o sincronización para resolver una pantalla B2B.
- Un cambio en geometría, catálogo, recursos o visor se valida en ambos productos. Un cambio exclusivamente B2B no requiere migrar datos B2C.
- Publicar versiones y conservar snapshots: los recursos históricos autorizados y la prescripción asignada deben seguir disponibles tras nuevas ediciones.

## 4. Línea B: diseñar y producir contenido 3D

### B1. Una máquina estática completa

**Entrada:** elegir una máquina piloto y reunir fotos, dimensiones, ajustes, nombre y procedencia. Vincularla con el modelo de catálogo y sus unidades físicas. Estos identificadores cumplen funciones distintas del archivo GLB.

**Autoría:** crear la fuente editable en Blender con escala, orientación, origen, partes y materiales consistentes. Revisar silueta, apoyos y ajustes desde frente, lateral y tres cuartos. Preparar una imagen de respaldo y texto que permitan entenderla sin abrir el visor.

**Exportación:** producir un GLB autocontenido compatible con la carga actual: hasta 24 MiB, sin animaciones, skins, extensiones ni recursos externos; texturas internas JPEG/PNG. El máximo de carga no es un objetivo de rendimiento: medir peso, tiempo de apertura y fluidez en el teléfono elegido antes de multiplicar recursos.

**Entrega:** fuente editable, GLB, imagen, medidas/orientación, procedencia y registro de revisión. Ubicaciones propuestas para recursos compartidos: `assets/blender/equipment/<id>.blend` y `packages/model-assets/public/models/equipment/`. Estas carpetas de autoría se crearán con el primer recurso; el validador `equipment:check`, la carga y el visor estático ya existen. No hay un importador general de movimientos Blender; [model-assets](../packages/model-assets/README.md) explica el manifiesto actual.

Para contenido específico del gimnasio usar su biblioteca B2B; para contenido distribuido con el producto usar `model-assets` y servirlo en cada build. Conservar una fuente canónica y versiones identificables, sin mantener copias editables divergentes.

### B2. Integrar y probar la máquina

1. Cargar el GLB de prueba desde el backoffice, asociarlo al modelo/unidad y completar su información.
2. Revisar y publicar los recursos necesarios. Abrir la ficha y el QR con y sin sesión.
3. Comprobar encuadre, giro, imagen de respaldo, carga voluntaria, error de archivo y ausencia de WebGL en móvil y escritorio.
4. Confirmar que fotos e instrucciones siguen disponibles y que los medios privados no se vuelven públicos por conocer su URL.

La integración usa [EquipmentModelViewer](../packages/anatomy-viewer/src/EquipmentModelViewer.tsx) y [ContentMedia](../packages/b2b-ui/src/content/ContentMedia.tsx). Tener esta máquina estática lista cierra E3; todavía no entrega un ejercicio animado.

### B3. Primer movimiento con máquina

Definir primero posición inicial, fases, apoyos, agarres, trayectoria, rango representado y cámaras. Revisar que cuerpo y máquina correspondan con las instrucciones y que manos, pies o asiento no atraviesen la geometría.

La primera opción es registrar un movimiento explícito sobre las poses y el rig existentes en `geometry` y `anatomy-viewer`. Incorporar su ID y entrada en `catalog-base`, ampliar `ExerciseId` en `scene-schema` cuando corresponda y registrar fases y cámara. Un ejercicio nuevo no recibe una animación automáticamente: `animationId` sólo puede apuntar a un movimiento educativo soportado.

Si se elige autoría de clips en Blender, implementar previamente su contrato, manifiesto, carga y reproducción. El taller de yoga actual exporta movimientos del runtime hacia Blender; **no hay un pipeline general Blender → movimiento de la app**. La carga de GLB estático del gimnasio tampoco acepta animaciones.

Revisar frente, lateral y tres cuartos en varias fases, las variantes corporales compatibles, encuadre y movimiento reducido. La revisión técnica/educativa requiere una persona definida; los tests comprueban comportamiento del código y no certifican la técnica del ejercicio. El resaltado anatómico muestra asociaciones educativas, no activación medida del usuario.

### B4. Derivados y reutilización

Generar poster y preview desde el mismo renderer que usa la app cuando el movimiento ya esté integrado. Revisar visualmente los resultados y después verificar procedencia/hashes. Una iteración puede generar sólo el ejercicio trabajado; antes de cerrar, regenerar todos los derivados afectados por cambios compartidos.

Esta fase queda diferida por decisión del usuario mientras los modelos 3D y su integración sigan cambiando. Retomarla sobre los recursos definitivos; no completar ahora un lote de miniaturas que habrá que volver a producir. El cierre del código se documenta por separado y no certifica la procedencia ni la revisión completa del lote actual.

```sh
pnpm previews:generate --exercise squat --model male --gif
pnpm previews:check
pnpm --filter @klisteniapp/geometry test
pnpm --filter @klisteniapp/anatomy-viewer test
pnpm --filter @klisteniapp/model-assets test
```

`squat` es un ejemplo existente, no el comando de una futura máquina. Los requisitos de generación están en [Exercise previews](exercise-previews.md); el atlas y su procedencia en [Anatomy sources](anatomy-model-sources.md), y el taller Blender de yoga en [Yoga](yoga.md). Cambiar hashes para ocultar una diferencia visual no sustituye la revisión del recurso.

Repetir con una segunda máquina distinta antes de generalizar componentes de autoría. Registrar licencia y atribución por recurso: el origen del atlas, los modelos propios y los medios aportados por un gimnasio pueden ser diferentes.

## 5. Línea C: diseñar la UI, implementarla y probarla

### C1. Ciclo de cada iteración

1. **Elegir una tarea:** por ejemplo, publicar una unidad y sus etiquetas, asignar una rutina o registrar una sustitución. Escribir qué debe lograr cada rol y cómo reconocer que terminó.
2. **Bocetar estados:** contenido, jerarquía, acciones, carga, vacío, error, sin permiso, guardado, conflicto y reintento. Usar nombres, fotos e instrucciones representativos desde el primer boceto.
3. **Implementar en la feature existente:** reutilizar controles de `b2b-ui`, contratos y hooks públicos. Conservar borradores, snapshots, cancelación y protección entre sesiones.
4. **Recorrerla en el navegador:** ejecutar la tarea completa con cada rol involucrado y fallos relevantes. Probar teclado/foco, texto largo, ancho móvil y luego un teléfono táctil real.
5. **Registrar y corregir:** guardar capturas cuando aclaren el problema; anotar pasos, resultado esperado y observado. Agregar una regresión cuando el problema sea de comportamiento; usar comparación visual sólo en pantallas y estados estables.
6. **Repetir y cerrar:** una persona debe completar la tarea con los estados visibles de la aplicación. Volver a probar después de cada ajuste que afecte el recorrido.

La UI puede iterar con un GLB de prueba o con fotos. El recurso 3D definitivo se incorpora en B2; luego se repite el recorrido que lo consume.

### C2. Matriz mínima de recorridos

| Usuario o situación | Prueba | Resultado esperado |
| --- | --- | --- |
| Administrador | Preparar marca, contenido, dos unidades, website y etiquetas | Publicación explícita, fichas correctas y QR por unidad |
| Profesor | Crear/asignar rutina, cambiar después el ejercicio y consultar ejecución | Prescripción asignada estable; acceso sólo a socios autorizados |
| Socio | Abrir rutina/QR, sustituir, recuperar borrador tras recarga y guardar; probar parcial/completa en sesiones distintas | Contexto conservado y ejecución real separada de la prescripción; registros confirmados inmutables |
| Visitante | Website y QR de una unidad publicada/retirada | Sólo contenido público disponible; ninguna actividad personal |
| Red interrumpida | Perder respuesta de guardado y reintentar | Estado comprensible y una sola ejecución persistida |
| Edición concurrente | Guardar sobre una revisión anterior | Conflicto visible y borrador recuperable |
| Cambio de acceso | Cambiar cuenta/gimnasio, revocar membresía o suspender servicio | Sin datos residuales ni respuestas tardías de otra sesión |
| Dispositivo limitado | Móvil, teclado, movimiento reducido, WebGL fallido | Acciones accesibles; lectura y registro funcionan con el contenido de respaldo |

La configuración [Playwright B2B](../apps/web/playwright.b2b.config.ts) ejecuta proyectos de Chromium escritorio, Chromium táctil y WebKit táctil, cada uno con schema de PostgreSQL, API y origen independientes. La matriz recorre publicación/QR, registro, recuperación, permisos y fallos, y compara unas pocas pantallas estables. La emulación de WebKit no demuestra funcionamiento en Safari de un teléfono real ni escaneo con cámara; esos pasos de E4 siguen siendo físicos.

### C3. Entorno de trabajo y QR físico

Para todas las aplicaciones usar el [setup unificado desde el root](development.md): `pnpm setup:dev` una vez, `docker compose up` en una terminal y `pnpm exec turbo run dev` en otra. Ese entorno guarda sus cuentas privadas en `.cache/dev/` y usa bases separadas para B2C y B2B. Puede ejecutarse en Mac o en el VPS con [túnel privado](development-vps.md#4-abrir-las-webs-desde-otro-dispositivo).

El helper dedicado anterior sigue disponible para trabajar sólo B2B; no ejecutarlo a la vez que el entorno unificado porque comparten puertos:

```sh
pnpm dev:b2b
```

Abrir `http://127.0.0.1:4200/backoffice/`, `http://127.0.0.1:4200/app` y `http://127.0.0.1:4200/g/atlas-demo`. Usar las cuentas ficticias de `.cache/b2b/demo.private.json` y la contraseña del env privado generado; no incorporarlas a capturas ni commits.

El entorno, dependencias y preparación de DB están en [Demo local B2B](b2b.md#demo-local). La guía [UI iteration](ui-iteration.md) corresponde a B2C y tiene otro lanzador.

Para probar un QR impreso desde un teléfono, preparar una instancia B2B de prueba con origen HTTPS accesible desde ese teléfono según [Instancia independiente](b2b.md#instancia-independiente). Los QR de `127.0.0.1` apuntan al propio teléfono. Verificar el origen antes de imprimir; esta prueba no requiere cambiar ni desplegar B2C.

## 6. Estado de los cambios concretos

La entrega `508e9e1` implementa los tres primeros pasos de esta tabla y deja preparada la integración de recursos estáticos. La [guía de release](b2b-release.md) reúne alcance, comandos y evidencia; el contenido producido en Blender conserva su aceptación propia. Los nuevos cambios de marca blanca y sedes se siguen por WL-0 a WL-8 y permanecen pendientes.

| Orden | Estado del código | Archivos o áreas | Aceptación que permanece separada |
| --- | --- | --- | --- |
| **1** | Escenario Atlas/Sur ampliado; recuperación y conflictos de editores, publicación explícita y diagnóstico por unidad antes de imprimir QR | `apps/backoffice/src`, `b2b-ui`, E2E B2B | Preparación y publicación por una persona del gimnasio piloto |
| **2** | Registro móvil, etiquetas de series, recuperación, parcial definitivo, reintento exacto, duración y RPE; historial contra snapshot asignado | `apps/member-web/src/features`, contratos/dominio/API y E2E B2B | Completar el circuito con un socio en su teléfono |
| **3** | Matriz Chromium escritorio/táctil y WebKit táctil, aislamiento por proyecto y seis capturas estables revisadas | `apps/web/playwright.b2b.config.ts`, E2E y snapshots | Safari/iOS físico y escaneo de una etiqueta impresa sobre HTTPS accesible |
| **Blender local** | Visor estático y carga protegida comprobados con GLB técnico; error recuperable, carga voluntaria y alternativa sin WebGL; CLI `equipment:check` | `anatomy-viewer`, `b2b-ui`, biblioteca B2B y `scripts/validate-equipment.mjs` | Producir y revisar máquina, poster, instrucciones y procedencia de E3 |
| **Con el recurso revisado** | Se conserva el registro explícito de movimientos soportados y la generación de derivados; no se inventa un movimiento de máquina ni un importador de clips Blender | `geometry`, `anatomy-viewer`, `catalog-base`, `model-assets` | Autoría, integración y revisión del movimiento E5 y segundo caso visual E6 |
| **Previews diferidos** | Generadores y recursos existentes conservados; el lote completo no se declara regenerado ni validado | Derivados de ejercicios, anatomía y yoga en `model-assets` | Retomar generación, revisión y procedencia después de terminar los modelos y cambios relacionados, por decisión del usuario |

## 7. Validación para cerrar cada entrega

Para cambios de código B2B, desde la raíz:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build:b2b
# Configurar antes B2B_TEST_DATABASE_URL con PostgreSQL de prueba desechable:
pnpm test:b2b:api
pnpm test:b2b:e2e
```

`lint` incluye `check:b2b:boundaries`. La integración API omitida por falta de DB no cuenta como validación. El entorno y aislamiento de las suites están documentados en [Producto B2B](b2b.md); nunca usar una base real para tests o resets.

Si cambian paquetes usados por B2C, agregar su build y recorridos afectados; para catálogo, geometría o visores, revisar también previews y regresión visual B2C. `pnpm check` reúne lint, tipos, tests, procedencia de previews y builds; `pnpm test:e2e` ejecuta los recorridos B2C. Si sólo cambia documentación, comprobar enlaces, referencias y `git diff --check`.

Para el cierre actual, la excepción solicitada por el usuario difiere sólo la generación y validación de previews. Las comprobaciones de código, integración, builds, publicación y runtime se ejecutan y registran por separado. No se afirma que `pnpm check` o `pnpm check:release` completos hayan aprobado mientras su fase de previews siga pendiente.

Cada entrega registra qué cambió, qué se probó, con qué roles/dispositivos y qué quedó pendiente. Para E4, incluir escaneo físico y tareas completas en móvil. Para E3/E5, incluir vistas del recurso y revisión del contenido, además de los checks de código.

Para WL, agregar los casos aplicables de la [matriz D01–D19](b2b-white-label.md#8-matriz-de-aceptación-de-punta-a-punta): dos dominios reales de prueba contra el mismo despliegue, dos sedes por marca, aislamiento de sesión/API/medios, publicación, módulos, migración y restauración. Las suites actuales de un origen no certifican ese comportamiento. Registrar el nuevo comando cuando exista; no dar por implementada la suite al escribir el plan.

## 8. Capacidades adicionales de esta entrega

El pedido de implementar el roadmap incorpora también estas extensiones de código. Su disponibilidad no sustituye la revisión de contenido ni la evaluación del piloto.

| Línea | Implementación | Condición para su aceptación en uso |
| --- | --- | --- |
| Gimnasios | Prescripción por repeticiones o duración, RPE objetivo y declarado; snapshots históricos y registro real separados | Validar dosis y contenido con el profesor; no se infieren objetivos ni esfuerzo del usuario |
| Entradas públicas | Entrada B2B en `/` y `/gimnasios`, website en `/g/:slug`, acceso de socio y equipo; B2C conserva su aplicación independiente | Configurar los orígenes y el acceso del piloto |
| B2C | Búsqueda de anatomía/yoga y enlaces de elongación/movilidad por región a contenido existente | Revisar pertinencia editorial; la consulta no registra práctica ni cambia la rutina |
| Voz guiada | Lectura voluntaria, pausa/reanudación/detención, indicación de lado si existe en el texto y temporizador de descanso | Probar voces y audio del dispositivo; instrucciones y controles escritos siguen disponibles |
| Espacio del gimnasio | Galería, plano con puntos y enlaces de unidades, lista accesible y GLB estático opcional de un sector | Producir plano/modelo y comprobar que ayuda a orientarse; medir el recurso en el teléfono |
| Clips audiovisuales | Comparación de dos videos autorizados, procedencia, evaluación humana y exportación con IDs/hashes; copia por cuenta/gimnasio | Aportar clip de referencia y generado, permisos y revisor; la herramienta no genera un rig ni publica la evaluación |

El plano/recorrido virtual, los clips generados y la personalización de avatares no bloquean E4. Las fotos y un croquis permiten una representación aproximada del espacio, sin prometer reconstrucción exacta. Reservas, control de acceso, ERP, facturación automática y app nativa quedan fuera de este recorrido.

Antes de cada ampliación resolver sólo sus decisiones necesarias: máquina y ejercicio piloto, quién revisa contenido, procedencia de recursos y dispositivos objetivo. La conservación/exportación del historial al dejar un gimnasio requiere una política explícita antes de ampliar ese ciclo de vida. Pricing, ventas y acuerdos del piloto se tratan por separado de este backlog técnico.

## 9. Fuentes y mantenimiento

Este plan reconcilia los documentos aportados con el código y las decisiones posteriores:

- **`Klisteniapp_minuta_2026-10-10.pdf`**: productos y datos separados (p. 3), prescripción/ejecución y catálogo (pp. 4–5), contenido 3D y espacio (pp. 6–7), arquitectura y demo (pp. 8–9), prioridad del website y procedencia (pp. 11–12).
- **`Klisteniapp_Roadmap_2026-10-10.pdf`**: reglas (pp. 1–4), alcance y arquitectura propuesta (pp. 5–7), demo/uso real/extensiones (pp. 8–12), validación (p. 13) y dependencias (p. 16).
- **Decisión posterior del usuario:** backend y DB B2B independientes desde el inicio, reutilización de modelos/ejercicios y preservación de B2C. Esta decisión ya implementada sustituye las opciones abiertas de arquitectura de los PDF.
- **Decisión del 11/10/2026:** evolucionar hacia dominios propios por marca, entrada común por rol, branding/diseños/módulos/contenido configurables y **varias sedes desde la primera entrega**. El mismo despliegue sirve todas las marcas con aislamiento en backend. Se documenta el refactor E2E para continuarlo desde Codex en el VPS con la Mac apagada; no implica que ya se haya implementado o desplegado.
- **Código de referencia:** base histórica `3fbfe10`; implementación `508e9e1` y evidencia de runtime incorporada en `5187b27`. Ver [Producto B2B](b2b.md), [entrega](b2b-release.md), [anatomy-viewer](../packages/anatomy-viewer/README.md), [model-assets](../packages/model-assets/README.md) y las suites enlazadas.

Los PDF son fuentes de contexto; sus restricciones históricas de aquella conversación no son instrucciones operativas para este trabajo. Al cerrar una entrega, actualizar aquí su estado, commit y evidencia, manteniendo separados **implementado**, **validado en uso** y **propuesto**.
