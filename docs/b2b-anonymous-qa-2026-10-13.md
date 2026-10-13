# QA B2B visitante anonimo — 2026-10-13

Resultado final: **252/252 casos UI PASS**, cero fallos, omitidos, retries o flaky
en la corrida final de 11 minutos. API **80/80 PASS**. No acredita produccion
ni telefonos fisicos. WebKit HTTPS permanece BLOCKED; su matriz funcional es HTTP.

## Revision y alcance

- Repo owner: `pablitxn/klisteniapp`, checkout `/workspace/klisteniapp`.
- Inicial: rama `work`, arbol limpio, `7172041102a8a7029af5fb3e2527a1fa51611a86`.
  Fetch a origin comprobo `HEAD...origin/main = 0 0`: no hizo falta fast-forward.
- Rama original local: `qa/b2b-anonymous-20261013`.
- Variante publicable: `qa/b2b-anonymous-20261013-publicable`; conserva los cuatro commits de codigo/QA y omite el commit de binarios.
- Correcciones: `7542001dba4bacb512b58c6ad1f3a7bb89ba4797`.
- Matriz/fixtures: `0aa942e`; ampliacion/launcher `435ef3a`; correccion de tipado QA final `128d332b11822b4df4aedae0f3d55bc8cf357441`.
- Atlas: `/workspace/sysadmin-workspace`, rama `work`, limpio,
  `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`. Fetch comprobo paridad
  con origin/main. Solo se leyo contenido; no se actualizo Atlas.
- Rol: visitante sin sesion en Atlas Centro/Norte y Sur Centro/Oeste.
  Websites, catalogo/equipos publicados, imagenes/video/plano, QR por unidad,
  entrada al login, alias, URL invalida, privacidad y recuperacion de lecturas.
- No se operaron datos reales, produccion, DNS, pagos, SMTP ni infraestructura.
  Esta variante se prepara para push y PR draft autorizados; no hay merge o deploy. Modelos y previews conservaron sus archivos.

Fuentes leidas: `AGENTS.md`, skill local `atlas-navigate`, politica de autoridad,
`atlas/wiki/klisteniapp.md`, retrospectiva KLI-01; `docs/roadmap-implementacion.md`,
`docs/b2b.md`, `docs/b2b-white-label.md`, `docs/b2b-white-label-runtime.md` y
`docs/development.md`. Atlas documenta marca blanca ya implementada y previews,
Blender, backups recurrentes y aceptacion fisica pendientes. Sus pruebas de
release conservan SHA/fecha; no se reutilizan como resultado de esta tanda.

## Inventario anterior a elegir casos

Derivado de `apps/b2b-web/src/routes.ts`, `App.tsx`, `ApplicationProvider.tsx`,
`features/public/*`, `ExerciseDetails.tsx`, `VoiceGuide.tsx`, `Invitation.tsx`,
`packages/b2b-ui/src/{components,login}.tsx`, `content/*`, y API `http.ts`,
`service.ts`, `white-label-service.ts`, `equipment/index.ts` y `catalog/index.ts`.

| Ruta / superficie | Acciones accesibles sin cuenta | Cobertura |
| --- | --- | --- |
| `/`, `/gimnasios` | Marca, sedes, Ingresar, Entrar a mi espacio, logo a `/app`, skip link | A01, A14, A20, A21, A26, A30, A33, A36 |
| `/sedes/:slug` | Actividades, horarios, contacto, galeria, controles video, plano/lista y links a equipos, login de sede | A02-A05, A08-A12, A18-A19, A29 |
| `/g/:slug` | Website de marca, horarios, galeria, login; rechazar slug de otra marca | A07, A13, A16, A30 |
| `/g/:slug/units/:unitId` | Ficha QR, ajustes, medios, instrucciones expandibles, regreso al gimnasio y entrada a rutina/login | A03, A05-A06, A10-A12, A27-A28 |
| `/login` | Email/password, validacion, envio, error, estado ocupado | A05, A14, A22-A23, A31 |
| `/app` y `/app/{routines,catalog,history,history/all}` | Login, sin contenido privado; QR mantiene unit/machine/branch | A06, A24 |
| `/manage` y `/manage/{reports,people,programs,catalog,equipment,brand,preparation,website,media,qr,whiteLabel}` | Login, sin contenido administrativo | A24 |
| `/backoffice` y aliases de gestion | Canonicalizacion a `/manage`; guardia anonima | A24, tests de rutas existentes |
| `/app/invite` | Activacion, entrada con cuenta existente; invitacion invalida no crea cuenta | A25, A36; flujo valido pertenece al rol con invitacion |
| URL sin ruta, slug/unit inexistentes y encoding mal formado | Pantalla inexistente/error recuperable o rechazo 400 en gateway | A15, A32 |
| Host alias/desconocido | Redirect canonico sin fragmento; queries sensibles y host desconocido rechazados | A17 |
| Medios `/api/b2b/media/:id` | Solo referencias actualmente publicadas; GET/HEAD/Range | A07-A09, A16, A34, regresiones API |
| Guion de voz y visor de movimiento opcionales | Texto, voz del navegador, animacion solicitada explicitamente | A35 fallback sin speech; animacion/modelos NOT RUN por alcance; audio fisico NOT RUN |
| Entrada legacy `GymEntry` | Codigo de gimnasio y validacion | NOT RUN: estos seis fixtures usan dominios marca blanca; no directory publico |

## Defectos corregidos

| ID | Reproduccion / resultado anterior | Correccion y regresion |
| --- | --- | --- |
| PUB-01 | Norte mostraba direccion/contacto general de Atlas aunque tenia perfil publicado propio | API usa `published_profile` de la sede para el contacto de website/QR; nunca el perfil borrador. A04 + API |
| PUB-02 | Encabezado QR de Norte enlazaba a login sin `branch`; regreso llevaba a portada general | Se deriva la sede de `unit.branchId`; login y regreso conservan la sede publica. A05, A27 |
| PUB-03 | Imagen publicada solamente en galeria de marca devolvia 404 | `mediaAccess` comprueba referencias de la portada publicada ademas de tema/sedes. A07 + GET/HEAD/Range/revocacion y aislamiento API |
| PUB-04 | Con sedes publicas y portada sin publicar, la portada intentaba leer un recurso 404 y mostraba error | `context.websitePublished` refleja la publicacion de la portada; las sedes conservan independencia. A13 + API |
| PUB-05 | Fallo de contexto dejaba solo un error y obligaba a recargar | Boton Reintentar llama a `brand.refresh`. A20 |
| PUB-06 | Fallo de lectura de portada no tenia accion para recuperar | Boton Reintentar llama a `website.reload`. A21 |

En la API tambien se exige `published_profile` para resolver directamente un QR:
una sede incompletamente publicada no se vuelve visible por conocer una unidad.
Regresion nueva especifica, ademas de casos UI de sedes sin publicar.

## Setup real y limites de herramientas

Node `24.19.0`, pnpm `12.7.0` preinstalado en `.onboarding/tools`, Playwright
`1.63.0`, PostgreSQL `17.11` en contenedor propio con DB `b2b_anonymous_test` y
puerto `127.0.0.1:55439`. Cada proyecto tiene schema aleatorio, API, gateway,
proxy restringido y directorio de medios separado. No se usan las DB de desarrollo.
El teardown elimina solo schemas/directorios creados por este harness.

Chromium del sistema `154.0.8037.57`, HTTPS con CA efimera y excepcion limitada
al SPKI del certificado; `ignoreHTTPSErrors=false`. WebKit `26.6`, revision
Playwright `2359`: pruebas funcionales HTTP en dos hosts locales distintos.
La validacion HTTPS WebKit esta **BLOCKED**: rechaza la CA; `SSL_CERT_FILE` no
modifica su trust store. No se deshabilito TLS ni se instalo CA en el sistema.

Se descargaron WebKit y FFmpeg por el mirror alternativo que admitio el CDN;
los primeros mirrors devolvieron 403 Domain forbidden. Chromium bundled no se
pudo descargar; se uso el Chromium instalado. Las bibliotecas WebKit faltantes
se descargaron de Debian trixie y extrajeron en `.cache/qa-anonymous/libroot`:
`libgtk-4-1`, `libgraphene-1.0-0`, `libharfbuzz-icu0`, `libmanette-0.2-0`,
`libhyphen0`, `libgles2`, `libcairo-script-interpreter2`, `libhidapi-hidraw0`,
`libglvnd0`, `libopengl0`, `liblzo2-2`; tambien `gstreamer1.0-libav`,
`gstreamer1.0-plugins-good` y `gstreamer1.0-tools` para H.264/MP4. El launcher
versionado `scripts/qa-b2b-anonymous-webkit.sh` corrige la perdida de
`LD_LIBRARY_PATH` del launcher del bundle y ejecuta el mismo MiniBrowser.
El cache de medios de WPE usa `WPE_SHELL_MEDIA_DISK_CACHE_PATH` dentro del
workspace, evitando su default `/var/tmp` no escribible. TMP/XDG/GStreamer
tambien usan directorios propios. No se modificaron permisos, paquetes ni trust
store del host. Se comprobaron el plugin H.264 y playback real con avance de
`currentTime`, no solo `canPlayType`. El intento de
namespace aislado fallo con `setting up uid map: Read-only file system`; no se
escalo ni se cambio de entorno.

Los ensayos preliminares tambien corrigieron supuestos del harness: `/media`
no es `/me`, un redirect que elimina el fragmento puede terminar en `#`, y
`/g/%ZZ` se rechaza 400 antes de renderizar SPA. La perdida de respuesta usa
`route.fetch()` contra el backend real y `NODE_EXTRA_CA_CERTS` para que Node
valide esa misma CA local, sin desactivar verificaciones.

## Reproducir el escenario y revisar manualmente

En este Cloud, las dependencias y herramientas ya estan disponibles. Desde el
root, `source /workspace/.onboarding/activate.sh` selecciona pnpm 12.7.0.
En otro checkout usar Node 24+, pnpm 12.7.0, FFmpeg, Docker y dependencias del
lockfile: `pnpm install --frozen-lockfile`. No copiar `.env` ni cuentas reales.

```sh
# Un contenedor NUEVO exclusivo; elegir otro nombre/puerto si ya estan ocupados.
docker run -d --name klisteni-qa-anonymous-demo \
  -p 127.0.0.1:55439:5432 \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=b2b_anonymous_test postgres:17
# Esperar a que pg_isready confirme disponibilidad.
docker exec klisteni-qa-anonymous-demo pg_isready -U postgres
pnpm --filter @klisteniapp/b2b-web build
node scripts/b2b-wl-tls.mjs
```

La DB no tiene credenciales reales y solo se publica en loopback. El escenario
manual no requiere login. El harness genera secretos efimeros internos, no los
imprime y siembra unicamente personas y actividad ficticias.

```sh
# Terminal 1: scenario manual; dejar este proceso ejecutandose.
B2B_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55439/b2b_anonymous_test \
QA_WEBKIT_HTTP=true node scripts/qa-b2b-anonymous-server.mjs

# Terminal 2: restaurar normal u otro caso prefijado del proyecto 0 (Chromium 360).
curl -fsS -X POST 'http://127.0.0.1:4348/fixture?project=0&case=normal' -o /dev/null
```

Casos prefijados: `normal`, `hiddenBranch`, `archivedBranch`,
`unpublishedBranch`, `empty`, `hiddenUnit`, `archivedUnit`,
`unpublishedMachine`, `unpublishedRoot`, `noBranches`, `websiteOff`,
`equipmentOff`, `mediaOff`, `noExercises`. `mediaOff` esta disponible para demo,
pero no forma parte de la matriz ejecutada. Cada cambio restaura el fixture base
antes de aplicar el caso; no usar controles de fixture durante una suite activa.

Hosts `atlas.b2b.test`, `sur.b2b.test`, `alias.b2b.test` y `unknown.b2b.test` se
resuelven por proxies loopback, sin editar hosts/DNS. Proyecto 0/1/2 Chromium
usa proxy 4342/4344/4346; proyecto 3/4/5 WebKit usa 4350/4352/4354.
Para abrir una ventana Chromium ya configurada (necesita sesion grafica):
`node scripts/qa-b2b-anonymous-open.mjs --touch`, o sin `--touch` para desktop.
`--headless --touch` verifica la apertura y guarda `manual-open.png` en `.cache`.
El helper usa proxy/SPKI exactos; no instala confianza global ni publica un link.

```sh
# Terminal 2: matriz automatizada en este Cloud, con scenario de terminal 1.
NODE_EXTRA_CA_CERTS="$PWD/.cache/wl/tls/ca.crt" \
QA_WEBKIT_HTTP=true \
QA_WEBKIT_EXECUTABLE="$PWD/scripts/qa-b2b-anonymous-webkit.sh" \
QA_REUSE_SERVER=true \
pnpm --filter @klisteniapp/b2c-web exec playwright test \
  --config playwright.anonymous.config.ts

# Reporte y una traza elegida; usar el path exacto listado en resultados.
pnpm --filter @klisteniapp/b2c-web exec playwright show-report \
  ../../.cache/qa-anonymous/report
pnpm --filter @klisteniapp/b2c-web exec playwright show-trace /ruta/a/trace.zip
```

En una maquina con WebKit/CA disponibles, omitir `QA_WEBKIT_HTTP` y
`QA_WEBKIT_EXECUTABLE` para probar HTTPS tambien alli. Para Chromium solo,
seleccionar `--project=anonymous-chromium-narrow` (o `wide`/`desktop`).
Sin `QA_REUSE_SERVER=true`, Playwright construye la app y crea/elimina su propio
scenario; pasar la variable de DB al comando. La confianza CA de otra maquina
requiere su setup de pruebas autorizado, no un cambio de dominios publicos.

Checklist manual breve (fixture normal, navegador sin sesion):

1. Abrir Atlas y Sur, contrastar marcas y visitar Centro/Norte/Oeste; repetir
   a 360, 430 y 1440 CSS px (el helper tactil abre 360; la matriz cubre los tres). Leer horarios y contacto publicado de cada sede.
2. Entrar a Norte, abrir Polea 01 desde tarjeta y desde lista del plano. Recargar,
   volver y avanzar; verificar unidad y sede. Expandir/cerrar texto de instrucciones.
3. Usar "Ver el gimnasio", "Mi espacio" y "Ver este equipo en mi rutina";
   comprobar sede Norte y, para rutina, unit/machine en URL. El visitante ve login.
4. Revisar galeria de portada y sede, reproducir/pausar el clip sintetico,
   abrir la unidad de titulo largo. No pedir un visor/modelo/animacion.
5. Aplicar hidden/archived/unpublished branch o unit; confirmar ausencia de tarjeta,
   marcador y QR. Con `empty`/`noBranches` comprobar mensajes y acceso al login.
6. Cortar una lectura en DevTools y reintentar; probar validacion vacia/email
   invalido y credenciales inventadas. Ninguna visita debe registrar entrenamiento.
7. Abrir ambas marcas en pestañas y URLs ajenas/inexistentes; confirmar ausencia
   de contenido privado. Restaurar `normal` al terminar.

Detener el harness con SIGTERM/Ctrl-C y comprobar cleanup. Detener solamente
el contenedor ficticio creado para esta tanda; no tocar contenedores o volumenes
ajenos. El contenedor de QA no usa volumen persistente.

## Integracion entre roles y retorno para Atlas

Archivos compartidos que requieren revisar cherry-picks: API `service.ts` y
`white-label-service.ts`, web `App.tsx`, `BrandEntry.tsx`, `PublicGym.tsx`.
Las regresiones, config y helpers de esta tanda tienen nombres propios; no se
modificaron contratos, paquetes compartidos, CSS, modelos ni previews. Cambia
el contacto devuelto por un website/QR de sede: usa su perfil publico congelado;
la portada conserva el contacto general de marca.

Retorno para integrar despues en Atlas: registrar esta revision local y evidencia
como QA de visitante anonimo; seis defectos corregidos, suite API 80/80,
matriz de navegadores con protocolos explicitados y limites fisicos/TLS.
No sustituir snapshots de deploy del 11/10, ni declarar desplegados estos commits.
Conservar previews/Blender y backups recurrentes diferidos. Revisar en la sesion
de miembro la prevalencia de sede autorizada tras login desde QR: esta tanda
comprueba parametros/entrada anonima, no certifica la seleccion posterior al login.


## Resultados y evidencia final

Corrida final: `2026-10-13T10:51:54.398Z`, 662.871 segundos, 3 workers,
42 casos por proyecto, sin retries. Revision de corrida completa `435ef3a`. Check final detecto TS2352 en la
anotacion de una propiedad inyectada del test A33. Se corrigio en `128d332`
sin cambiar producto ni las comprobaciones: types/lint/formato finales PASS
y A33 repetido **6/6 PASS**. El JSON conserva ambos cortes de evidencia.
Cada prueba comprueba ausencia de desbordamiento horizontal y marcadores privados;
compara conteos/hashes de 11 tablas antes/despues. Ejecuciones y auditorias
permanecen en cero; 13 cuentas, cuatro sedes, seis unidades, cuatro asignaciones y
cinco medios son ficticios. Cero errores JS inesperados en la corrida final.
Los controles de fixture cambian solo su schema antes de establecer el baseline.
A24 usa una cookie ficticia vencida y verifica el visitante sin sesion; no
acredita expiracion de una sesion autenticada real mediante UI.

| Proyecto | Motor comprobado | CSS viewport | Touch / mobile | Transporte | Resultado |
| --- | --- | --- | --- | --- | --- |
| anonymous-chromium-narrow | 154.0.8037.57 | 360x800 | true / true | HTTPS | 42/42 PASS |
| anonymous-chromium-wide | 154.0.8037.57 | 430x932 | true / true | HTTPS | 42/42 PASS |
| anonymous-chromium-desktop | 154.0.8037.57 | 1440x1000 | false / false | HTTPS | 42/42 PASS |
| anonymous-webkit-narrow | 26.6 | 360x800 | true / true | HTTP | 42/42 PASS |
| anonymous-webkit-wide | 26.6 | 430x932 | true / true | HTTP | 42/42 PASS |
| anonymous-webkit-desktop | 26.6 | 1440x1000 | false / false | HTTP | 42/42 PASS |

Device scale factor por defecto 1, locale es-AR, timezone UTC, color claro,
reduced motion. A33 verifica pointerType touch mediante tap() en los cuatro
proyectos moviles y mouse en desktop. Otros casos usan clicks/teclado/history;
son contextos emulados sin identidad UA ni hardware de un telefono fisico.

| Check ejecutado | Resultado |
| --- | --- |
| Fetch en ambos repos | Limpios, paridad con origin/main, sin descartar trabajo |
| `pnpm lint` | PASS, boundaries + 14 tareas + formato B2B |
| `pnpm typecheck --concurrency=2` | PASS, 14 tareas |
| `B2B_TEST_DATABASE_URL=... pnpm test --concurrency=2` | PASS, 25 tests raiz + 14 tareas; API existente 76/76 |
| `pnpm --filter @klisteniapp/b2b-api test` con DB aislada | PASS 80/80 final, cuatro regresiones nuevas; cero omitidos |
| `pnpm build --concurrency=2` | PASS 16 tareas, warning de chunk grande preexistente |
| Types de config Playwright con tsconfig dedicado | PASS |
| Sintaxis Node/bash y formato helpers | PASS |
| Lint/types/formato de QA sobre `128d332` | PASS, tras corregir TS2352 del test |
| Reejecucion final A33 en seis proyectos | PASS 6/6 |
| Matriz Playwright final | PASS 252/252, 3 workers, sin retries/omitidos/flaky |
| Apertura helper `--headless --touch` | PASS, manual-open.png local; GUI manual NOT RUN |
| `pnpm previews:check` | FAIL PREVIO: yoga Extraction receipt is stale; receipt intacto |
| `pnpm check`, `check:all`, `check:release` completos | NOT RUN completos; no se declara verde el gate de previews |

La primera matriz completa previa al arreglo del setup obtuvo 221/228:
tres fallos de video por codecs/cache, tres esperas agotadas y un diagnostico
WPE de fetch cancelado. Preservada en `.cache/qa-anonymous/matrix-initial-results`
y `matrix-initial-results.json`. La siguiente se interrumpio para reparar
cache/temporales y esperar realmente la portada antes de afirmar ausencias en
casos negativos. No se agregaron retries ni se aflojaron asserts. La corrida
final repitio TODOS los casos en seis proyectos; video verifica avance de
currentTime. No se declara SLA de carga a partir de estos tiempos.

No quedan defectos reproducibles pendientes del rol en los casos ejecutados.

| Limite / pendiente | Estado | Motivo |
| --- | --- | --- |
| WebKit HTTPS con CA local | BLOCKED | Unacceptable TLS certificate; SSL_CERT_FILE no cambia el store; confianza global intacta |
| Telefonos / Safari real / QR impreso / camara | NOT RUN | Sin hardware; checklist manual posterior |
| Sonido y voces nativas reales | NOT RUN | Texto y fallback sin speech probados; audio audible no probado |
| Modelos/visores/previews | NOT RUN UI | Diferidos por alcance; archivos originales intactos |
| Login valido y seleccion posterior al QR | NOT RUN UI | Sesiones separadas por rol; entrada/parametros anonimos comprobados |
| Legacy GymEntry y fixture mediaOff | NOT RUN | Fuera de matriz marca blanca ejecutada |
| CI completo / merge / deploy | NOT RUN | Commits locales, gate de previews previo pendiente |

[Resumen textual de 252 casos](validation/b2b-anonymous-2026-10-13/summary.json)
conserva motores, viewports, protocolos, estados por flujo y recheck tactil final.
Las capturas, trazas, hashes por tabla y logs completos quedan locales en la rama
original y el paquete Git verificado del rol. Esta variante no agrega capturas,
trazas, datos reales, secretos ni blobs grandes de evidencia al remoto.
Se revisaron visualmente capturas representativas de ambos motores; las demas
pantallas se inspeccionaron por snapshots, asserts y trazas. No es revision humana
pixel por pixel ni comparacion visual de snapshots modificados.

Cleanup comprobado al cierre: **0 schemas b2b restantes** en la DB desechable,
proceso del harness detenido y contenedor propio `klisteni-qa-anonymous-20261013`
detenido. Evidencia/cache y checkout conservados. Para revisar, usar el escenario
y nuevo contenedor indicados arriba; no depende de un proceso dejado en segundo plano.

## Matriz completa de flujos

C = Chromium HTTPS; W = WebKit HTTP. Columnas por ancho CSS; capturas y trace.zip
por cada caso en la carpeta registrada en JSON. A10/A11 tienen cada fixture
como caso independiente.

| Flujo / fixture | C360 | C430 | C1440 | W360 | W430 | W1440 |
| --- | --- | --- | --- | --- | --- | --- |
| A01 Atlas and Sur show distinct brands and every public branch | PASS | PASS | PASS | PASS | PASS | PASS |
| A02 all four branch pages load with their published catalog and schedules | PASS | PASS | PASS | PASS | PASS | PASS |
| A03 navigation through branch catalog QR reload and browser history | PASS | PASS | PASS | PASS | PASS | PASS |
| A04 branch published contact differs from private profile drafts | PASS | PASS | PASS | PASS | PASS | PASS |
| A05 QR header login and return link preserve the unit branch | PASS | PASS | PASS | PASS | PASS | PASS |
| A06 QR routine entry retains unit machine branch and login context | PASS | PASS | PASS | PASS | PASS | PASS |
| A07 root-only published gallery loads real image bytes | PASS | PASS | PASS | PASS | PASS | PASS |
| A08 published branch media and video controls load and play | PASS | PASS | PASS | PASS | PASS | PASS |
| A09 floor plan marker opens the unit; failed image keeps the textual route | PASS | PASS | PASS | PASS | PASS | PASS |
| A10 hiddenBranch hides branch and QR without exposing private content | PASS | PASS | PASS | PASS | PASS | PASS |
| A10 archivedBranch hides branch and QR without exposing private content | PASS | PASS | PASS | PASS | PASS | PASS |
| A10 unpublishedBranch hides branch and QR without exposing private content | PASS | PASS | PASS | PASS | PASS | PASS |
| A10 websiteOff hides branch and QR without exposing private content | PASS | PASS | PASS | PASS | PASS | PASS |
| A11 hiddenUnit removes catalog entry QR and floor marker | PASS | PASS | PASS | PASS | PASS | PASS |
| A11 archivedUnit removes catalog entry QR and floor marker | PASS | PASS | PASS | PASS | PASS | PASS |
| A11 unpublishedMachine removes catalog entry QR and floor marker | PASS | PASS | PASS | PASS | PASS | PASS |
| A11 equipmentOff removes catalog entry QR and floor marker | PASS | PASS | PASS | PASS | PASS | PASS |
| A12 empty branch equipment and no published exercises have usable empty states | PASS | PASS | PASS | PASS | PASS | PASS |
| A13 unpublished organization website keeps branch navigation and login usable | PASS | PASS | PASS | PASS | PASS | PASS |
| A14 brand without published branches retains login and empty guidance | PASS | PASS | PASS | PASS | PASS | PASS |
| A15 invalid routes encoded slugs unknown gym branch and unit fail safely | PASS | PASS | PASS | PASS | PASS | PASS |
| A16 private media foreign brand URLs and auth-only endpoints are inaccessible | PASS | PASS | PASS | PASS | PASS | PASS |
| A17 unknown host and canonical alias redirects reject secret queries | PASS | PASS | PASS | PASS | PASS | PASS |
| A18 branch request failure response loss and retry recover without stale data | PASS | PASS | PASS | PASS | PASS | PASS |
| A19 cancelled slow branch response cannot replace a different route | PASS | PASS | PASS | PASS | PASS | PASS |
| A20 public context error offers a retry and recovers | PASS | PASS | PASS | PASS | PASS | PASS |
| A21 landing website request error can be retried | PASS | PASS | PASS | PASS | PASS | PASS |
| A22 login native validation wrong credentials and double submit stay anonymous | PASS | PASS | PASS | PASS | PASS | PASS |
| A23 login response loss leaves a retryable anonymous form | PASS | PASS | PASS | PASS | PASS | PASS |
| A24 every protected route shows login with expired synthetic cookies | PASS | PASS | PASS | PASS | PASS | PASS |
| A25 invalid invitation is safe and has no account side effects | PASS | PASS | PASS | PASS | PASS | PASS |
| A26 double activation of a branch link keeps one public context and no session | PASS | PASS | PASS | PASS | PASS | PASS |
| A27 all four branch QR units and long title stay readable and isolated | PASS | PASS | PASS | PASS | PASS | PASS |
| A28 published text instructions expand and collapse without loading a model | PASS | PASS | PASS | PASS | PASS | PASS |
| A29 two simultaneous brand tabs expose only their own public data | PASS | PASS | PASS | PASS | PASS | PASS |
| A30 keyboard skip link and normal brand route aliases remain usable | PASS | PASS | PASS | PASS | PASS | PASS |
| A31 foreign query parameters do not expose a workspace or switch the brand | PASS | PASS | PASS | PASS | PASS | PASS |
| A32 malformed percent encoding is rejected at the document gateway | PASS | PASS | PASS | PASS | PASS | PASS |
| A33 touch activation uses real touch pointer events in the mobile viewport | PASS | PASS | PASS | PASS | PASS | PASS |
| A34 unpublishing branch or brand revokes direct anonymous media access | PASS | PASS | PASS | PASS | PASS | PASS |
| A35 browser without speech retains the full published written instructions | PASS | PASS | PASS | PASS | PASS | PASS |
| A36 brand logo enters login and invitation account entry can be cancelled | PASS | PASS | PASS | PASS | PASS | PASS |
