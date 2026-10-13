# QA e implementación: socio B2B, 13 de octubre de 2026

Revisión local con backend real y datos ficticios. Rama
`qa/b2b-member-20261013-session-b752`; base limpia
`7172041102a8a7029af5fb3e2527a1fa51611a86`, igual a `origin/main` después de
`git fetch origin` y `git merge --ff-only origin/main`. Checkpoint de código:
`14fd1b4287c4f209466d5519528b7a5201cc9f8e`. Sin push, PR, merge ni deploy.

Checkpoint final del harness: `4856be577b0374a643d93dec52ee204f9c8c9228`.

La matriz y el resumen JSON al lado de este informe documentan el resultado
final. Las corridas exploratorias se conservan por separado en
`.cache/member-qa/exploration/`, `branch-reproduction/`, `qr-reproduction/` y
`extra-results/`. No se sustituyeron snapshots, receipts ni gates.

## Contexto e inventario previo a elegir casos

Se leyeron `AGENTS.md`, las instrucciones y skill `atlas-navigate` de
`../sysadmin-workspace`, la política de precedencia de Atlas, su wiki y entry
`2026-10-12-klisteniapp-retrospective`, `docs/roadmap-implementacion.md`,
`docs/b2b.md` y los contratos de marca blanca. Atlas quedó limpio en
`27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`, actualizado mediante fetch y FF.
No se escribió allí. La app owner acredita implementación; el historial de
despliegues de Atlas no acredita el runtime de hoy.

El inventario proviene de `apps/b2b-web/src/routes.ts`, `App.tsx`,
`app/Workspace.tsx`, `app/MemberWorkspace.tsx` y las features de public,
invitations, training, catalog y voice; se contrastó con cliente, contratos y API.

| Ruta o acción accesible al socio | Acciones inventariadas | Cobertura |
| --- | --- | --- |
| `/`, `/gimnasios`, `/sedes/:slug`, `/g/:gym` | Website y sedes; entrar al espacio; equipos públicos | Entrada de QR, lectura contextual y websites de dos marcas; navegación completa de cada website fuera del alcance |
| `/g/:gym/units/:unit` | Ficha, ajustes, instrucciones escritas; equipo → rutina; volver al gimnasio | QR válido, unidad de otra sede, rutina filtrada y filtro sin coincidencias |
| `/login`, `/app` sin sesión | Email/password, marca previa al login, error, destino por función | Login válido y marca ajena; sesión independiente por origen; selección explícita |
| `/app/invite` | Activación nueva, validación nativa, cuenta existente, consentimiento, volver, confirmación | Nueva/existente, falta de token, reutilizada y marca equivocada |
| Selector de sede y función | Elegir contexto permitido; conservar selección al recargar; cancelar solicitudes del contexto anterior | Centro/Norte, borradores aislados; datos/historial por sede |
| `/app`, `/app/routines` | Rutinas asignadas, filtro del QR, empezar sesión; contadores | Vacío, versión publicada, equipo inexistente y cuatro sedes |
| Sesión dentro de rutinas | Reps o segundos, carga, RPE, hecha, alternativa/motivo, notas; instrucciones y descanso | Ediciones, validación, sustitución, parcial/completa, doble clic, borradores, recarga, offline, envío perdido y tardío |
| `/app/catalog` | Buscar, limpiar, abrir/cerrar instrucciones; voz opcional | Búsqueda vacía, texto, controles simulados de voz y alternativa sin API de voz |
| `/app/history` | Estado parcial/completo, versión, sede, prescrito frente a realizado | Persistencia y comparación; sede actual; nueva sesión sin editar el registro anterior |
| `/app/history/all` | Historial de la marca, exportar JSON, volver a la sede | Otra sede conservada, JSON descargado e inspeccionado |
| Salir, recarga, back/forward, otra pestaña | Cerrar sesión, recuperar borrador propio y evitar restauración por respuesta anterior | Expiración por eliminación de cookies, cambios de cuenta, cierre entre pestañas, respuesta privada tardía |
| `/manage`, `/backoffice` | Rechazo al socio y enlace para volver | Rechazo visible; no se prueban acciones de otros roles como casos del socio |

No existe una acción de editar una ejecución confirmada, enviar correos,
autosave remoto o continuar una ejecución parcial. Ambas formas de guardar
cierran un registro inmutable; volver sin guardar conserva el borrador local.
La autorización efectiva sigue en la API.

## Defectos reproducidos y corregidos

1. **M01: progreso de sede mezclado.** Crear una persona con acceso a Centro y
   Norte, guardar en Norte y volver a Centro: “Mi progreso” y contadores cargaban
   toda la marca. `MemberWorkspace.tsx` ahora usa `executions.list(org.id)`, cuya
   guardia de cuenta/sede/rol ya aplica el cliente. `/app/history/all` sigue usando
   el historial autorizado de la marca. Regresión S01 inspecciona ambos destinos
   y el JSON exportado.
2. **M02: QR de otra sede presentado como equipo de la sede actual.** Un socio
   exclusivo de Centro abría la polea de Norte y veía su rutina de Centro como si
   correspondiera a esa unidad. `Workspace.tsx` comprueba el contexto de sede del
   QR antes de mostrar rutinas. Si tiene acceso, la persona elige explícitamente
   abrir esa sede; se conservan máquina/unidad en la URL. Si no tiene acceso,
   muestra el rechazo y permite volver a sus rutinas. Regresiones S01/S10.
3. **M03: confirmación de invitación existente oculta.** El servidor aceptaba con
   200 el consentimiento para incorporarse a Atlas desde una identidad de Sur,
   pero la condición del login heredado ocultaba el estado `done`.
   `Invitation.tsx` ya no renderiza ese login después de aceptar. S16 verifica la
   confirmación, acceso en la sede invitada y contraseña/sesión independiente de
   Sur.

Los tres son cambios de UI/consulta focalizados, sin migraciones ni cambios de
reglas de servidor. Compartidos para integrar con otras ramas de roles:
`app/Workspace.tsx`, `app/MemberWorkspace.tsx`,
`features/invitations/Invitation.tsx`, `apps/b2c-web/tsconfig.json` (incluye el
config nuevo en los tipos). Los dos archivos nuevos de Playwright y el helper
`scripts/b2b-member-review-fixture.mjs` pertenecen a esta tanda. No cambió ningún
archivo de modelos, previews, proveedores, permisos ni infraestructura.

## Entorno y alcance de navegador

Node `24.19.0`, pnpm `12.7.0` (las primeras exploraciones usaron el fallback
11.25.0; se reinstaló con lockfile congelado y se repitieron los checks con la
versión fijada). PostgreSQL `17.11` en un contenedor de QA dedicado, publicado
solamente en `127.0.0.1:54339`, base `klisteni_b2b_test`. El harness crea schemas
aleatorios y directorios de medios por motor; los elimina al salir. La marca
Atlas, Sur, Centro/Norte/Oeste y todas las identidades son ficticias.

| Proyecto | Motor | Viewport CSS | Touch/mobile | DPR |
| --- | --- | --- | --- | --- |
| C320 | Chromium 154.0.8037.57 del entorno | 320 × 740 | true/true | 2 |
| C430 | Chromium 154.0.8037.57 | 430 × 932 | true/true | 2 |
| C1440 | Chromium 154.0.8037.57 | 1440 × 1000 | false/false | 1 |
| W320 | Playwright WebKit 26.6, build 2359 | 320 × 740 | true/true | 2 |
| W430 | Playwright WebKit 26.6, build 2359 | 430 × 932 | true/true | 2 |
| W1440 | Playwright WebKit 26.6, build 2359 | 1440 × 1000 | false/false | 1 |

Playwright `1.63.0`, locale `es-AR`, UTC, light, reduced motion, un worker,
sin retries automáticos. Es emulación táctil sobre Linux, sin afirmar pruebas
físicas de iPhone/Android ni Safari real. Se adjuntan user agent y métricas
observadas a cada caso. Cada viewport recorre pantallas y controles de la app
servida localmente; las verificaciones API adicionales comprueban efectos
persistidos. Se generan capturas de pantalla/viewport y traces.

La descarga de Chromium v1243 fue rechazada con 403; se usó `/usr/bin/chromium`.
WebKit se obtuvo del mirror `cdn.playwright.dev/builds/webkit/2359/` después de
fallar los dos primeros mirrors. Las bibliotecas Debian faltantes se descargaron
y extrajeron en `.cache/member-qa/libs/`, y se agregaron al bundle de WebKit en
`/workspace/.cache/ms-playwright`; no hubo instalación de sistema. Se comprobó
arranque y render de WebKit. El validador de host sigue buscando `libGLESv2` en
el sistema; se omite solamente ese diagnóstico de instalación mediante
`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`, con las bibliotecas cargables y
el motor ejecutando realmente las pruebas.

Las dos marcas usan HTTPS ficticio vía proxies restringidos en loopback.
Chromium acepta el SPKI del certificado del harness; Node usa su CA sólo por
`NODE_EXTRA_CA_CERTS`. WebKit acepta el certificado autofirmado dentro del
contexto de este test. Esta tanda no acredita confianza de una CA pública ni
certificados de producción; el config y los gates de WL originales se conservan.

## Matriz de ejecución

<!-- MEMBER_QA_MATRIX -->
Resultado final consolidado: **96/96 combinaciones**. Primera pasada: 85 PASS y
11 FAIL de harness; reejecución explícita tras corregirlo: **24/24 PASS**. Los
72 casos no afectados conservan su primera evidencia. No es una corrida única
de 96 verdes ni se ocultan los fallos anteriores.

| Caso | Flujo | C320 | C430 | C1440 | W320 | W430 | W1440 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | Sedes, borradores, progreso y exportación | PASS | PASS | PASS | PASS | PASS | PASS |
| S02 | Invitación nueva, validación, vacíos y rechazo | PASS | PASS | PASS | PASS | PASS | PASS |
| S03 | QR → login contextual y filtro sin actividad | PASS | PASS | PASS | PASS | PASS | PASS |
| S04 | Series, sustitución, validación, volver/recarga/back-forward y parcial | PASS | PASS | PASS | PASS | PASS | PASS |
| S05 | Segundos/RPE, completa y doble clic | PASS | PASS | PASS | PASS | PASS | PASS |
| S06 | Respuesta perdida tras commit, recarga y reintento exacto | PASS | PASS | PASS | PASS | PASS | PASS |
| S07 | Offline y 503 sin commit; confirmar envío | PASS | PASS | PASS | PASS | PASS | PASS |
| S08 | Sesión expirada, reingreso y otra cuenta | PASS | PASS | PASS | PASS | PASS | PASS |
| S09 | Catálogo, búsqueda vacía, carga fallida, rutas y permisos | PASS | PASS | PASS | PASS | PASS | PASS |
| S10 | QR de sede sin acceso y recuperación | PASS | PASS | PASS | PASS | PASS | PASS |
| S11 | Voz opcional simulada y texto sin speech API | PASS | PASS | PASS | PASS | PASS | PASS |
| S12 | Descanso/pausa/reanudar sin registrar series | PASS | PASS | PASS | PASS | PASS | PASS |
| S13 | Dos marcas, cierre entre pestañas y respuesta privada tardía | PASS | PASS | PASS | PASS | PASS | PASS |
| S14 | Sin almacenamiento local; guardado real | PASS | PASS | PASS | PASS | PASS | PASS |
| S15 | Guardado tardío después de navegar/reabrir; reintento | PASS | PASS | PASS | PASS | PASS | PASS |
| S16 | Invitación de identidad existente y consentimiento | PASS | PASS | PASS | PASS | PASS | PASS |

JSON inspeccionable: [resultado consolidado](b2b-member-qa-2026-10-13.json).
Trazas y capturas completas: `.cache/member-qa/full-first-pass/results/` y
`.cache/member-qa/results/`; logs `full-first-pass/ui.log` y `final-ui.log`.
<!-- /MEMBER_QA_MATRIX -->

| Alcance adicional | Estado | Evidencia/límite |
| --- | --- | --- |
| Cerrar una rutina en las cuatro sedes y logout entre pestañas | PASS | 4/4 grupos de `white-label.spec.ts` en Chromium/WebKit estrechos, schema separado por proxy 4344 |
| Crear y repetir fixture manual | PASS | Helper ejecutado dos veces; asignaciones existentes reutilizadas |
| Invitación vencida según reloj del servidor | NOT RUN en UI | La API cubre expiración/one-use; UI prueba token faltante, reutilizado y marca equivocada |
| QR impreso/cámara real | NOT RUN | Sólo se abre el destino de QR en navegador; no es un escaneo físico |
| Voz real y audio del dispositivo | BLOCKED en Cloud | No hay validación de salida de audio/voz del teléfono. API/control simulado y texto alternativo sí probados |
| Teclado virtual, orientación y gestos del SO; bfcache real de iOS | NOT RUN | Viewports táctiles y back/forward emulados no acreditan esos comportamientos físicos |
| Cambios del servicio B2B/retirada de sede mientras se guarda | NOT RUN en esta UI | La API tiene tests de revocación, colas y preservación de historial; revisión física adicional pendiente |
| Modelos/animaciones/previews nuevas | NOT RUN | Diferidas y fuera del alcance autorizado de esta tanda |
| Producción/CI remoto | NOT RUN | No consultados ni operados |

## Checks y distinción de fallos

`pnpm check` ejecutó límites B2B, lint, formato, tipos y tests con éxito antes de
fallar en `previews:check`: `Extraction receipt is stale` en Yoga. Se repitió
`node scripts/generate-yoga-previews.mjs --check` en un worktree limpio del SHA
inicial y produjo el mismo error. Es previo y está diferido en el roadmap;
no se cambiaron hashes ni capturas. El build posterior del agregado no se
ejecutó porque ese gate lo detiene. El build B2B sí se ejecuta para la UI. Después de terminar los navegadores,
`pnpm build` también pasó por separado: **16/16 tareas**. Esto no vuelve verde
el agregado ni elimina el gate de previews.

Lint y tipos: 14/14 tareas; tests agregados: 14/14 tareas, más 23 tests raíz.
API B2B: 76/76, cero skips; frontend B2B: 53/53. El agregado no configuró una
DB B2C y omite su grupo de integración; no se atribuye a este rol cobertura de
cuentas B2C. El config nuevo también queda incluido en el typecheck del repo.

Las exploraciones registran problemas reparados del setup: cache de pnpm fuera
del workspace, bins nativos de pnpm sin postinstall, dependencias de WebKit,
intercepción HTTPS sin CA de Node, fixture de texto incorrecto y login 429.
Un fallo exploratorio de WebKit por imports 404 fue causado por reconstruir
el build durante una suite; la matriz final usa un build fijo. Se conserva esa
traza. La primera pasada completa detectó un login contextual sin manejo de 429 y
contabilizó como excepciones los diagnósticos Inspector de WebKit para fetch
cancelado (`Fetch API cannot load … due to access control checks`). Un probe en
los recorridos de invitación/expiración reprodujo esos eventos con **cero**
`window.error` y `unhandledrejection`. El monitor final captura esas fronteras
reales, mantiene la aserción de cero fallos de script y adjunta por separado
todos los diagnósticos Inspector; no filtra los logs. Se reejecutaron invitación
nueva, QR/login, expiración y consentimiento de identidad existente en las seis
configuraciones. Los controles negativos provocaron error y promesa rechazada
en ambos motores: el gate los detectó en 4/4 (fallos deliberados fuera de la
matriz de producto). Sus JSON/trazas se conservan en `runtime-probe/` y
`monitor-negative/`. No se declaró cero diagnósticos de navegador en WebKit.

## Evidencia visual y trazas

Capturas reales seleccionadas, también incluidas con sus hashes en la entrega:

- [M01 antes: Norte aparece dentro de Centro](b2b-member-qa-2026-10-13/before-branch-progress.png), [historial de marca después](b2b-member-qa-2026-10-13/all-history-webkit-430.png).
- [M02 antes: QR de Norte muestra Centro](b2b-member-qa-2026-10-13/before-foreign-qr.png).
- [M03 antes: login después de aceptar](b2b-member-qa-2026-10-13/before-existing-invitation.png), [acceso después de aceptar en WebKit 430](b2b-member-qa-2026-10-13/existing-invitation-webkit-430.png).
- [Sesión por segundos, Chromium 320](b2b-member-qa-2026-10-13/timed-session-chromium-320.png), [parcial, WebKit 320](b2b-member-qa-2026-10-13/partial-history-webkit-320.png).
- [Catálogo WebKit escritorio](b2b-member-qa-2026-10-13/catalog-webkit-desktop.png), [historial en escritorio](b2b-member-qa-2026-10-13/all-history-desktop.png).

Se inspeccionaron pantallas de QR, formulario de sesión/validación, historial,
catálogo, ambas marcas y confirmación de invitación. No se evaluaron solamente
respuestas HTTP. El archivo de entrega es
`/workspace/shared/klisteni-b2b-member-qa-2026-10-13.zip`; contiene reports,
traces de cada caso, capturas, resultados originales, reproducciones, logs,
probes y manifiesto SHA-256. Los traces contienen exclusivamente cookies,
cuentas y enlaces **ficticios** de los schemas desechables; no se incluyen envs,
claves TLS ni credenciales reales.

Abrir una traza desde el checkout:

```sh
pnpm --filter @klisteniapp/b2c-web exec playwright show-trace /ruta/a/trace.zip
```

No quedan defectos de producto reproducidos sin corregir en los recorridos
realizados. Las filas BLOCKED/NOT RUN conservan sus límites de aceptación;
esta conclusión no promete cobertura absoluta.

## Escenario reproducible sin credenciales reales

Requisitos: Node 24+, pnpm 12.7.0, Docker y navegadores Playwright. Todo lo
siguiente es una base ficticia nueva; no reutilizar una conexión real.

```sh
pnpm install --frozen-lockfile --ignore-scripts
docker run -d --name klisteni-b2b-member-qa \
  -e POSTGRES_PASSWORD=qa-local-only -e POSTGRES_DB=klisteni_b2b_test \
  -p 127.0.0.1:54339:5432 postgres:17
export B2B_TEST_DATABASE_URL=postgresql://postgres:qa-local-only@127.0.0.1:54339/klisteni_b2b_test
pnpm --filter @klisteniapp/b2c-web exec playwright install chromium webkit
node scripts/b2b-wl-tls.mjs
export NODE_EXTRA_CA_CERTS="$PWD/.cache/wl/tls/ca.crt"
pnpm --filter @klisteniapp/b2c-web exec playwright test --config playwright.member-qa.config.ts
```

Si se usa el Chromium del sistema, definir `B2B_QA_CHROMIUM_PATH=/usr/bin/chromium`.
En este Cloud, los caches quedan bajo `/workspace`; consultar los comandos
registrados en el resumen para las bibliotecas locales y el entorno del run.
No se cambió la política de seguridad de la máquina para instalar dependencias.

Para revisión manual, mantener el harness en una terminal y generar el fixture
en otra. Usa el proxy 4344 reservado, separado de la matriz principal:

```sh
pnpm build:b2b
node scripts/b2b-wl-e2e-server.mjs
# En otra terminal, con las variables anteriores y navegador disponible:
node scripts/b2b-member-review-fixture.mjs
```

El helper guarda `.cache/member-qa/review-fixture.json`. Persona ficticia
`review-member@atlas.example.test`, contraseña de prueba
`browser-tests-only-password-2026`, Centro y Norte, rutina de series en ambas
sedes y `QA manual · tiempo` en Centro. Repetir el helper reutiliza cuenta,
programa y asignaciones. Detener el harness elimina los schemas y requiere
volver a generar el fixture. No envía correo ni muestra enlaces de activación.

Abrir un **perfil de navegador de pruebas separado**, con proxy
`http://127.0.0.1:4344` y `https://atlas.b2b.test/app`. Para Chromium local se
puede usar su flag SPKI acotado al certificado de la fixture, sin instalar una CA:

```sh
# Imprime únicamente la huella pública del certificado ficticio.
node --input-type=module -e 'import {whiteLabelTLS} from "./scripts/b2b-wl-tls.mjs"; console.log(whiteLabelTLS().spki)'
# Sustituir HUELLA por esa salida; perfil dedicado dentro del workspace.
chromium --user-data-dir="$PWD/.cache/member-qa/manual-profile" \
  --proxy-server=http://127.0.0.1:4344 \
  --ignore-certificate-errors-spki-list=HUELLA https://atlas.b2b.test/app
```

Checklist manual breve:

1. Entrar con la persona ficticia; elegir **Centro · Socio**. Abrir la rutina
   de series, cambiar reps/carga/RPE y marcar una serie. Volver sin guardar,
   recargar y reabrir: los valores deben conservarse.
2. Sustituir por una alternativa autorizada: carga/RPE/hecha se reinician.
   Intentar guardar sin motivo, comprobar el error y completar el motivo.
3. Guardar parcial: aparece una sola ejecución inmutable. Empezar otra sesión
   debe crear un borrador nuevo. En `QA manual · tiempo`, registrar 38 segundos
   y RPE 7.5, completar ambas series y comparar lo indicado con lo realizado.
4. Elegir Norte, registrar allí y volver a Centro: **Mi progreso** es de Centro;
   **Todo mi historial** conserva ambas sedes y permite exportar JSON.
5. Abrir `/g/atlas-demo/units/atlas-demo-norte-cable-01` desde Centro, pulsar
   equipo→rutina y confirmar explícitamente Norte. Con la cuenta ficticia
   `member@atlas.example.test` (misma clave de prueba) debe rechazarse esa sede.
6. Con el panel Network, simular offline; editar y guardar: permanece envío
   pendiente. Volver online, recargar/reabrir y confirmar; no duplicar historial.
   Para pérdida **posterior** al commit, usar S06 automatizado con `--headed`
   o su traza: offline por sí solo no demuestra esa condición.
7. Salir en otra pestaña y volver a entrar: ninguna respuesta anterior debe
   restaurar acceso. La otra cuenta no ve el borrador propio. Revisar voz/audio
   y teclado en un dispositivo físico de pruebas como aceptación adicional.

## Resumen para integrar en Atlas después

Lectura local nueva de Klisteniapp, sin nueva evidencia de producción. Tres
correcciones de UI del socio y una matriz de seis combinaciones de motor/viewport
con PostgreSQL desechable; el resumen JSON de esta tanda fija los resultados y
límites. La implementación WL sigue cerrada; esta tanda no reabre WL-0–WL-8.
Gate Yoga, autoría/previews, dispositivos físicos, backups/retención y futuras
integraciones conservan sus pendientes. Integrar este informe y su commit como
evidencia **local/committed**, después de conciliar las ramas por rol; no describir
estos cambios como pushed/merged/desplegados. Atlas no recibió escrituras.
