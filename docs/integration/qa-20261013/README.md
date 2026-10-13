# Integración de las siete tandas QA — Klisteniapp

**Integración comprobada: 1164/1164 combinaciones PASS consolidadas en siete roles.** Estado por combinación e historial completo: [matrix.json](matrix.json); tabla legible: [flows.md](flows.md). Hay 828 casos con API/PostgreSQL, 120 contratos UI simulados y 216 recorridos de storage local. Los intentos fallidos siguen registrados. Rama publicada; PR draft bloqueado por revisión automática, pendiente de autorización explícita. No hay merge ni deploy.

## Fuentes y trazabilidad

Base común y `origin/main` verificados: `7172041102a8a7029af5fb3e2527a1fa51611a86`. Worktree independiente `/workspace/klisteni-integration-20261013`, rama `qa/klisteni-integration-20261013`. Código/harness final comprobado: `2822decd496bb51bf5ae1b2e321746c858ba0af7`; producto combinado de las siete fuentes: merge `4f903962094bcc7069891d7aba7ad8683544d44c`. Los commits posteriores cambian fixtures, pruebas y documentación; no agregan decisiones de producto.

| Rol | Rama fuente | SHA | PR |
| --- | --- | --- | --- |
| B2C autogestionado | codex/qa-b2c-selfservice-20261013 | 640ec502 | [2](https://github.com/pablitxn/klisteniapp/pull/2) |
| B2C administración | qa/b2c-admin-20261013-sol | 478bcfb2 | [3](https://github.com/pablitxn/klisteniapp/pull/3) |
| B2B entrenador | qa/b2b-trainer-20261013-cloud | ed53bbc4 | [4](https://github.com/pablitxn/klisteniapp/pull/4) |
| B2B socio | qa/b2b-member-20261013-session-b752 | bafb7bf6 | [5](https://github.com/pablitxn/klisteniapp/pull/5) |
| B2B anónimo | qa/b2b-anonymous-20261013-publicable | 32a80111 | [6](https://github.com/pablitxn/klisteniapp/pull/6) |
| B2C visitante | qa/b2c-visitor-local-20261013 | d35365c6 | [7](https://github.com/pablitxn/klisteniapp/pull/7) |
| B2B administrador de marca | qa/b2b-brand-admin-20261013 | a959fceb | [8](https://github.com/pablitxn/klisteniapp/pull/8) |

[sources.json](sources.json) conserva SHAs completos. Las siete fuentes son ancestros de la integración; se releyeron sus heads remotos y main antes de publicar. Se preservaron ramas/commits/PRs originales. Anónimo usa la variante publicable confirmada por el usuario: su evidencia binaria grande original sigue fuera de Git. No se usó reset, descarte ni rebase de trabajo ajeno. El checkout B2C original sigue limpio en `640ec502`.

Se leyeron `AGENTS.md`, roadmap y documentación del producto. Atlas: `sysadmin-workspace@27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`, de lectura; instrucciones, atlas-navigate, fuente de verdad y wiki de Klisteniapp. Para las fichas también se leyeron atlas-maintain, privacidad, runbook de intake, templates y enums. No se editó Atlas. Marca blanca y renames existentes se conservan implementados; modelos, previews y Blender siguen diferidos.

## Integración y correcciones

Los conflictos textuales fueron config Playwright demo y tsconfig B2C. Se conservó la unión de exclusiones de suites por rol y se incluyeron todos los `playwright*.config.ts` y E2E en tipos. Eso detectó un uso de `WebServerConfig` no exportado en el config B2C extra: se reemplazó por una guardia del array real de servidores.

Se revisaron las combinaciones que Git resolvió automáticamente: store B2C conserva export/import y eliminación durable del visitante junto con replay de yoga por lectura exacta; ProgramEditor conserva identidad estable y bloqueo de vuelta hasta ACK; Invitation combina consentimiento de identidad existente y actualización/limpieza del fragmento; progreso y QR conservan marca/sede/cuenta. Slug 409 atómico y publicación de medios/contacto se conservan juntos.

Correcciones de producto incorporadas, con sus regresiones originales y nueva cobertura integrada:

| Rol | Correcciones |
| --- | --- |
| Autogestionado | Retry de yoga tras commit perdido: confirma snapshot completo y cuenta antes de considerar exitoso el 409; conserva conflictos genuinos |
| Administración B2C | Capacidad hasta 10000; referencia síncrona evita doble emisión; colapso/cierre impide mostrar enlaces que llegan tarde |
| Visitante | Export de preferencias sin actividad, eliminación durable, recuperación explícita de copia corrupta con backup, semántica/accesibilidad y selector estrecho WebKit |
| Entrenador | Creación de rutina y asignación idempotentes tras respuesta perdida; payload/destino/versiones comparados |
| Socio | Progreso por sede, historial global explícito, QR con contexto autorizado, aceptación por identidad existente sin sobrescribirla |
| Anónimo | Contacto publicado por sede, medios publicados por referencias, sedes independientes del front page, QR/login/return/retry con contexto |
| Administrador B2B | Roster por marca y coaching por sede, slug 409, borradores/revisión de tema y sede, refresh de invitación, selectores móviles y bloqueo hasta ACK |

No se detectó un defecto de producto nuevo confirmado en la integración. Los fallos propios del setup y de las pruebas se conservaron y corrigieron:

- Proxy HTTP: Playwright `route.fetch` utiliza CONNECT también para HTTP. Sólo hosts ficticios permitidos en puerto 80 se reenvían al gateway loopback; HTTPS/hosts externos/otros puertos se rechazan. Ocho controles reales aprobados y guardia de DB remota aprobada.
- UUID: `.b2b.test` servido por HTTP no es un contexto seguro; falta `crypto.randomUUID`. El fixture opt-in genera UUID con `crypto.getRandomValues`. No eleva la confianza del origen ni cambia TLS/cookies; no es una corrección de producto ni una prueba de secure context.
- Tiempo Yoga: `clock.install` deja pasar tiempo real. Bajo carga WebKit registraba cuatro segundos cuando el guion asumía tres. Se pausa sólo cuando el diálogo ya se renderizó y se reanuda tras terminar; la aserción exacta de tres segundos y un único registro siguen intactas. Los seis perfiles se reejecutaron con éxito. El intento que pausó antes de cargar la UI y las colisiones posteriores de puerto también se conservan.
- Video WebKit: faltaba decoder H.264. `gstreamer1.0-libav`/tools se descargaron y extrajeron en `/workspace/.cache/qa-codecs`, sin instalación del sistema. Wrapper local con plugin/registro/cache propios; reproducción con avance de `currentTime` pasó 3/3, luego se repitieron los 126 casos WebKit anónimos.
- DB: una introspección de catálogo Kysely coincidió con DROP SCHEMA de tests unitarios y falló el arranque de una fixture. Se usó otra DB desechable para la repetición anónima. La introspección filtra el schema de destino; el fallo no demuestra cruce de datos. Para ejecuciones concurrentes, usar DB propia por rol además de schemas UUID.
- Build: ejecutar build global sobre el `dist` servido produjo un chunk PeoplePage 404 en un navegador ya abierto. El gateway de desarrollo ahora acepta `builtDirectory`; el fixture copia el build a un directorio temporal fijo antes de servirlo. Regresión real verifica que reemplazar el build compartido no elimina el chunk de la copia. El comportamiento por defecto y las fronteras de proxy permanecen comprobados.
- Navegación async: la pasada fija107/108 conserva un error WebKit al cancelar imports del documento que se estaba descargando (HAR: `Load request cancelled`, los mismos archivos luego200; sin404). El test leía un h1 genérico del shell antes de renderizar la sección. Ahora espera títulos específicos y contenido después de back/forward/reload; no filtra ni suprime errores JS. Inventario Atlas/Sur repetido8/8, 176 pantallas verificadas en cuatro perfiles.
- Opciones async: una aserción leyó destinatarios antes de terminar la carga. Se espera la opción exacta antes de comprobar todos los destinatarios y exclusión de otras marcas. No se aumentaron timeouts ni se omitieron aserciones.

Compartidos que requieren atención al integrar: `apps/b2c-web/src/lib/store.ts`, config/tsconfig y specs B2C; ProgramEditor, Invitation, Workspace/MemberWorkspace y estilos B2B; servicio/white-label-service y tests API; gateway local y nuevo fixture HTTP. El diff de integración no cambia modelos, manifests, capturas canónicas, scripts de previews ni lockfile.

## Matrices actuales y alcance real

| Rol | Casos por perfil | Perfiles | Último estado |
| --- | --- | --- | --- |
| B2C autogestionado | 41 core + 7 extra | 6 | PASS 288/288 consolidado; extras iniciales 39/42 y Yoga repetido 6/6 |
| B2C administración | 14 | 6 | PASS 84/84 en una corrida |
| B2C visitante | 18 demo + 18 instancia | 6 por modo | PASS 216/216 en dos corridas de 108 |
| B2B socio | 16 | 6 | PASS 96/96 en una corrida |
| B2B entrenador | 20 | 6 | PASS 120/120 en una corrida |
| B2B anónimo | 42 | 6 | PASS 252/252 consolidado: Chromium126 y nueva WebKit126; intentos previos conservados |
| B2B administrador | 27 | 4 | PASS 108/108 consolidado: corrida fija107/108 + inventario reforzado8/8; intentos106/108 y anteriores conservados |

Se completaron las 1164 combinaciones de flujo/perfil de esta matriz, con resultados consolidados; no es cobertura absoluta. B2C autogestionado distingue **168 casos con API/PostgreSQL reales** y **120 casos de contrato UI con transporte simulado** (`health`, `yoga-account`, `account-access`, `forgot-password`). Sus recorridos reales suplementan esas pantallas con persistencia, sesión, errores, import/export y replay. Visitante usa storage local por diseño. B2B y administración B2C usan backend real aislado; los errores y pérdidas de respuesta se inyectan deliberadamente. Las pruebas comprueban efectos persistidos cuando corresponde, no sólo HTTP.

Inventario de rutas/acciones previo a seleccionar casos: fuentes primarias de cada rol enlazadas en sus [siete fichas](fichas/), `apps/b2b-web/src/routes.ts`, Workspaces/features, App/navegación/store B2C. La [tabla completa](flows.md) incluye happy paths, vacíos, límites/validación, fallos/retry, doble click, cancelación, reload/back/forward, pérdidas antes/después de commit, expiración/revocación y aislamiento. Los inventarios originales mantienen sus no ejecutados, incluso rutas legacy y máximos no cubiertos; no quedan convertidos en PASS por esta integración.

### Motores, viewports y protocolo

Chromium sistema **154.0.8037.57**; Playwright WebKit **26.6, WPE Linux build2359**; Playwright1.63.0 y Node24.19.0. Son emulaciones de viewport/touch; no pruebas físicas de iPhone, Android o Safari/iOS.

| Rol | Móvil estrecho | Móvil ancho | Desktop | Motores |
| --- | --- | --- | --- | --- |
| Autogestionado | 360×800, DPR2 | 430×932, DPR2 | 1440×1000 | Chromium y WebKit |
| Administración B2C | 360×780, DPR1 | 430×932, DPR1 | 1440×1000 | Chromium y WebKit |
| Visitante | 320×740 | 430×932 | 1440×1000 | Chromium y WebKit, demo/instancia |
| Socio | 320×740 | 430×932 | 1440×1000 | Chromium y WebKit |
| Entrenador/anónimo | 360×800 | 430×932 | 1440×1000 | Chromium y WebKit |
| Administrador B2B | Chromium320×740 y WebKit390×844 | Chromium412×915 | Chromium1440×1000 | Matriz solicitada de cuatro perfiles |

Los perfiles móviles tienen `hasTouch/isMobile`; desktop no. Movimiento reducido. B2B fija locale es-AR y timezone UTC; B2C también prueba cambios de zona y contextos con zonas distintas. Todas las nuevas matrices usan **HTTP loopback**, B2B con proxies restringidos para orígenes ficticios distintos. `ignoreHTTPSErrors:false`; sin SPKI, trust/CA o `NODE_TLS_REJECT_UNAUTHORIZED` añadidos. Los configs futuros de los roles fueron endurecidos para no heredar las excepciones históricas. Las pruebas históricas de socio/admin B2B con excepciones de certificado no se reutilizan como validación TLS nueva.

**BLOCKED:** HTTPS con confianza válida y cookies Secure productivas en este setup. **NOT RUN:** hardware/cámara/QR impreso/Safari real, voz audible física, pagos/correos/OAuth reales, infraestructura/producción, aceptación de modelos/Blender/previews y los dos perfiles WebKit adicionales del administrador B2B. HTTP no acredita esos resultados.

## Checks sobre revisión final

Lint/tipos y 602 tests globales terminaron en `2822dec`; build16/16 y gateway5/5 en `06a13ee`. El cambio posterior es exclusivamente la espera de secciones en el inventario E2E, revalidada8/8. Los commits documentales no cambian el código probado:

| Comando | Resultado |
| --- | --- |
| `pnpm lint` | PASS boundaries + 14/14 tareas + formato B2B |
| `pnpm exec turbo run typecheck --concurrency=2` | PASS 14/14; todos los configs y E2E incluidos |
| `TEST_DATABASE_URL=… B2B_TEST_DATABASE_URL=… pnpm test --concurrency=2` | PASS **602**, cero fallos/omitidos: raíz26, contratos10, scene46, assets3, geometry33, domain9, catalog2, anatomy4, client17, ui2, react12, B2Bweb56, B2BAPI82, B2CAPI97, B2Cweb203 |
| `VITE_APP_MODE=instance KLISTENI_PUBLIC_PROFILE_FILE=instance-profile.example.json pnpm exec turbo run build --concurrency=1` | PASS16/16; warning previo de chunks grandes |
| `node --test scripts/b2b-gateway.test.mjs` | PASS5/5, snapshot fijo y fronteras existentes |
| Node syntax + `git diff --check` | PASS |
| Proxy real: cinco destinos HTTP rechazados, tres CONNECT rechazados; DB remota rechazada | PASS9/9 |
| `pnpm previews:check` | Exercise74 PASS, anatomía24 PASS; Yoga **FAIL PREVIO** receipt stale |

El mismo gate de previews se ejecutó en worktree separado `main@7172041`: mismos positivos y mismo fallo Yoga, con los inputs del diff sin cambios. No se regeneraron previews ni se falsificaron hashes/snapshots. `check`, `check:all` y `check:release` completos no se declaran verdes; no se ejecutó la batería GPU/modelos excluida. El último commit documental no cambia el código comprobado. CI remoto se registra en el recibo de publicación; ausencia de workflows/status no significa PASS. En el checkpoint remoto96cb839: cero check-runs y cero PRs para esta rama, confirmados tras el rechazo de creación del draft.

## GitGuardian

[Triage con evidencia](gitguardian-triage.md) y [contrato JSON](gitguardian-triage.json): incidente38163411/ocurrencia303868615, comentario del bot en PR3, commit `cf73bbc…`, `scripts/b2c-admin-fixtures.ts:11`. Constante sintética usada sólo por QA loopback/UUID-schema y excluida de imagen/startup productivos: **not_actionable** estático, candidato a falso positivo de fixture, supersediendo el checkpoint sin ubicación exacta. No se publican valores ni se cerró/suprimió la alerta. Reutilización fuera del repo no auditada; no se asume incidente productivo.

## Evidencia y reproducción

[evidence-manifest.json](evidence-manifest.json) identifica capturas/trazas por path, tamaño y SHA256; [matrix.json](matrix.json) conserva cada intento y último resultado. Los grandes binarios se mantienen locales, fuera de Git. Entrega local: `/workspace/shared/klisteni-integration-20261013/`, siete tar.gz con SHA256 en [archives.json](archives.json); ZIP pequeño de revisión y recibo remoto en esa misma carpeta. Los 3442 archivos del manifiesto incluyen capturas manuales y trazas de intentos anteriores. No se subieron binarios grandes ni se confirmó ninguna carga a Library. Abrir una traza con `pnpm exec playwright show-trace /ruta/a/trace.zip`. Las capturas inspeccionadas muestran UI real y sus estados, no sólo respuestas HTTP. No hay datos personales reales ni enlaces de activación productivos.

Para reproducir en otra máquina, usar Node24+, pnpm12.7 del repo, dependencias del lockfile y Chromium/WebKit instalados. Crear un PostgreSQL17 **desechable** ligado sólo a loopback; elegir credenciales ficticias localmente, sin utilizar `.env` real. Crear DB B2C de prueba y una DB B2B cuyo nombre contenga b2b/test por cada rol concurrente. Exportar `TEST_DATABASE_URL` y `B2B_TEST_DATABASE_URL` apuntando a ellas. No usar una DB existente con datos reales. Aquí se utilizó el container propio `klisteni-qa-b2c-20261013`, puerto54339; las fixtures crean schemas UUID y los limpian al cerrar.

```sh
# Core autogestionado: un schema/servidor por perfil; extra usa otros puertos.
node scripts/b2c-qa.mjs
B2C_QA_CONFIG=playwright.b2c-qa-extra.config.ts node scripts/b2c-qa.mjs
pnpm --filter @klisteniapp/b2c-web exec playwright test --config=playwright.admin.config.ts
VISITOR_INSTANCE=0 VISITOR_RUN=review-demo pnpm --filter @klisteniapp/b2c-web exec playwright test --config=playwright.visitor.config.ts
VISITOR_INSTANCE=1 VISITOR_RUN=review-instance pnpm --filter @klisteniapp/b2c-web exec playwright test --config=playwright.visitor.config.ts

# B2B: servidor API/gateway/proxy y schema propio por perfil, build fijo temporal.
# Elegir member, trainer, anonymous o brand-admin; no compartir DB durante migraciones.
QA_INTEGRATION_ROLE=member QA_INTEGRATION_PORT_OFFSET=1000 pnpm --filter @klisteniapp/b2c-web exec playwright test --config=playwright.integration-http.config.ts
```

Offsets usados: administrador0, socio1000, entrenador2000, anónimo3000; control4348+offset, proxies4342/4344/4346/4350/4352/4354+offset. Los gateways/API son4542+offset+2×perfil y puerto siguiente. `QA_INTEGRATION_USE_BUILT=1` reutiliza un build previamente comprobado; por defecto se construye y después se copia a la fixture fija. Linux Cloud usó `QA_INTEGRATION_CHROMIUM=/usr/bin/chromium`, `QA_INTEGRATION_WEBKIT=/tmp/b2c-qa-bin/webkit`; B2C usa sus variables `B2C_QA_*_PATH`, administración `KLISTENI_*_EXECUTABLE`, visitante `VISITOR_*_PATH`. El wrapper WebKit local resuelve librerías y codecs desde `.cache`, sin cambiar el sistema/trust. En otra máquina usar los motores normales instalados por Playwright; estas rutas Cloud no son portables.

### Checklist manual breve

Usar `--debug --project=<perfil> --grep='<flujo>'` con el config del rol: la fixture sigue viva mientras se inspecciona el navegador y el helper completa sólo credenciales sintéticas. Los tests también dejan preparaciones repetibles para sesión expirada, respuesta perdida, conflictos y cuotas; no hace falta introducir tokens reales ni enviar correos.

1. **Autogestionado:** activar fixture, entrar, nombrar/reordenar rutina, cambiar plan/zona, recargar, registrar fuerza/cardio y Yoga parcial. Reintentar Yoga tras respuesta perdida: un registro. Revisar salud/import con preview/cancelación y export; cambiar a cuenta expirada, conservar lectura/export y comprobar límites.
2. **Administración B2C:** filtrar/vacío, invitar ficticiamente, doble emisión, trial/lifetime, límite y revocación; colapsar durante respuesta demorada, comprobar que no reaparece el enlace.
3. **Visitante:** ejecutar demo e instancia por separado; onboarding/plan/zona, storage local, cancelar/registrar, export/import con confirmación. Inyectar cuota/corrupción: borrador/fila/copia original recuperables, sin escritura API.
4. **Socio:** QR de Norte, login contextual, sede correcta, dosis/alternativa y borrador; recargar y guardar tras pérdida de respuesta. Comparar progreso de sede con historial global; otra cuenta/marca no obtiene el borrador.
5. **Entrenador:** crear/publicar/asignar por sede; perder respuesta y reintentar: una rutina y una prescripción. Cambiar sede durante ACK tardío, revisar seguimiento/versiones y permisos revocados.
6. **Anónimo:** Atlas/Sur y cuatro sedes, contactos/galerías publicados, QR/login/return, oculto/archivado/despublicado, error/retry. Video sintético debe avanzar; ninguna visita escribe historial ni revela borradores.
7. **Administrador B2B:** personas por marca/coaching por sede, sede duplicada409, recuperar/comparar tema/sede, lote de dos unidades tras respuesta perdida, website y medios privados hasta publicación, publicar/asignar rutina; Volver bloqueado hasta ACK.

En revisión física posterior, repetir táctil/teclado, cámara/QR, audio y cambios de orientación en dispositivos reales; validar HTTPS/Secure con una instancia de prueba que tenga confianza válida. Esos resultados aún no existen.

## Retorno para Atlas pendiente

Las siete [fichas](fichas/) están en estado draft/predocumentación, con fuentes/SHAs, hechos/correcciones, decisiones explícitas, pruebas históricas separadas de la integración y pendientes. No son entries absorbidas ni otro protocolo de conocimiento. Consolidar después por `atlas/runbooks/intake.md`, templates source/entry y `atlas/catalog/sources.yaml`; conciliar wiki Klisteniapp, intake2026-10-12 y retroactive-documentation, manteniendo historia. Los destinos son los existentes. No escribir Atlas concurrentemente ni convertir rama/PR draft/pruebas locales en merge/despliegue.

## Publicación y bloqueo restante

La rama `qa/klisteni-integration-20261013` se creó sin force en el remoto y se verifica de nuevo tras el commit final. La creación del PR draft tuvo un único intento rechazado por revisión automática: considera vigente la instrucción «no publicar un PR todavía». No hubo workaround, reintento ni publicación incierta; lookup confirmó cero PRs. Se solicitó autorización explícita, pendiente al cierre. Los PRs2–8 siguen abiertos y main no se modifica. [Recibo del checkpoint](publication-checkpoint.json); recibo final fuera de Git con SHA exacto en la carpeta compartida.
