# Entrega del roadmap y validación de release

Implementación del 11 de octubre de 2026, commit `508e9e1`, sobre `d70b2cb`. El modelado y la autoría de recursos 3D quedan a cargo del usuario en Blender. Esta entrega distingue código comprobado, contenido por producir y aceptación en dispositivos reales.

La continuación desde `main` está descrita en [el relevo a macOS](development-macos.md); el [roadmap](roadmap-implementacion.md) separa trabajo terminado y aceptación pendiente. El informe de runtime se incorporó en `5187b27` y mantiene `508e9e1` como revisión del código realmente ejecutado.

**Alcance actualizado por decisión del usuario:** se difieren la regeneración de miniaturas/previews y su validación completa hasta terminar los modelos 3D y los cambios relacionados. Se conservan los derivados existentes. Este trabajo de contenido no bloquea el cierre de código, builds, auditoría de publicación y runtime; tampoco se afirma que el catálogo completo de previews esté regenerado o validado.

El job GitLab `quality` mantiene `pnpm previews:check` como requisito; no se lo ha desactivado ni se declara CI completamente verde. Lo mismo aplica a `check`, `check:all` y `check:release`. La integración en `main` conserva este pendiente explícito y no activa un despliegue automático.

## Recorrido de referencia

Atlas y Sur mantienen bases lógicas de organización aisladas dentro de la DB B2B. Cada demo tiene administrador, profesor asignado, profesor sin socios y socio; dos unidades de polea (una con nombre largo), un ejercicio propio sin animación, una alternativa autorizada y un borrador privado. Las pruebas recorren preparación, publicación, QR, prescripción, ejecución y seguimiento.

| Entrega | Implementación | Aceptación externa |
| --- | --- | --- |
| E1 | Fixtures reiniciables y regresiones de los tres roles, aislamiento y profesor sin asignación | Confirmar que el gimnasio piloto representa el uso real |
| E2 | Recuperación y conflictos de equipamiento/website; motivos de bloqueo de QR; sesión accesible en móvil; estados de borrador, parcial definitivo y reintento exacto | Completar las tareas con una persona usuaria |
| E3 / B2 | GLB estático protegido, apertura voluntaria, recuperación de error, alternativa sin WebGL y validador local con hashes | Crear y revisar máquina, poster, procedencia y medidas en Blender |
| E4 | Matriz automatizada Chromium escritorio, Chromium táctil y WebKit táctil, con PostgreSQL independiente por proyecto | Instancia HTTPS accesible, teléfono real y escaneo de las etiquetas impresas |
| E5 | Se conserva el registro explícito de movimientos soportados y su renderer compartido; las fichas sin animación siguen funcionando | Autoría y revisión de un movimiento con máquina; la carga estática no importa clips de Blender |
| E6 | Segundo caso cubierto mediante equipos propios, adaptaciones y planes por tiempo; paquetes sin dependencia de datos B2C | Producir y revisar el segundo recurso/ejercicio de máquina para demostrar reutilización visual |

No se certifica técnica, biomecánica, voz del sistema operativo ni rendimiento de teléfonos reales mediante estas pruebas. La aceptación humana de E3/E4/E5 no se reemplaza marcando casillas en el roadmap.

## Capacidades adicionales

- **Prescripción por tiempo y esfuerzo:** cada movimiento elige repeticiones o segundos. El RPE objetivo es opcional (1–10). La ejecución conserva sus segundos/repeticiones y RPE declarado por separado. Un registro completo exige todas las series con una cantidad positiva, no alcanzar exactamente la dosis prescrita. Las series deben conservar la unidad de la versión asignada. Los snapshots anteriores se decodifican con observaciones nuevas en `null`, sin reescribirlos; los reintentos anteriores se normalizan antes de compararlos.
- **Entrada pública:** `/` y `/gimnasios` presentan B2B y permiten abrir el código del gimnasio; `/g/:slug` sigue siendo su website, `/app` el espacio del socio y `/backoffice/` el equipo. No se consulta la sesión desde la entrada pública ni se expone un directorio de organizaciones. B2C sigue siendo su propio build/origen.
- **Orientación:** galería, plano con coordenadas porcentuales y enlaces a unidades. Los puntos privados o retirados no aparecen en el plano público, aunque estuvieran en una publicación anterior. La lista textual funciona con teclado y si falla la imagen. Se puede asociar un GLB estático opcional de un sector; su autoría queda fuera del código.
- **Voz y descanso:** lectura voluntaria de las instrucciones existentes, pausa, reanudación y detención. El cambio de lado sólo aparece cuando el contenido lo indica. Los descansos usan tiempo transcurrido, toleran pestañas en segundo plano y nunca marcan series. Las voces dependen del navegador/dispositivo; siempre quedan las instrucciones escritas. [Interfaz SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis).
- **B2C educativo:** búsqueda conjunta de anatomía y yoga y enlaces contextuales de movilidad a fichas existentes. Conserva fuentes e instrucciones; consultar una ficha no guarda práctica ni cambia rutinas. El reloj visual de yoga conserva la velocidad elegida con frames lentos, excluye las pausas y vuelve a contar desde el reinicio o cambio de postura; sigue separado del tiempo de práctica registrado.
- **Comparación audiovisual:** selección de dos videos de la biblioteca autorizada, procedencia y permisos declarados, evaluación humana y exportación JSON con identificadores y hashes. El borrador se aísla por cuenta y gimnasio en la pestaña. La evaluación no publica contenido; cambiar un clip invalida la aprobación. La comparación real requiere aportar los dos clips y un revisor.

Los archivos, sesiones, esquemas y acceso B2B siguen separados de B2C. No se amplía el acceso después de revocar una membresía: la política de conservación y exportación al abandonar el gimnasio sigue requiriendo una decisión explícita. Reservas, ERP, cobro automático y app nativa permanecen fuera del alcance definido por el roadmap.

## Verificación reproducible

Instalar dependencias con el lockfile, Chromium y WebKit, y las dependencias de WebKit de la plataforma. Los proyectos del navegador usan dispositivos configurados, eventos táctiles, teclado y movimiento reducido. Esa emulación no equivale a Safari instalado en un iPhone. [Emulación en Playwright](https://playwright.dev/docs/emulation), [comparaciones visuales](https://playwright.dev/docs/test-snapshots).

```sh
pnpm install --frozen-lockfile
pnpm --filter @klisteniapp/web exec playwright install --with-deps chromium webkit

# URLs distintas de PostgreSQL desechable en un env privado:
# TEST_DATABASE_URL y B2B_TEST_DATABASE_URL
node --env-file=/ruta/privada/verification.env --run check:release
```

`check:release` detiene la ejecución si faltan las bases de prueba o si ambas apuntan a la misma base. Ejecuta en serie lint, tipos, tests, procedencia, builds, integración B2C/B2B y sus recorridos de navegador, incluidas preferencias de privacidad. Deshabilita los reintentos automáticos de navegador también en CI. La primera fase no usa bases; las fases posteriores exigen y usan PostgreSQL. No despliega ni cambia bases reales. `pnpm check:release --list` muestra los comandos.

Ese comando conserva el control completo de previews para cuando se retome el contenido. En el cierre actual se ejecutan por separado las comprobaciones de código y runtime, omitiendo únicamente la regeneración y validación diferidas de previews. Sus resultados no se presentan como una ejecución completa de `pnpm check` o `pnpm check:release`.

Para trabajar sólo B2B: `pnpm build:b2b`, `pnpm test:b2b:api` y `pnpm test:b2b:e2e` con la variable de test preparada. Los resultados y trazas locales quedan en `.cache/b2b/`; las seis imágenes estables de comparación se versionan bajo `apps/web/e2e/snapshots/b2b/`. Regenerar baselines sólo después de revisar visualmente los cambios. La CI mantiene su ejecución pesada optativa y publica el reporte cuando se ejecuta la matriz.

El [smoke de producción](b2b-runtime-validation.md) construye las imágenes reales y comprueba sesiones HTTPS, procesos sin root, base con permisos limitados, publicación, reinicio y restauración en una instancia desechable independiente. Su [evidencia del 11 de octubre](validation/b2b-runtime-2026-10-11.json) registra imágenes, resultados y limpieza. `/readyz` verifica también el estado de autenticación: si la API arrancó antes de migrar, conserva el estado no disponible hasta reiniciarla. El orden operativo es migrar y después arrancar/recrear la API.

## Estado de verificación al 11 de octubre de 2026

Resultados contrastados con los cierres de los logs locales y el índice `.cache/roadmap-verification-progress.json`. Las comprobaciones finales de código, builds y publicación aprobaron; las ejecuciones de API y navegador indicadas conservan su evidencia independiente. El smoke final aprobó los ocho grupos sobre el commit `508e9e1`, con el árbol de trabajo limpio. Los logs permanecen locales bajo `.cache/`.

| Comprobación | Resultado confirmado | Log local |
| --- | --- | --- |
| Lint, tipos y tests por paquete | 45/45 tareas aprobadas; 26 reutilizadas desde caché | `roadmap-final-code.log` |
| Tests de las aplicaciones | Web 196/196, backoffice 22/22 y socio 24/24 aprobados | `roadmap-final-code.log` |
| Límites entre paquetes B2B y formato | Ambos aprobados | `roadmap-final-boundaries.log`, `roadmap-final-format.log` |
| Builds y sus dependencias de tipos | 18/18 tareas aprobadas; 15 desde caché y los tres frontends construidos nuevamente | `roadmap-final-build.log` |
| Auditoría de publicación, incluido el build demo | `ok: true`, sin hallazgos | `roadmap-final-publication-fixed.log` |
| Matriz B2B: Chromium escritorio/táctil y WebKit táctil | 84/84 aprobados | `roadmap-b2b-matrix-verified.log` |
| Regresiones posteriores de visores B2B: dos casos en tres proyectos | 6/6 aprobados | `roadmap-b2b-viewer-final.log` |
| API B2C con PostgreSQL | 97/97 aprobados; ninguno omitido | `roadmap-b2c-api-final.log` |
| API B2B con PostgreSQL | 41/41 aprobados; ninguno omitido | `roadmap-b2b-api-final.log` |
| Navegador: cuentas B2C | 31/31 aprobados | `roadmap-accounts-browser-final.log` |
| Navegador: analytics y privacidad | 16/16 aprobados | `roadmap-analytics-browser-final.log` |
| Navegador B2C: corrida inicial | 79 aprobados y 4 fallidos, de 83 | `roadmap-b2c-browser-final.log` |
| Retest de yoga después de las correcciones | 11/11 aprobados | `roadmap-yoga-browser-final.log` |
| Retest del atlas móvil: los 37 ejercicios en un recorrido | 1/1 aprobado | `roadmap-anatomy-catalog-final.log` |
| Tests de scripts de raíz | 17/17 aprobados; ninguno omitido | `roadmap-final-scripts.log` |
| Runtime de producción sobre `508e9e1` | 8/8 grupos aprobados; reinicio, restauración independiente y limpieza completos | [Reporte sanitizado](validation/b2b-runtime-2026-10-11.json) |

La fase unitaria se ejecutó sin `TEST_DATABASE_URL` ni `B2B_TEST_DATABASE_URL`; las suites de integración omitidas en esa fase no cuentan como cobertura API. La evidencia de integración es la ejecución independiente con PostgreSQL de 97 casos B2C y 41 B2B indicada en la tabla. El build B2C usó `VITE_APP_MODE=demo`.

La auditoría final inspeccionó 570 archivos de texto, 2 `.blend`, 2 `.glb`, 9 PNG, 603 WebP y 152 GIF. Tres credenciales sintéticas de fixtures se permiten exclusivamente mediante hashes exactos y ubicaciones previstas; los tests del auditor cubren también valores y ubicaciones no autorizados. Su `--self-test` aprobó **66/66 casos**, incluidos nueve nuevos, y su lint aprobó. Esta revisión de texto y metadatos no certifica el contenido visual ni reemplaza la validación de previews diferida.

Los cuatro fallos de la corrida B2C inicial corresponden al recorrido móvil del atlas y a tres casos de yoga: reproducción/pausa/seek, velocidad y suspensión, y movimiento reducido sin alterar el registro de práctica. Tras corregir el reloj visual y ajustar la sincronización y los límites de espera de las pruebas con render lento, esos casos quedaron cubiertos por los retestes de yoga y atlas indicados. **No hubo una nueva corrida monolítica de 83 casos aprobados**, ni deben sumarse los retestes como si fueran casos independientes.

Las comprobaciones de código, publicación y runtime de la tabla finalizaron. El smoke ejecutó los artefactos de `508e9e1` entre las **10:45:59 y 10:47:39 UTC**, con `workingTreeChanges: false`, restauración independiente y `cleanupComplete: true`; no se ejecutaron `pnpm check` ni `pnpm check:release` completos porque incluyen la validación de previews diferida.

La generación completa, revisión visual, procedencia y regresiones específicas de las **162 variantes de previews** (74 de ejercicios, 24 de anatomía y 64 de yoga) quedan diferidas por decisión del usuario. Al retomar, generar los derivados afectados desde los modelos y renderer definitivos, conservar GIF y parámetros canónicos y ejecutar `pnpm previews:check`. El lote parcial existente no acredita las 162 variantes ni bloquea las comprobaciones de código actuales.

La generación se detuvo a las **10:36 UTC**: se conservan 74 variantes nuevas de ejercicios, 24 de anatomía y 17 de yoga, **115 en total**. Las otras 47 de yoga mantienen sus recursos anteriores; la revisión visual nueva de yoga llegó a 16 variantes. Los checks de ejercicios y anatomía habían aprobado sus 74 y 24 variantes, respectivamente. El ítem interrumpido conservó sus archivos y entrada anteriores, sin publicación parcial. El estado local de la detención está en `.cache/preview-review/stopped-state.json`; no equivale a un `pnpm previews:check` global aprobado.

La evidencia de runtime enlazada arriba corresponde a las imágenes construidas desde la revisión limpia `508e9e1`, con los últimos cambios de código y los recursos conservados. El modelado Blender, la revisión humana del contenido y clips, el teléfono/QR físico y el despliegue público conservan la aceptación externa descrita en esta guía.

## Entrega desde Blender

```sh
pnpm equipment:check /ruta/polea-v1.glb --poster /ruta/polea-v1.png
```

El comando usa el mismo validador binario que producción y devuelve tamaño y SHA-256. Acepta GLB 2.0 autocontenido, sin animaciones, skins, extensiones ni recursos externos, hasta 24 MiB; no modifica archivos ni certifica el modelo. Para un recurso compartido, conservar fuente editable en `assets/blender/equipment/<id>.blend`, exportación versionada en `packages/model-assets/public/models/equipment/` y licencia/procedencia junto al recurso. Para un recurso local del gimnasio, subir modelo e imagen a su biblioteca y publicarlos desde la ficha revisada.

Antes de publicar contenido: revisar escala/orientación, encuadre, vistas, instrucciones, licencia y tamaño/fluidez en el teléfono elegido. El poster y el texto deben explicar el equipo sin 3D. Una máquina estática no implica una animación educativa; los clips futuros necesitan su contrato de carga y reproducción propio.

## Paso a un entorno público

Usar la [instancia independiente](b2b.md#instancia-independiente), con DB y volumen de medios dedicados, secretos propios, origen HTTPS exacto y los contenedores ejecutados sin root. Crear primero el administrador mediante `bootstrap`; no cargar cuentas de prueba en producción. Respaldar DB y medios como un conjunto y probar su restauración.

Esta actualización requiere desplegar API, app del socio y backoffice de la misma revisión durante una ventana coordinada: los clientes anteriores usan contratos estrictos y rechazan los campos nuevos incluso cuando son `null`. Seguir la [secuencia de actualización y recuperación](b2b.md#compatibilidad-y-despliegue-de-esta-actualización), incluyendo recarga de pestañas y conservación de borradores. El código nuevo lee los snapshots anteriores; volver a las imágenes anteriores no garantiza que puedan leer los datos escritos después de actualizar. Preferir una corrección sobre la versión actual y validar cualquier recuperación con una copia independiente, conservando también los cambios posteriores al respaldo.

Imprimir etiquetas solamente después de comprobar que su origen HTTPS es accesible desde el teléfono. La UI marca las etiquetas de loopback como pruebas. Recorrer administrador → profesor → socio → seguimiento; escanear ambas unidades, comprobar permisos y retirar una ficha publicada. Registrar dispositivo, sistema/navegador, fecha, resultado y capturas sin credenciales.

La aprobación de contenido, el escaneo físico, la política de baja y una publicación externa no se afirman completados desde un entorno de desarrollo.
