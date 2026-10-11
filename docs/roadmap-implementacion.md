# Roadmap de implementación: B2B, contenido 3D y UI

Actualizado: **11 de octubre de 2026**. Base de código revisada: `3fbfe10`.

Este documento ordena el trabajo desde la implementación actual. Separa tres líneas: **producto y código**, **producción de contenido 3D** e **iteración de UI probándola**. Define entregas y dependencias; no compromete fechas. La referencia técnica de lo que ya funciona es [Producto B2B](b2b.md).

## 1. Punto de partida y decisiones que conservamos

- B2B tiene **backend, PostgreSQL, sesiones y archivos independientes desde el inicio**. Backoffice y app del socio consumen esa API. B2C conserva su aplicación, backend, datos y suscripción autogestionada.
- Compartimos catálogo, modelos, geometría y visores mediante paquetes internos. Cada producto sirve sus recursos; B2B no depende de la API ni del dominio B2C.
- Un modelo de máquina es reutilizable; cada unidad física pertenece a un gimnasio y tiene ubicación, ajustes y QR. Una definición de máquina en el catálogo no implica que exista su modelo 3D.
- El website básico del gimnasio forma parte de la entrega B2B: presentación, actividades, horarios, catálogo público y entrada de socios.
- La prescripción publicada y la ejecución real son registros distintos. Las sustituciones tienen permisos y motivo. Abrir un QR o ver una animación no registra entrenamiento.
- La demo usa el producto real con datos ficticios reiniciables. Los avances de UI se pueden probar con fotos, texto y recursos existentes mientras se producen nuevos modelos.

### Estado real

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

El objetivo inmediato es completar y probar esta historia: **administrador prepara y publica → profesor prescribe → socio abre rutina/QR y registra → profesor consulta lo realizado**.

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

**Entrega:** fuente editable, GLB, imagen, medidas/orientación, procedencia y registro de revisión. Ubicaciones propuestas para recursos compartidos: `assets/blender/equipment/<id>.blend` y `packages/model-assets/public/models/equipment/`. Estas carpetas y el pipeline de máquinas están por crear; [model-assets](../packages/model-assets/README.md) explica el manifiesto actual.

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

```sh
pnpm previews:generate --exercise squat --model male
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

La configuración [Playwright B2B](../apps/web/playwright.b2b.config.ts) actual utiliza Chromium de escritorio. Algunos casos cambian el viewport, pero faltan proyectos táctiles/WebKit y comparación visual automatizada. Incorporarlos gradualmente, empezando por publicación/QR y registro de sesión. Un viewport de 390 px no demuestra funcionamiento en Safari ni escaneo con cámara.

### C3. Entorno de trabajo y QR físico

```sh
pnpm dev:b2b
```

Abrir `http://127.0.0.1:4200/backoffice/`, `http://127.0.0.1:4200/app` y `http://127.0.0.1:4200/g/atlas-demo`. Usar las cuentas ficticias de `.cache/b2b/demo.private.json` y la contraseña del env privado generado; no incorporarlas a capturas ni commits.

El entorno, dependencias y preparación de DB están en [Demo local B2B](b2b.md#demo-local). La guía [UI iteration](ui-iteration.md) corresponde a B2C y tiene otro lanzador.

Para probar un QR impreso desde un teléfono, preparar una instancia B2B de prueba con origen HTTPS accesible desde ese teléfono según [Instancia independiente](b2b.md#instancia-independiente). Los QR de `127.0.0.1` apuntan al propio teléfono. Verificar el origen antes de imprimir; esta prueba no requiere cambiar ni desplegar B2C.

## 6. Próximos cambios concretos

Este es el orden recomendado para retomar el código. Cada fila es una entrega pequeña revisable; producción de assets puede avanzar en paralelo.

| Orden | Cambio propuesto | Archivos o áreas | Evidencia de cierre |
| --- | --- | --- | --- |
| **1** | Completar E1 y corregir la primera fricción del administrador al preparar/publicar contenido | `apps/backoffice/src`, controles de `b2b-ui`, `apps/web/e2e/b2b*.spec.ts` | Caso reproducible resuelto; publicación y QR siguen coherentes |
| **2** | Iterar el recorrido móvil del socio: rutina → unidad → series → guardado/reintento | `apps/member-web/src/features`, `b2b-ui`, E2E B2B | Prueba táctil y de teclado; borrador y reintento conservados |
| **3** | Ampliar la matriz Playwright con dispositivo táctil y WebKit; proteger unas pocas pantallas estables | `apps/web/playwright.b2b.config.ts`, E2E y capturas seleccionadas | Recorridos elegidos pasan en los motores configurados; revisión de diferencias visuales |
| **En paralelo** | Producir y publicar una máquina estática con sus instrucciones, procedencia e imagen | Fuente Blender propuesta, biblioteca B2B o `model-assets` según distribución | E3 y pruebas de B2; contenido utilizable sin 3D |
| **Después** | Integrar un movimiento con esa máquina; extraer abstracciones sólo al validar el segundo caso | `geometry`, `anatomy-viewer`, `catalog-base`, `model-assets` | E5, previews revisados y regresión B2C |

Los primeros ajustes visuales se eligen al recorrer la interfaz; esta tabla no afirma que exista un defecto específico todavía no reproducido.

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

Cada entrega registra qué cambió, qué se probó, con qué roles/dispositivos y qué quedó pendiente. Para E4, incluir escaneo físico y tareas completas en móvil. Para E3/E5, incluir vistas del recurso y revisión del contenido, además de los checks de código.

## 8. Después del recorrido principal

| Línea | Próximo alcance posible | Condición antes de implementarlo |
| --- | --- | --- |
| Gimnasios | Ampliar catálogo y tipos de prescripción según ejercicios reales | Hoy se modelan series/repeticiones/carga/descanso/notas; definir contrato y registro antes de añadir duración, intensidad u objetivos estructurados |
| Entradas públicas | Diferenciar presentación B2B, B2C y website del gimnasio | Mantener rutas y experiencias independientes; el website básico ya existe |
| B2C | Elongación contextual y enciclopedia sobre anatomía/yoga existentes | Caso de uso definido y revisión del contenido; preservar entrenamiento autogestionado |
| Voz guiada | TTS con pausa, reanudación, cambio de lado y tiempos reales | Después del piloto; controles y alternativa sin audio definidos |
| Espacio del gimnasio | Galería → plano 2D vinculado a unidades → un sector 3D | Probar primero si mejora orientación/presentación; medir costo y rendimiento antes de ampliar |
| Clips audiovisuales | Comparar un clip autorizado y uno generado para un ejercicio | Permisos de uso y evaluación de fidelidad; no asumir que un video produce un rig o movimiento editable |

El plano/recorrido virtual, los clips generados y la personalización de avatares no bloquean E4. Las fotos y un croquis permiten una representación aproximada del espacio, sin prometer reconstrucción exacta. Reservas, control de acceso, ERP, facturación automática y app nativa quedan fuera de este recorrido.

Antes de cada ampliación resolver sólo sus decisiones necesarias: máquina y ejercicio piloto, quién revisa contenido, procedencia de recursos y dispositivos objetivo. La conservación/exportación del historial al dejar un gimnasio requiere una política explícita antes de ampliar ese ciclo de vida. Pricing, ventas y acuerdos del piloto se tratan por separado de este backlog técnico.

## 9. Fuentes y mantenimiento

Este plan reconcilia los documentos aportados con el código y las decisiones posteriores:

- **`Klisteniapp_minuta_2026-10-10.pdf`**: productos y datos separados (p. 3), prescripción/ejecución y catálogo (pp. 4–5), contenido 3D y espacio (pp. 6–7), arquitectura y demo (pp. 8–9), prioridad del website y procedencia (pp. 11–12).
- **`Klisteniapp_Roadmap_2026-10-10.pdf`**: reglas (pp. 1–4), alcance y arquitectura propuesta (pp. 5–7), demo/uso real/extensiones (pp. 8–12), validación (p. 13) y dependencias (p. 16).
- **Decisión posterior del usuario:** backend y DB B2B independientes desde el inicio, reutilización de modelos/ejercicios y preservación de B2C. Esta decisión ya implementada sustituye las opciones abiertas de arquitectura de los PDF.
- **Código de referencia:** `3fbfe10`, [Producto B2B](b2b.md), [anatomy-viewer](../packages/anatomy-viewer/README.md), [model-assets](../packages/model-assets/README.md) y las suites enlazadas.

Los PDF son fuentes de contexto; sus restricciones históricas de aquella conversación no son instrucciones operativas para este trabajo. Al cerrar una entrega, actualizar aquí su estado, commit y evidencia, manteniendo separados **implementado**, **validado en uso** y **propuesto**.
