# Validación de marca blanca B2B — 11/10/2026

Estado de este checkpoint: **WL-0 a WL-8 completados y verificados localmente**. Implementación en `codex/b2b-white-label`, base `af87f603876cb99b2e6673f290fa8ec03721454b`. La evidencia siguiente es nueva; no reutiliza resultados de `508e9e1`. Este checkpoint no desplegó producción ni regeneró previews diferidas. La autorización posterior y las pruebas sobre Atlas y Sur públicos están en el [checkpoint de despliegue](b2b-white-label-deployment.md).

## Checkpoints y alcance

| Etapa | Checkpoint | Resultado |
| --- | --- | --- |
| WL-0 | `a451d9c` | Inventario, permisos, módulos, migración, traslados y retención/exportación |
| WL-1 | `5fdf22d` | Contratos, migración 004, fixture con dos marcas y cuatro sedes |
| WL-2/WL-3/WL-7 | `d0a9011` | Dominios confiables, sesiones ligadas a marca, permisos por sede y operador DNS/TLS; migración 005 |
| WL-4/WL-5/WL-6 | `15660fd` | Login, selección de funciones/sedes, administración, temas publicados, módulos, historial y borradores aislados |
| Correcciones de integración | `a266ae4` | Puertos por defecto normalizados; editar website conserva plano deshabilitado sin autorizar modificarlo |
| WL-8 | `c451df2` | Harness HTTPS multi-host/multi-motor, imágenes locales y restauración completa |
| Preparación de imagen | `815142d`, `04d7836` | Formato del validador; inclusión del mapa público de proxy en el contexto Docker (sin secretos) |

Los informes JSON registran el SHA o el diff identificado. La primera corrida con cambios en curso fue interrumpida y detectó un fallo del cleanup de una prueba; no cuenta como aceptación. La pasada final completa se ejecutó por proyecto con builds nuevos: escritorio sobre `c451df2`, táctiles sobre `04d7836`. Entre ambos sólo cambió formato y la inclusión del mapa Nginx en Docker, sin diferencias funcionales de frontend/API. Los cambios posteriores de documentación no alteran los binarios.

## Topología y datos

Node 24.21.0, pnpm 12.7.0; PostgreSQL local de pruebas. Crear un archivo privado `.cache/wl/test.env` con `B2B_TEST_DATABASE_URL` de una base desechable cuyo nombre incluya `b2b` y `test`, sin `options`; nunca usar la base de la aplicación. Cada prueba de integración crea y elimina un schema independiente. El ensayo de restauración crea dos bases temporales completas. Ninguno usa tablas de las bases de aplicación de desarrollo o producción.

La fixture contiene Atlas (Centro/Norte) y Sur (Centro/Oeste), temas distintos y personal/socios independientes. Una identidad adicional tiene membresías en ambas marcas y funciones diferentes según sede. No hay dependencia de cuentas, sesiones, endpoints o base B2C.

Playwright sirve los dos hosts HTTPS desde el mismo gateway/API por proyecto: Chromium escritorio 1440×1000, Chromium táctil Pixel 7 y WebKit táctil iPhone 13. Proxies CONNECT locales resuelven los hostnames; no se cambia DNS público ni `/etc/hosts`. El navegador mantiene cookies `Secure` propias de cada host. Chromium confía sólo en el SPKI exacto de la fixture y WebKit en una CA temporal. `ignoreHTTPSErrors` permanece desactivado. La [guía de operación](b2b-white-label-runtime.md) explica preparación y retiro de confianza.

## Matriz D01–D19

La aceptación combina recorridos UI en los tres motores, peticiones HTTP reales y casos transaccionales sobre PostgreSQL. Los casos de concurrencia esperan bloqueos reales; los de medios ejercitan GET/HEAD/Range. Las tablas siguientes indican la prueba responsable, sin presentar una captura como evidencia de autorización.

| Caso | Evidencia automatizada |
| --- | --- |
| D01 | `white-label.spec.ts`: dos orígenes simultáneos, temas publicados y dos sedes antes del login; smoke de imágenes para ambos hosts |
| D02 | `domain-context.test.ts`, `b2b-gateway.test.mjs`, HTTP y navegador: desconocido/no verificado, peer/secreto/cabeceras falsificados, entrada directa y preflight de documento |
| D03 | Navegador: login socio/entrenador/admin, elección explícita y navegación por función; `/me` acotado |
| D04 | Navegador y HTTP: cuenta de Sur rechazada en Atlas, sin cookie autorizada ni divulgación de otras marcas |
| D05 | Navegador, autorización y sesión React: cuenta compartida, funciones distintas, persistencia validada sin elevar rol |
| D06 | HTTP, catálogo/inventario/training SQL y navegador: IDs de marca/sede/recurso, rol inválido y selección persistida rechazada |
| D07 | HTTP y autorización: cookie copiada, Origin cruzado, revocación de permiso/dominio y caducidad tras espera en cola; sesión React descarta respuestas tardías; logout entre pestañas en navegador |
| D08 | HTTP, migración y autorización: nueva/existente con consentimiento, usada/vencida, dominio equivocado, aceptación en cola tras pausa y alcance Principal de invitaciones antiguas |
| D09 | HTTP, autorización y navegador: publicación independiente de sede, perfil congelado, rutas de otra marca y website desactivado con login disponible |
| D10 | HTTP y autorización: medios privados y compartidos por referencia, URLs codificadas, GET/HEAD/Range, caché privada y medios de identidad invisibles hasta publicar |
| D11 | Workflow UI crea sede/concesiones; entrenador publica/prescribe, socio ejecuta y entrenador consulta en cada una de las cuatro sedes; SQL rechaza consultas no asignadas |
| D12 | Autorización y HTTP: retiro explícito antes de trasladar/archivar, acceso propio histórico sin acceso operativo, snapshots intactos y escritura en sede archivada rechazada |
| D13 | Workflow UI recupera rutina sólo al volver a su sede; unitarias de borradores cubren marca/sede/cuenta/rol, website sin fallback global, lotes y comparaciones |
| D14 | Navegador: temas distintos, preview privado, guardar/publicar/restaurar y reload; autorización valida revisión y contraste; metadata de preview no sustituye la publicada |
| D15 | UI, HTTP y autorización: módulos marca/sede/plataforma, dependencias y llamadas directas; plano retenido oculto permite textos pero rechaza cambios al plano |
| D16 | Ciclo de dominios, gateway, HTTP y navegador: principal/alias/pausa/transferencia, QR canónico, vínculo de unidad y redirects que no transfieren tokens |
| D17 | Workflow UI completo en Atlas Centro/Norte y Sur Centro/Oeste; API verifica reintento idempotente y conflicto de execution ID entre sedes |
| D18 | Migración 5/5 y ensayo `pg_dump`/`pg_restore`: base previa/vacía, backfill, invitaciones, IDs/snapshots; reinicio e inventario, temas, dominios, permisos, medios/configuración restaurados |
| D19 | Límites de paquetes, lint/tipos/tests globales, build y E2E demo B2C independiente; la suite WL queda excluida de la configuración E2E B2C |

Capturas revisadas de Chromium táctil: [Atlas](validation/b2b-white-label-atlas-touch.png) y [Sur](validation/b2b-white-label-sur-touch.png), misma superficie y datos sintéticos, con tipografía, geometría y paleta distintas. Las tablas anchas conservan desplazamiento horizontal.

Fuentes: [API](../apps/b2b-api/tests/), [E2E de dominios](../apps/web/e2e/white-label.spec.ts), [E2E de flujo](../apps/web/e2e/white-label-workflow.spec.ts), [gateway](../scripts/b2b-gateway.test.mjs), [sesión](../packages/b2b-react/tests/session-controller.test.ts).

## Ejecuciones y comandos

| Verificación | Resultado |
| --- | --- |
| Límites + lint/tipos serializados + formato B2B | Aprobado; pasada final combinada registrada en informe de calidad |
| `pnpm exec turbo run typecheck --concurrency=1` | 15/15 paquetes aprobados |
| Tests raíz de infraestructura/procedencia/gateway | 23/23 aprobados; no genera previews |
| `node --env-file=.cache/wl/test.env --test --test-concurrency=1 apps/b2b-api/tests/*.test.ts` | 76/76, sin omitidas |
| Autorización tras corrección de plano deshabilitado | 12/12, sin omitidas |
| Tests globales del workspace | 15/15 tareas aprobadas, 424 tests aprobados; omisiones PostgreSQL detalladas debajo |
| Suite HTTPS por proyecto con DB y CA de fixture | **30/30**, 10 por motor, sin retries/flakes/omitidas; [informe por caso y motor](validation/b2b-white-label-browsers-2026-10-11.json) |
| E2E B2C `demo.spec.ts` con build independiente | **3/3**, artefacto sin transports de cuentas/pagos/analytics, sin requests privados y exportación/restauración local |
| Imágenes API/web y Nginx local | **6/6**, revisión OCI `04d7836`, Node 24.21.0 y Nginx 1.30.5; [IDs SHA256 y controles](validation/b2b-white-label-images-2026-10-11.json) |
| Restauración DB/medios/configuración | 6/6 desde `5b27687` con árbol limpio; [informe sanitizado](validation/b2b-white-label-restore-2026-10-11.json) |

El [informe de calidad](validation/b2b-white-label-quality-2026-10-11.json) conserva resultados y hashes de logs. El contador global informa 11 tests omitidos y además 8 suites no ejecutadas por falta de variables de DB: la integración B2B se acredita con la ejecución dedicada 76/76, no con esos skips. No se ejecuta integración cloud/pagos/correo de B2C como parte de este cambio B2B.

Los comandos de navegador usan `B2B_TEST_DATABASE_URL` exclusivamente de pruebas. Para cargar el archivo privado sin mostrarlo:

```sh
node scripts/b2b-wl-tls.mjs
node --env-file=.cache/wl/test.env apps/web/node_modules/@playwright/test/cli.js test \
  --config apps/web/playwright.white-label.config.ts
# En hosts limitados, agregar --project=wl-chromium-desktop,
# --project=wl-chromium-touch o --project=wl-webkit-touch y ejecutar en serie.
# Preparar/retirar antes/después la CA de WebKit según la guía de operación.
B2B_WL_TEST_POSTGRES_CONTAINER=klisteni-b2b-db-1 \
  node --env-file=.cache/wl/test.env scripts/b2b-wl-restore.mjs
```

La CA temporal fue retirada del almacén de confianza, y se verificó la limpieza de schemas, procesos y contenedores de las suites. Los informes y capturas usan sólo datos sintéticos.

El smoke de imágenes usa tags locales `klisteni-b2b-api:wl-test` y `klisteni-b2b-web:wl-test`, identifica sus SHA256 y crea API/Nginx temporales en loopback. No publica imágenes ni cambia servicios activos. El ensayo de recuperación detiene escrituras sintéticas antes del backup; no hay escrituras posteriores que reconciliar. El informe conserva hashes/evidencia, nunca contraseñas, cookies, claves, dump o configuración privada.

## Límites vigentes

- Esta es aceptación automatizada y runtime HTTPS local. Safari/iPhone físico, WebGL en hardware, voces, QR impreso y piloto con personas siguen pendientes de su propia aceptación.
- No se configuró DNS/TLS de clientes ni se desplegó producción.
- Previews diferidas conservadas. `check`, `check:all`, `check:release` y CI mantienen sus gates y no se declaran aprobados.
- Restaurar un tema no revierte schema. Tras múltiples sedes o dominios activos, el modo legacy falla con `WHITE_LABEL_REQUIRED`; el binario anterior no constituye rollback seguro. Ver el [procedimiento de recuperación](b2b-white-label-runtime.md#ensayo-de-recuperación).
