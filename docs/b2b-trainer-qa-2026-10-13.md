# QA B2B: entrenador de sede — 13/10/2026

Se corrigieron dos duplicaciones tras perder la respuesta del backend: crear una
rutina y asignarla a un socio. Los reintentos conservan una identidad estable,
incluso después de recargar, y el servidor comprueba contenido, autor y contexto.
Las versiones publicadas y los snapshots existentes no se reescriben. No hay
migración, merge, push, PR ni deploy en esta tanda.

**Cierre:** 20 flujos × 4 proyectos = **80 comprobaciones únicas PASS**.
Las tandas finales suman 86 ejecuciones (seis son revalidaciones de T01/T02),
sin fallos, flakes ni skips UI. WebKit usa HTTP loopback en el cierre.

## Revisión y contexto

| Elemento | Evidencia |
| --- | --- |
| Checkout inicial | Rama `work`, limpio, `7172041102a8a7029af5fb3e2527a1fa51611a86` |
| Actualización | `git fetch origin`; HEAD y `origin/main` iguales, divergencia `0 0`; no hacía falta fast-forward |
| Rama exclusiva | `qa/b2b-trainer-20261013-cloud` |
| Correcciones | `077f60790994b510fe0caa89e1c856dbaa793b77` |
| Checkpoint de QA | `147c7ef`; contiene suite, harness y demostración; el ajuste HTTP posterior se registra en el cierre |
| Atlas | `/workspace/sysadmin-workspace`, rama `work`, limpio, `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`; fetch sin divergencia |
| Instrucciones | `AGENTS.md` de ambos repos, `atlas/AGENTS.md` y `.agents/skills/atlas-navigate/SKILL.md` leídos |
| Fuentes de producto | `docs/b2b.md`, `docs/roadmap-implementacion.md`, documentación WL, implementación de rutas, frontend, contratos y API |

Atlas se consultó en lectura: política de fuentes, catálogos, relaciones,
`wiki/klisteniapp.md` y entry retrospectiva del 12/10. Su evidencia de despliegue
es histórica. El código owner confirma la implementación WL existente; no se
reabrió como producto nuevo. No se consultaron producción, GitOps, DNS, pagos,
correo, infraestructura remota ni datos reales.

El entorno no expone controles para comprobar o cambiar modelo, reasoning y
velocidad. No se afirma que esos ajustes de plataforma se hayan verificado.

## Inventario previo a la selección de casos

La app es `apps/b2b-web`; el entrenador trabaja dentro de `/manage`. El alias
`/backoffice` conserva compatibilidad. `Workspace.tsx` y
`managementPageAllowed` guardan la navegación; la API autoriza cada operación.

| Ruta/superficie | Acciones accesibles y límites | Cobertura |
| --- | --- | --- |
| `/login`, `/manage`, `/backoffice` | Login, logout, selección explícita de sede/función; acceso profesional | T01, T03, T10, T11, T16 |
| `/manage/programs` | Crear, editar, guardar/reabrir/recuperar/descartar borrador; ordenar/quitar movimientos; repeticiones/tiempo/carga/RPE/descanso/notas/alternativas; publicar; consultar versión; asignar/cancelar asignación; ver asignaciones | T02–T09, T12, T15, T16, T18–T20. Quitar un movimiento y los máximos de 100 movimientos/10 alternativas: NOT RUN por UI |
| `/manage/reports` | Totales, personas autorizadas, selector de socio, comparación planificado/realizado, parcial/completa, motivos y dosis históricas | T01, T02, T06, T11, T13, T14. Filtro entre dos socios con actividad distinta: NOT RUN |
| `/manage/people` | Consultar/buscar socios asignados; no invita, modifica roles ni asigna entrenadores | T01, T06, T07, T13 |
| `/manage/catalog` | Buscar/filtrar, crear ejercicio o variante, editar, recuperar, revisar y publicar contenido autorizado; consultar biblioteca | T01, T12. Se usa contenido textual ficticio. Variantes de plantillas y sus conflictos de editor: NOT RUN en esta tanda |
| `/manage/equipment` | Consultar equipos/unidades y recursos; administración configura/publica. Biblioteca de modelos y enlaces QR visibles según contenido | Consulta T01; mutación rechazada T07. Modelos/visor/previews y descarga/escaneo QR: NOT RUN por alcance |
| `/manage/media` | Listar/buscar/refrescar biblioteca, subir imagen/video/GLB, abrir archivo; reutilización desde editores | Imagen y búsqueda/persistencia/aislamiento T17; vídeo, GLB, comparación de clips y selección de medio en ejercicio: NOT RUN |
| `/manage/preparation`, `/brand`, `/website`, `/qr`, `/whiteLabel` | Secciones de administrador: entrenador recibe pantalla de falta de permiso | T01 con URL directa |
| `/app` y cambio a función socio | Selector cambia al espacio propio de ese rol; un socio no entra en gestión | T03. La UI de entrenamiento del socio no se toma en ownership |
| Website, ficha pública y `/app/invite` | Superficies públicas/invitación, fuera del circuito profesional de esta tarea | NOT RUN; las cubre su sesión independiente |

Retirar una asignación desde `/assignments/:id/retire` requiere administrador.
No existe acción de retiro para entrenador en esta UI; no se agregó una decisión
nueva de producto. Revocación de permiso y de acompañamiento se sembró como
fixture administrativa, sin editar esa UI.

## Entorno y límites de navegador

Node `24.19.0`, PostgreSQL `17.11`, pnpm efectivo `11.25.0`, Playwright `1.63.0`. El repo pide
pnpm `12.7.0`. El wrapper local ubica las cachés en `/workspace/.cache` y evita
la reinstalación automática del package manager, cuya ruta inicial fallaba;
no modifica el lockfile ni los manifiestos. Dependencias de aplicación ya
materializadas. PostgreSQL en Docker, base **ficticia y desechable**
`klisteni_b2b_trainer_test`, sólo `127.0.0.1:55433`.

Un schema, API, gateway y directorio temporal de medios por proyecto. Cada caso
crea nombres/IDs únicos; las fixtures de revocación/pausa se restauran con
`finally`. El cierre elimina solamente schemas creados por ese runner. La base
B2C no se lee ni se modifica. El rate limiter real de login permanece activo;
los 429 esperan su ventana de reintento, sin rebajar el gate.

| Proyecto | Motor exacto | Viewport CSS | Entrada y alcance |
| --- | --- | --- | --- |
| C360 | Chromium del sistema `154.0.8037.57` | 360×800, táctil, `isMobile` | HTTPS Atlas/Sur, proxy 4362, certificado sintético con SPKI exacto |
| C430 | Chromium `154.0.8037.57` | 430×932, táctil, `isMobile` | HTTPS, proxy 4364 |
| C1440 | Chromium `154.0.8037.57` | 1440×1000, sin touch | HTTPS, proxy 4366 |
| W390 | WebKit `26.6`, bundle `2359` | 390×844, táctil, `isMobile` | Cierre HTTP de desarrollo: Atlas `localhost:4468`, Sur `127.0.0.1:4468`; sin proxy ni confianza TLS añadida |

Esto es emulación de navegador, **no prueba física de iPhone/Android**.
WebKit ancho y desktop, Firefox, hardware móvil y escaneo físico: **NOT RUN**.

La descarga de Chromium empaquetado fue rechazada por la red (403); se usó el
Chromium instalado. WebKit descargó por el fallback estándar. Sus bibliotecas
faltantes se extrajeron en el workspace y se enlazaron al bundle local: no se
instalaron paquetes ni se modificaron permisos del sistema. No se usó un flag
para desactivar requisitos de host en los recorridos finales; el ejecutable
seleccionado arrancó y renderizó las páginas reales.

**WebKit TLS en el host: BLOCKED** por CA sintética no confiable. Antes de la
indicación posterior de no instalar una CA, 18 recorridos HTTPS pasaron en un
contenedor desechable Debian con almacén propio; el host nunca recibió esa CA.
Se retiró el contenedor ante la indicación y se conservó esa evidencia como
antecedente separado. El cierre usa HTTP loopback, mantiene
`ignoreHTTPSErrors: false`, y no acredita cookies Secure ni validación TLS para
WebKit. El primer HTTP `.test` no habilitaba `crypto.randomUUID`; el setup se
corrigió a orígenes loopback, sin cambiar el producto ni banderas de seguridad.

## Matriz de flujos

PASS exige controles visibles y lecturas persistidas donde corresponde. FAIL es
defecto reproducido; BLOCKED es límite del entorno; NOT RUN es caso no ejecutado.
La sesión del socio sólo se usa para crear sus registros ficticios mediante API.

| Caso | Flujo | C360 HTTPS | C430 HTTPS | C1440 HTTPS | W390 HTTP |
| --- | --- | --- | --- | --- | --- |
| T01 | Navegación, seis secciones, rutas protegidas, reload/back/forward | PASS | PASS | PASS | PASS |
| T02 | Dosis por reps/tiempo/RPE, alternativas, orden, v1/v2, historial parcial/completo | PASS | PASS | PASS | PASS |
| T03 | Recuperación y cancelación; aislamiento cuenta/sede/función | PASS | PASS | PASS | PASS |
| T04 | Edición simultánea en dos pestañas y conflicto real 409 | PASS | PASS | PASS | PASS |
| T05 | Carga 503/reintento y escritura rechazada sin perder borrador | PASS | PASS | PASS | PASS |
| T06 | Seguimiento/socios vacíos y cancelación de asignación | PASS | PASS | PASS | PASS |
| T07 | Recursos ajenos, socio no asignado y mutaciones prohibidas | PASS | PASS | PASS | PASS |
| T08 | Asignación: respuesta perdida, reload y doble clic sin duplicación | PASS | PASS | PASS | PASS |
| T09 | Rutina nueva: respuesta perdida, reload y replay único | PASS | PASS | PASS | PASS |
| T10 | Sesión expirada, limpieza de datos y recuperación de copia | PASS | PASS | PASS | PASS |
| T11 | Revocación de permiso de sede bloquea guardado y cambia contexto | PASS | PASS | PASS | PASS |
| T12 | Revisar/publicar ejercicio; retiro bloquea nueva asignación y preserva snapshot | PASS | PASS | PASS | PASS |
| T13 | Revocar acompañamiento oculta datos sin borrar versiones | PASS | PASS | PASS | PASS |
| T14 | Servicio pausado conserva lectura y bloquea mutaciones | PASS | PASS | PASS | PASS |
| T15 | Respuesta tardía no lleva copia ni notice a otra sede | PASS | PASS | PASS | PASS |
| T16 | Autoría/publicación/asignación en dos marcas y cuatro sedes | PASS | PASS | PASS | PASS |
| T17 | Imagen: formato inválido, upload persistido, búsqueda y aislamiento | PASS | PASS | PASS | PASS |
| T18 | Límites numéricos y doble clic de guardado/publicación | PASS | PASS | PASS | PASS |
| T19 | Publicación con respuesta perdida: 409 y v1 sin v2 | PASS | PASS | PASS | PASS |
| T20 | Edición con respuesta perdida: recuperación explícita de revisión aceptada | PASS | PASS | PASS | PASS |

T02 verifica snapshots de v1 después de editar/publicar v2 y registra por API
una ejecución completa y otra parcial, con sustitución y RPE. El entrenador
consulta las pantallas reales y comprueba columnas de dosis, ausencia de series,
motivo y persistencia tras reload. En móvil la tabla tiene scroll horizontal:
se verificó desplazamiento DOM y captura de la columna de alternativa, sin
presentarlo como gesto físico de un teléfono.

T19 no oculta la incertidumbre de publicación: una respuesta perdida muestra
error, el replay con revisión antigua devuelve 409 y reload revela v1; no crea
v2. T20 resuelve de forma explícita la revisión ya aceptada, preservando la copia
local. No se agregaron reintentos automáticos de mutaciones no idempotentes.

## Defectos corregidos y pendientes

| Defecto | Reproducción y efecto anterior | Corrección/regresión |
| --- | --- | --- |
| D1: creación duplicada | Guardar nueva rutina; backend acepta; cortar respuesta; reintentar: dos filas distintas con igual contenido | `Idempotency-Key`, identidad del nuevo borrador recuperable por cuenta/sede/rol; replay exacto devuelve la rutina existente. T09 + API + editor/client tests |
| D2: prescripción duplicada | Confirmar asignación; cortar respuesta después del commit; reintentar: dos asignaciones para el socio | Identidad pendiente por cuenta/sede/rol/programa/versión/socio; sobrevivencia a reload; backend compara autor y destino/version. T08 + API + client tests |

La API acepta la clave opcional sólo en creación de programa/asignación. Los
callers viejos sin clave conservan su contrato; no se afirma idempotencia de
todas las mutaciones. Un replay con datos diferentes devuelve 409, conserva la
copia local y pide revisar la lista. Cambios de actor/contexto no revelan ni
alteran el recurso. Se comprueba además una única fila y auditoría por envío,
y replay de una asignación ya aceptada después de retirar contenido del catálogo.

[Conteos e IDs ficticios observados](validation/trainer-2026-10-13/bugs.json),
[duplicación de asignación anterior](validation/trainer-2026-10-13/assignment-response-loss-before.png)
y [asignación después de corregir](validation/trainer-2026-10-13/assignment-response-loss-after.png).
No quedan otros defectos de producto confirmados en los casos ejecutados.
Los casos NOT RUN y WebKit TLS BLOCKED mantienen sus límites propios.

Los fallos intermedios de harness (201 esperado como 200, sede sin seleccionar
en nueva pestaña, fixture propia con rol socio, rate limiter, selector estricto
con dos motivos iguales, hostname HTTP sin contexto seguro y registro local
incompleto) fueron diagnosticados y corregidos. No cuentan como siete o más
defectos de producto. Los snapshots visuales existentes no se editaron.

## Verificación de código y evidencia

| Comando | Resultado |
| --- | --- |
| `pnpm lint` | PASS: boundaries, 14 tareas y formato B2B |
| `pnpm typecheck` | PASS: 14 tareas, incluye nueva suite E2E |
| `B2B_TEST_DATABASE_URL=… pnpm test` | PASS: 14 tareas; API B2B 77/77 sin skips. B2C API 17 pass/1 skip por ausencia de DB B2C, fuera de alcance |
| `B2B_TEST_DATABASE_URL=… pnpm test:b2b:api` | PASS: 76/76 inicial; 77/77 tras la corrección |
| `pnpm build` | PASS: 16 tareas, ambas webs y APIs; advertencia previa de chunks mayores de 500 kB |
| `tsc … --types node playwright.trainer.config.ts` | PASS: comprobación independiente del config |
| `node --check scripts/b2b-trainer-{e2e-server,demo}.mjs` | PASS |
| Chromium principal | 54/54, T01–T18 en tres viewports HTTPS |
| Chromium cierre dirigido | 12/12, T01/T02/T19/T20 en tres viewports HTTPS |
| WebKit HTTPS anterior, contenedor retirado | 18/18; evidencia histórica de esta sesión, no gate TLS del host |
| WebKit HTTP final | PASS: 20/20, incluyendo T19/T20 y scroll de alternativas |
| Demo `node scripts/b2b-trainer-demo.mjs --smoke` | PASS: sembró dosis por tiempo/reps, alternativa y dos ejecuciones; vio dos tarjetas en seguimiento |
| `git diff --check` | PASS en el cierre documental |

No se ejecutaron generación/validación de previews, `pnpm check` completo,
`check:release`, E2E B2C ni gates remotos. La excepción de previews no declara
verde el gate completo. Los checks globales usaron caché de Turbo cuando su hash
coincidía; los cambios relevantes de API, cliente, editor y E2E se ejecutaron.

Resultados JSON, capturas por caso, trazas y reportes HTML quedan en
`.cache/trainer/{chromium,final-chromium,final-webkit-http}/`. La evidencia
seleccionada está versionada en `docs/validation/trainer-2026-10-13/` y el
manifiesto de cierre registra rutas, hashes, revisiones y resultados. Las
trazas completas contienen únicamente sesiones ficticias locales; se conservan
en el workspace ignorado por Git, sin publicarlas en un servicio externo.

## Levantar el escenario y revisión manual

Desde la raíz, con Node 24, dependencias instaladas y pnpm. Los valores siguientes
son exclusivamente de demostración; no reutilizar credenciales de una instancia.

```sh
docker run -d --name klisteni-b2b-trainer-manual \
  -e POSTGRES_DB=klisteni_b2b_trainer_test -e POSTGRES_USER=trainer_qa \
  -e POSTGRES_PASSWORD=local-trainer-fixture-only \
  -p 127.0.0.1:55433:5432 postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
export B2B_TEST_DATABASE_URL='postgresql://trainer_qa:local-trainer-fixture-only@127.0.0.1:55433/klisteni_b2b_trainer_test'
node scripts/b2b-wl-tls.mjs
pnpm build:b2b
TRAINER_WEBKIT_HTTP=1 node scripts/b2b-trainer-e2e-server.mjs
```

En este workspace ya existe el contenedor QA en ese puerto: usarlo o detenerlo
antes de crear otro; no ejecutar un reset sobre una base ajena. En otra terminal:

```sh
TRAINER_CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/b2b-trainer-demo.mjs
# Omitir TRAINER_CHROMIUM_EXECUTABLE si se usa el Chromium instalado por Playwright.
```

El lanzador abre una ventana táctil 390×844, autentica únicamente la cuenta
ficticia del entrenador, siembra el programa **Demostración entrenador · tiempo
y repeticiones** y dos registros ficticios vía una sesión separada del socio.
Permanece abierto para revisión. `--smoke` verifica la misma preparación,
guarda `.cache/trainer/manual-demo.png` y cierra. No agrega confianza al sistema.
La fixture incluye Centro/Norte de Atlas y Centro/Oeste de Sur; los correos
terminan en `.example.test`. Contraseña sintética del harness:
`browser-tests-only-password-2026`; no hay credenciales reales ni emails enviados.

Checklist manual:

1. En Seguimiento, abrir las dos tarjetas de demostración. Comparar v1, 12/9
   repeticiones, 45/38 segundos, RPE objetivo/real, alternativa y filas sin registro.
   Desplazar horizontalmente las tablas en móvil.
2. En Rutinas, crear una rutina con ambos objetivos, alternativa y nota; guardar,
   publicar v1 y asignar al socio ficticio. Editar/publicar v2 y comprobar que el
   registro histórico de v1 no cambia.
3. Editar sin guardar, navegar a Personas y volver; recuperar el borrador.
   Recargar y recuperarlo otra vez. Cambiar a Norte: no debe aparecer la copia
   de Centro. Volver a Centro para recuperarla.
4. Abrir una segunda pestaña, elegir Centro/Entrenador y editar la misma rutina.
   Guardar en la segunda; guardar desde la primera debe mostrar conflicto sin
   pisar datos. Elegir explícitamente conservar o descartar su copia.
5. Consultar Personas y Equipamiento; probar una URL de administración directa.
   El entrenador no debe recibir formularios de marca, invitación, roles o unidades.
6. Para respuesta perdida, revocación y expiración reproducibles usar T08–T11,
   T13, T19 y T20 de la suite: el harness simula el caso después del commit y
   comprueba filas persistidas. No pausar una cuenta real para la demostración.

Ejecutar las pruebas del rol:

```sh
NODE_EXTRA_CA_CERTS="$PWD/.cache/wl/tls/ca.crt" \
TRAINER_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
TRAINER_WEBKIT_HTTP=1 \
pnpm --filter @klisteniapp/b2c-web exec playwright test \
  --config playwright.trainer.config.ts
```

Si se usa el WebKit local de este Cloud, agregar
`PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright` y
`TRAINER_WEBKIT_EXECUTABLE=/workspace/.cache/ms-playwright/webkit-2359/pw_run.sh`.
El config inicia su backend salvo que se indique expresamente
`TRAINER_REUSE_SERVER=1` para reutilizar **este mismo harness propio** ya iniciado.
No ejecutar dos runners con los mismos puertos. `TRAINER_RESULTS_ROOT` permite
conservar resultados separados. No instalar una CA en el host para estos casos.

Ctrl-C en el server elimina sus schemas/medios temporales. El contenedor de base
puede detenerse después de cerrar todos los runners. Al recrear el escenario se
siembran fixtures nuevas; los datos de esta tanda no son datos de aplicación.

## Integración y retorno para Atlas

Archivos compartidos que requieren coordinar cherry-picks: `apps/b2b-api/src/http.ts`,
`src/training/index.ts`, `src/training/repository.ts`, la regresión API WL,
`packages/b2b-client/src/client.ts`, `transport.ts` y su test. Editor/Programs,
programDraft y editorModels son propios del circuito, aunque también los usa el
administrador. Los nuevos archivos de QA son independientes. No se tocaron
modelos, previews, snapshots visuales existentes ni UI de socio/administración.

Resumen para intake posterior de Atlas: revisión local de entrenador desde
`7172041`, dos duplicaciones corregidas en `077f607`, fixtures de dos marcas y
cuatro sedes, UI Chromium móvil/desktop y WebKit emulado; TLS del host WebKit
permanece bloqueado y el cierre usa HTTP loopback. Gates locales y aceptación
manual/física/producción son estados separados. La KB quedó intacta; no se
actualiza evidencia histórica de deployment, backups, previews o integraciones.
