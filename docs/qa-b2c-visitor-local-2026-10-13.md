# QA B2C visitante / modo local — 13 de octubre de 2026

Rama: `qa/b2c-visitor-local-20261013`. Base limpia: `7172041102a8a7029af5fb3e2527a1fa51611a86`.
`git fetch origin main` confirmó HEAD = origin/main, sin necesidad de fast-forward.
Atlas: `/workspace/sysadmin-workspace`, limpio, `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`, también actualizado mediante fetch y sin cambios de contenido.

Esta copia para publicación conserva el código probado y la documentación textual. No incluye merge ni deploy. Los commits originales y los binarios de evidencia permanecen en el checkout original y su bundle verificado.
Modelos, capturas fuente y previews se conservaron. La [matriz con estados por motor/ancho/modo](validation/b2c-visitor-2026-10-13/matrix.md) y el [resultado JSON](validation/b2c-visitor-2026-10-13/results.json) conservan cifras, corridas originales y evidencia.

## Inventario previo a los casos

Leídos `AGENTS.md`, la skill Atlas local `atlas-navigate`, la política source-of-truth,
el catálogo/relaciones/wiki de Klisteniapp, `docs/roadmap-implementacion.md`, arquitectura,
demo pública, desarrollo, salud e importación, yoga, y los componentes/acciones del store.
Atlas aporta contexto histórico; el código y esta ejecución local determinan lo probado.

Las seis secciones principales son estado interno de `/`, no seis rutas del navegador.
`AppRoot.tsx` administra `/privacy`, historial del navegador y rutas públicas de cuenta.

| Superficie | Acciones del visitante inventariadas | Casos / evidencia |
| --- | --- | --- |
| `/` · Mi rutina | Seleccionar ejercicio; técnica/pasos/variantes; músculos; progresiones/alternativas; movilidad; fuentes; consejos; personalizar orden/agregar/quitar/series; comenzar fuerza; cardio | V01–V07, tests app, catálogo, planificación, biblioteca |
| Biblioteca | Búsqueda bilingüe/sin acentos; patrón, dificultad y equipo combinados; vacíos/reset; abrir movimiento sin cambiar rutina | V01, catálogo y planificación existentes |
| Mi cuerpo | Doce regiones; filtros; búsqueda anatomía/yoga; expandir anatomía; roles de la rutina; abrir ejercicio/asana; visor optativo y fallback | V01, biblioteca, body-guide y anatomía existentes |
| Visor compartido | Piel/músculo/hueso; seleccionar estructura; play/pause/velocidad/fase; reiniciar/orbitar/cámara; ampliación; anotaciones; alternativa sin WebGL | Pruebas existentes de renderer y fallback; límites separados debajo |
| Yoga | 24 fichas, sánscrito/inglés, nivel/familia, fuentes/cuidados; crear desde cero/plantilla/asana; reordenar/repetir/lado/duración; cancelar/descartar; editar/eliminar práctica; guía, pausa/salto/resumen/notas; historial y eliminación | V12/V16, suite yoga existente |
| Mi progreso | Vacío, calendario/XP, fuerza/cardio/yoga; detalle; agregar cardio; confirmar/cancelar eliminación | V03–V07, V12, V18 |
| Mi salud · Resumen | Período, medida/fuente, registros/fechas visibles, evolución, sueño, entrenamiento, alimentación y suplementos, objetivos, enlaces hacia formularios | V08, auditoría y capturas |
| Mi salud · Cuerpo | Perfil opcional, registros, editar/eliminar, fecha/origen/notas, filtros de fecha y paginación | V08/V09; filtros/paginación pendientes según matriz |
| Sueño y actividad | Sueño, fases/horarios/puntuación; pasos/pulso/energía/actividad y asociación opcional de entrenamiento; CRUD | V08/V09; campos adicionales pendientes según matriz |
| Alimentación | Comidas/macronutrientes; suplementos/dosis/unidad; CRUD | V08; cada variante de edición pendiente según matriz |
| Objetivos | Métrica/valor/inicio/plazo/notas; progreso, editar/eliminar | V08; todos los plazos y métricas pendientes según matriz |
| Salud · Importar | Plantilla vacía; JSON normalizado; vista previa, reanálisis/descartar/confirmar; deduplicación, errores, límites 2 MiB | V10 |
| Ajustes | ES/EN/FR; claro/oscuro/sistema; seis paletas; modelo corporal; objetivo semanal; movimiento reducido; configuración inicial; privacidad; exportar/importar v1/v2; recuperación, límite 9 MiB | V02/V11/V13/V14/V17, settings/themes/model-variant existentes |
| `/privacy` | Entrada directa, volver, back/forward, mantener borrador durante ida/vuelta, foco | V13 y demo/settings existentes |
| Instancia sin cuenta | Descubrimiento de sesión; cookie inválida; API sin respuesta; conservar local; botón de cuenta/planificación y acceso público | V15; ciclo de cuenta pertenece a la sesión B2C con cuenta |
| `/account/join`, recuperación/restablecimiento y `?account=login` | En demo se ignoran las intenciones de cuenta; en instancia abren UI pública de cuenta | Ignorar rutas en demo: suite existente. Alta/login/recuperación: NOT RUN en este rol |

## Escenario y motores

- Node `24.19.0`; dependencias del checkout ya disponibles. pnpm nativo inicial `11.25.0`; pnpm `12.7.0` instalado en caché del workspace para validación final.
- Demo compilada, sin transportes de cuenta ni analytics. Instancia compilada con perfil público de ejemplo y proxy a API B2C real.
- PostgreSQL `17.11` en contenedor desechable `klisteni-visitor-qa-pg-20261013`, puerto loopback `54339`, DB/usuario ficticios `visitor_qa`; schema aleatorio creado y retirado por `accounts-e2e-server.ts`.
- API `127.0.0.1:4182`, instancia `127.0.0.1:4181`, demo final `127.0.0.1:4177` (4176 conserva el build anterior al ajuste de overflow). Billing y correo deshabilitados en el fixture. No hubo login ni escrituras de usuario del visitante en API.
- Chromium del sistema `154.0.8037.57`, Debian 13. Descarga del Chromium incluido por Playwright bloqueada por HTTP 403; se usó `/usr/bin/chromium`.
- Playwright `1.63.0`, WebKit `26.6` / build `2359`, WPE Linux. Sus dependencias se descargaron y extrajeron sólo en `/workspace/.cache`, con enlaces a `minibrowser-{gtk,wpe}/sys/lib`; no se instalaron paquetes del sistema.
- Proyectos: `chromium-narrow`, `webkit-narrow`: **320×740**, touch + isMobile; `*-mobile`: **430×932**, touch + isMobile; `*-desktop`: **1440×1000**, sin touch. Tests existentes también usan **390×844**, **320×740** y **320×926 / 486×926** para thumbnails. Estos cambios de viewport dentro de tests existentes mantienen los flags desktop del proyecto; los proyectos propios sí activan touch/isMobile.
- V18 genera eventos `pointerType=touch` mediante `tap()` y verifica el dato persistido. Son simulaciones de navegador, no pruebas físicas de iPhone/Android, ni Safari de un teléfono.

Las pruebas de datos abortan GLB deliberadamente para ejercitar la alternativa textual del producto.
El renderer real se prueba aparte; no se mezcla ese resultado con la disponibilidad de contenido/fallback.
Las trazas conservan DOM/red/código, y las capturas se toman explícitamente; no se actualizaron snapshots de aceptación para obtener verde.

## Bugs corregidos

| ID | Reproducción anterior | Corrección / regresión |
| --- | --- | --- |
| B01 | Personalizar orden/series sin guardar antes salud/yoga → exportación v1 omite la rutina | Exportar copia v2 cuando hay preferencias locales; V02 restaura en otro contexto y recarga; tests de ambos stores |
| B02 | Registrar cardio → simular cuota al borrar → desaparece la fila aunque sigue en disco y no se puede reintentar | Mantener fila hasta eliminación durable; V05 conserva, reintenta y verifica disco; ambos stores |
| B03 | Copia personal corrupta → exportar original → confirmar importación v2 válida → rechazo permanente | Sólo la importación confirmada permite reemplazar copia ilegible; conserva original recuperable y anteriores recuperaciones; V17 y tests de stores |
| B04 | Resumen de salud: `small` fuera de `dt/dd` dentro del agrupador de `dl` | Cobertura de registros dentro de `dd`, aspecto conservado; axe definition-list |
| B05 | Fichas de yoga: nombre accesible del botón omite la familia visible | Nombre incluye nombre de asana y familia traducida; axe label-content-name-mismatch |
| B06 | WebKit a 320 px: la anchura intrínseca de selects de apariencia crea 15 px de scroll horizontal en Ajustes | Tracks y labels encogen dentro del contenido; sin ocultar overflow. Suite themes/settings y medición clientWidth = scrollWidth |

Archivos compartidos con el rol B2C con cuenta que requieren integrar con cuidado:
`src/lib/store.ts`, `store.local.ts`, `components/HealthDashboard.tsx`, `health-dashboard.css`,
`YogaPage.tsx`, `components/settings.css`, tests `account-store.test.ts`, `local-store.test.ts`, `tsconfig.json`.
El camino autenticado no se cambió; la suite de stores incluye sus regresiones de cuenta.
No se modificó ningún paquete de anatomía, catálogo, geometría o API.

## Matriz de flujos

La matriz por motor/ancho/modo, duración, estado y ruta de traza está en `results.json`.
Cada fila V01–V18 se ejecuta en contextos nuevos y fixtures separados. PASS requiere
aserciones de UI y, para mutaciones, inspección del almacenamiento y/o recarga.

| Caso | Alcance |
| --- | --- |
| V01 | Vacíos de seis secciones, capturas, sin overflow, filtros/reset, anatomía y cero historial inventado |
| V02 | Rutina personalizada sola → exportación → contexto independiente → importación → recarga |
| V03 | Cardio inválido/futuro, cancelar, doble envío, exactitud de minutos/distancia, recarga, borrar/cancelar |
| V04 | Cuota en cardio: conservar formulario y reintentar sin duplicar |
| V05 | Cuota al borrar: conservar fila y disco, reintentar |
| V06 | Fuerza: repeticiones inválidas, bloqueo de edición/reinicio, seis series distintas, doble guardado, recarga |
| V07 | Fuerza: seguir entrenando, salir sin guardar, recarga descarta borrador, cero XP |
| V08 | Perfil corporal, medición/edición, sueño, pulso, comida, suplemento, objetivo; recarga y eliminación sin perder otra colección |
| V09 | Salud vacía, fuera de rango, fases imposibles, cuota, conservar formulario y reintentar |
| V10 | Salud JSON: plantilla vacía, preview, descartar, confirmar, duplicado, corrupto/futuro/>2 MiB |
| V11 | v1/v2: confirmar/cancelar, corrupto/>9 MiB, conservar otras colecciones, exportar, recargar |
| V12 | Yoga parcial: pausa no suma, salto no suma, notas, doble guardado; borrar secuencia preserva historial |
| V13 | Privacidad: back/forward/volver conservan borrador, Escape y restauración de foco |
| V14 | ES → EN → FR, dark, reload, lang de documento, controles y capturas |
| V15 | Cookie ficticia caducada, respuesta de API perdida, cardio local sin PUT/POST y recarga |
| V16 | Yoga completo: evento de visibilidad simulado, pausa, cuota, notas, reintento exacto, recarga |
| V17 | Original personal corrupto descargable; importación confirmada; recuperación descargable tras recarga |
| V18 | Tap real sintético / mouse según proyecto, navegación/cardio, foco atrapado en diálogo nativo |

## Límites y pendientes explícitos

| Estado | Área | Motivo / seguimiento |
| --- | --- | --- |
| FAIL previo | Gate `previews:check` de yoga | `Extraction receipt is stale`; documentado en roadmap/Atlas. Ejercicio 74/74 y cuerpo 24/24 pasan. No se regeneró nada ni se alteró el gate |
| NOT RUN | Teléfonos físicos, lector de pantalla, voz/Safari iOS y teclado virtual | Navegadores Linux disponibles; revisión física a cargo del usuario |
| NOT RUN | Todos los campos/variantes CRUD de salud, cada métrica/plazo de objetivo, filtros/paginación con cientos de filas | Casos representativos de cada colección; no afirmar combinatoria completa |
| NOT RUN | Dos pestañas escribiendo simultáneamente en las mismas claves locales | Contextos aislados y recarga sí se probaron; escritores concurrentes del mismo origen no |
| NOT RUN | Reloj real, OAuth/Health Connect/Samsung nativo | Importación normalizada con fuente ficticia; integración nativa diferida por el producto |
| NOT RUN | Aislamiento entre cuentas autenticadas, administración, billing y recuperación por correo | Roles en sesiones independientes; visitante no autentica ni envía correo |
| NOT RUN | Reinicio offline antes de descargar archivos | No existe service worker; modo local no garantiza disponibilidad offline de la app |
| NOT RUN | Portabilidad de objetivo semanal/reducir movimiento | Son preferencias del dispositivo fuera del schema personal; V02 prueba orden/series de rutina, no todas las preferencias |

La sesión empezó dos corridas amplias con exceso de carga de software WebGL: se interrumpieron y
no se cuentan como aprobadas. Se preservaron sus logs y las regresiones se ejecutaron después.
Los fallos de selectores durante preparación del harness y del ejecutable pnpm sin postinstall
están separados de defectos del producto. La validación final usa el binario pnpm instalado.

## Reproducción automática

Desde el root, dependencias y navegadores habituales:

```sh
pnpm install --frozen-lockfile
pnpm --filter @klisteniapp/b2c-web exec playwright install chromium webkit
pnpm --filter @klisteniapp/b2c-web exec playwright test --config playwright.visitor.config.ts
```

Para visitante de instancia con DB desechable (sin credenciales reales):

```sh
docker run --rm -d --name klisteni-visitor-review-pg \
  -p 127.0.0.1:54339:5432 \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_USER=visitor_qa -e POSTGRES_DB=visitor_qa postgres:17-alpine
TEST_DATABASE_URL=postgresql://visitor_qa@127.0.0.1:54339/visitor_qa \
  VISITOR_INSTANCE=1 \
  pnpm --filter @klisteniapp/b2c-web exec playwright test --config playwright.visitor.config.ts
docker stop klisteni-visitor-review-pg
```

El fixture crea schema aleatorio y lo retira al salir; sólo necesita esa DB aislada.
No iniciar sesión: se prueba la experiencia local del visitante. El código de fixture genera
cuentas de prueba internamente; no hace falta copiar credenciales ni activar conexiones.

Opciones de harness: `VISITOR_BROWSERS=chromium,webkit`, `VISITOR_CHROMIUM_PATH`,
`VISITOR_WEBKIT_PATH`, `VISITOR_RUN` para nombres inmutables de evidencia, `VISITOR_EXTERNAL_SERVER=1`
y `VISITOR_URL` para un servidor ya preparado. `VISITOR_EXISTING=1` selecciona suites educativas existentes.
En este Cloud se usó el Chromium del sistema y el launcher WebKit con librerías locales; los
resultados finales no requieren omitir validaciones del producto.

Auditoría accesible sin cambiar dependencias de la app:

```sh
npm install --prefix /tmp/klisteni-visitor-axe axe-core@4.14.0
VISITOR_AXE_PATH=/tmp/klisteni-visitor-axe/node_modules/axe-core/axe.min.js \
  VISITOR_URL=http://127.0.0.1:4177 node scripts/visitor-accessibility.mjs
```

## Checklist manual breve

1. Levantar `pnpm dev:demo`, abrir `http://127.0.0.1:5173` en un perfil nuevo y comprobar las seis secciones vacías.
2. Ajustes → Datos → importar [demo-personal.json](validation/b2c-visitor-2026-10-13/demo-personal.json), confirmar reemplazo. Incluye perfil ficticio y práctica de tres tramos de cinco segundos, sin historial inventado.
3. Personalizar rutina: subir Sentadilla y elegir una serie. Exportar; importar en otro perfil y recargar: mismo orden/series.
4. Registrar Bici 25 minutos/4,5 km; completar una fuerza con seis series; revisar detalles/XP, recargar, cancelar una eliminación y luego confirmarla.
5. Yoga → Mis prácticas → Pausa ficticia QA: comenzar, pausar, saltar un tramo, terminar ahora, revisar y guardar una nota. Ver historial; eliminar secuencia y comprobar que conserva el registro.
6. Salud → Importar → [demo-health.json](validation/b2c-visitor-2026-10-13/demo-health.json), revisar/confirmar y repetir: un registro, sin duplicado. Editar cintura, agregar sueño/comida/objetivo y recargar.
7. Abrir configuración inicial, llenar un borrador, visitar Privacidad y usar back/forward. Cambiar idioma y modo oscuro; recorrer teclado y comprobar foco del diálogo.
8. Repetir a 320/430 px y desktop. Una prueba física del dispositivo complementa esta emulación.

## Retorno para Atlas, sin escrituras allí

Integrar después de revisar/merge esta rama: lectura de `main@7172041` y Atlas `27ae86c`;
seis correcciones focalizadas del visitante local, matriz de navegador y escenarios ficticios,
commits/resultado de este documento. Esto acredita implementación y QA local de esta rama,
no CI remota, despliegue ni dispositivos físicos. Se conserva la decisión de diferir Blender/previews
y el gate yoga fallido, así como las tareas posteriores de backups e integraciones.

## Resultado final y comandos

Código final probado: `fa6f7b185ce2e506d175be1d8bac659fe462cc0b`; los dos primeros fixes
están en `ae60efa`, recuperación/accesibilidad en `8d35f3e`, harness en `316d14d` y
layout WebKit en `fa6f7b1`. El commit de este informe sólo agrega documentación/evidencia.

- **216/216 escenarios propios**, únicos por caso/modo/motor/ancho, PASS en su última ejecución.
- **74/74 recorridos educativos adicionales**, PASS después de las correcciones/reintentos.
- **Renderer real 2/2**, Chromium y WebKit desktop: capas, selección, ampliación/teclado y cero errores JS en esos casos. Chromium también validó viewport 390×844 durante el baseline; no implica touch o teléfono físico.
- **Axe 48/48 superficies**, cero infracciones automáticas; la auditoría final también se repitió después del arreglo de overflow.
- `pnpm lint`: PASS, 14 tareas + boundaries + formato B2B.
- `pnpm typecheck`: PASS, 14 tareas; el nuevo config visitor está incluido en tsconfig.
- `pnpm exec turbo run test --concurrency=1`: PASS, 14 tareas, frontend B2C **201/201**; las suites genéricas omiten un grupo DB de B2C y diez de B2B sin sus variables de test. La API B2C se volvió a ejecutar con DB real aislada: **97/97**, cero omitidos.
- Tests raíz con `node --test scripts/{preview-provenance,preview-workspace-relocation,b2b-boundaries,dev-environment,b2b-gateway}.test.mjs`: **25/25 PASS**.
- `pnpm build`: PASS, 16 tareas. Aviso habitual de chunks grandes, sin error de build.
- `pnpm previews:check`: FAIL previo, yoga receipt stale; ejercicios y cuerpo sí aprobaron. `check`/`check:all` no se declaran verdes.
- `git diff --check`: PASS. Atlas quedó sin cambios.

Las corridas originales permanecen en el JSON: instancia principal **101 PASS / 1 FAIL** por
un selector exacto sobre un textarea lleno en V16; corregido a nombre accesible y reejecutado
**6/6**. Educativa original **72 PASS / 2 FAIL**: fixture de fallback incompatible con WebKit
(reparado) y overflow real de Ajustes (B06). Settings/themes/fallback reejecutados **16/16**;
flujos propios afectados por CSS, demo **30/30** e instancia **30/30**. Estos resultados reemplazan
los estados correspondientes en la matriz; no ocultan los códigos de salida originales.

El schema de la API conservó **1 fila / suma de revisiones 1** antes y después de las pruebas del
visitante; los datos locales se verifican por claves y recargas. Se retiran schema/contenedor de QA
al finalizar. Las pruebas de API usan schemas propios, distintos de ese fixture.

Capturas y trazas seleccionadas están conservadas en el checkout original; se excluyeron de esta rama de publicación, incluido su historial. Los resultados textuales y fixtures ficticios se publican en `docs/validation/b2c-visitor-2026-10-13`.
Abrir un ZIP de traza con `pnpm --filter @klisteniapp/b2c-web exec playwright show-trace <ruta.zip>`.
Los logs versionados conservan resultados y mensajes; sólo se normalizaron espacios finales y líneas vacías al final. Los originales sin normalizar permanecen en `artifacts/visitor-qa`. La evidencia completa de trabajo queda en `artifacts/visitor-qa`; el bundle Git local, en
`artifacts/visitor-qa/visitor-local.bundle`, transporta estos commits sin publicar la rama.
