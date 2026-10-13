# QA B2C autogestionado — 13 de octubre de 2026

## Revision y limites

Inicio y origin/main de app: `7172041102a8a7029af5fb3e2527a1fa51611a86`.
Rama: `codex/qa-b2c-selfservice-20261013`. Fix en `5ab2729b2e0097bb1be63b3f317003c974545bfb`; ampliacion QA en `87ae036bd92e228370094e5ec072b0b1442f7481`. Los dos checkouts estaban limpios;
`git fetch origin` no encontro commits nuevos para fast-forward.
Atlas consultado: `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`, rama `work`, limpio.
Atlas queda sin escrituras. Ver [inventario previo](inventory.md), [matriz de flujos](flows.md) y [resultados por caso](results.json).

Backend real B2C, PostgreSQL 17.11 en contenedor dedicado sobre loopback 54339,
base `klisteni_qa`, schemas UUID desechables distintos por cada ejecucion.
No SMTP, proveedor de pagos ni datos reales. API 4182, frontend instance 4181.
Las cuentas `*@accounts.test` y las passwords de la suite son exclusivamente
fixtures publicos. Las lecturas `/api/me/state` y los exports verifican el estado
persistido; [observacion SQL](database-observation.json) acredita la DB local.
Cada API se elimina junto a su schema al terminar; el contenedor queda disponible.

UI ejecutada con Playwright 1.63.0, Node 24.19.0, Debian 13. Chromium del sistema
154.0.8037.57 y WebKit Playwright 26.6 (build 2359). Perfiles tactiles emulados,
no pruebas fisicas de iPhone/Android ni Safari de un dispositivo Apple.
Automatizacion mayormente por click, sin certificar gestos, teclado virtual ni hardware movil. Movimiento reducido; se abortan GLB para probar fallbacks y evitar trabajo de 3D.
No se modificaron modelos, previews, snapshots visuales existentes ni gates.

Los casos heredados a veces cambian el viewport a 390x844 y luego 1440x1000;
los segundos dispositivos usan viewports explicitamente declarados en el spec.
Por eso cada proyecto identifica el **viewport inicial**, no todos los pixeles
durante cada recorrido. Los casos nuevos mantienen el viewport del proyecto.
Los tests de salud y conflictos de yoga heredados simulan transporte; la matriz
marca aparte esos casos. Billing usa fixtures sandbox, nunca Mercado Pago real.

## Resultados de navegador

| Motor | Viewport inicial CSS | Tactil / DPR | Casos unicos finales |
| --- | --- | --- | --- |
| Chromium 154.0.8037.57 | 360x800 | si / 2 | 48 PASS |
| Chromium 154.0.8037.57 | 430x932 | si / 2 | 48 PASS |
| Chromium 154.0.8037.57 | 1440x1000 | no / 1 | 48 PASS |
| WebKit 26.6 / 2359 | 360x800 | si / 2 | 48 PASS |
| WebKit 26.6 / 2359 | 430x932 | si / 2 | 48 PASS |
| WebKit 26.6 / 2359 | 1440x1000 | no / 1 | 48 PASS |

288 combinaciones finales caso/perfil: 41 casos de la primera ronda y 7 adicionales
por perfil. Ademas, escritura activa reejecutada 6/6 y capturas/recarga de salud
reejecutadas 3/3 tras esperar el fin del lazy loading. No se cuentan esos rechecks
como flujos nuevos. Los 7 extras usan API real; su reloj de yoga usa Playwright
Clock para verificar 3 segundos registrados y excluir la pausa, sin esperar tiempos
largos ni inferir exactitud en un telefono fisico.

La ronda adicional registra errores de navegador. Los errores de fetch de GLB
abortados expresamente se guardan como esperados por path; Chromium dice
`Failed to fetch` y WebKit `Load failed`. Cualquier otra excepcion falla el test.
No se promete cero errores de GLB ni certificacion del renderer excluido.

## Checks y problemas de setup

| Comando | Resultado |
| --- | --- |
| `pnpm lint` | PASS: boundaries, 14 tareas y formato B2B; nueva UI QA tambien lint directo |
| `pnpm typecheck` | PASS: 14 tareas; configs y tests nuevos tambien typecheck directo |
| `TEST_DATABASE_URL=... pnpm test` | PASS: 534 tests, 10 SKIP de integracion B2B sin su DB; B2C API 97/97, B2C web 198/198 |
| `VITE_APP_MODE=instance KLISTENI_PUBLIC_PROFILE_FILE=instance-profile.example.json pnpm exec turbo run build --concurrency=1` | PASS: 16/16 tareas |
| `node --check scripts/accounts-e2e-server.ts` y `node --check scripts/b2c-qa.mjs` | PASS |
| Playwright default `--list` | PASS: 83 casos demo; nuevos specs instance excluidos del config demo |
| `git diff --check` | PASS |
| `pnpm check` / `check:all` / `check:release` completos y public demo GPU E2E | NOT RUN: previews/modelos diferidos y fuera de este alcance |

Linea base anterior al fix: 30/30 en Chromium escritorio, registrada en
[baseline](baseline-desktop.json). El fallo de B2C-01 se reprodujo despues al
ampliar los escenarios. No hubo otros fallos de producto en los recorridos finales.
No se confunden errores de selector del arnes con regresiones: select de series,
menu movil, labels wrapping, cancelaciones duplicadas y rate limiter compartido
se corrigieron en los tests usando acciones/roles reales e IPs de documentacion
por caso. Se conserva el limiter, sin ampliar cuotas. El primer build instance
fallo porque faltaba el perfil publico obligatorio; el build configurado aprobo.
Las descargas y libs de navegador se repararon dentro del workspace, descritas
abajo. Los logs originales quedan en el paquete de evidencia.

## Correccion

**B2C-01 — respuesta perdida al editar yoga (corregido).** El PUT confirmaba
la edicion en PostgreSQL pero el navegador perdia su respuesta. Al reintentar,
409 refrescaba el estado y mostraba la edicion propia como cambio remoto;
Guardar quedaba deshabilitado y se ofrecia una copia innecesaria.

Ahora, ante 409, se consulta el estado con la misma cuenta y se reconoce solo
el snapshot completo de yoga exactamente igual al enviado. Se publica la revision
confirmada y se cierra el editor. Una version distinta, consulta fallida o cambio
de cuenta conserva el conflicto. Los snapshots historicos no se reescriben.

Archivos de producto: `apps/b2c-web/src/lib/store.ts`. Regresiones en
`test/yoga-store.test.ts` y `e2e/b2c-selfservice.spec.ts` con respuesta abortada
**despues** de `route.fetch()` (commit real). Antes: fallo reproducido y captura
[yoga antes](yoga-response-loss-before.png); despues: una sola practica y nombre
historico conservado, [yoga despues](yoga-response-loss-after.png).

Otros archivos modificados son fixtures, configuracion, runner y adaptacion de
selectores de navegacion para elegir el menu visible en movil/escritorio. No hay
cambios de producto B2B ni paquetes compartidos. Para integracion con otros roles,
revisar especialmente `scripts/accounts-e2e-server.ts` y los specs de cuentas;
`store.ts` pertenece al B2C pero puede coincidir con otra rama B2C.

## Reproduccion automatizada

Requisitos: Node 24+, pnpm, Docker, dependencias del lockfile y Chromium/WebKit
Playwright con sus bibliotecas. Desde la raiz:

```sh
# Solo si ese nombre no existe. No borrar contenedores/volumenes ajenos.
docker run -d --name klisteni-qa-b2c-20261013 \
  -p 127.0.0.1:54339:5432 \
  -e POSTGRES_PASSWORD=qa-local-only -e POSTGRES_DB=klisteni_qa \
  postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
docker exec klisteni-qa-b2c-20261013 pg_isready
pnpm --filter @klisteniapp/b2c-web exec playwright install chromium webkit
TEST_DATABASE_URL=postgres://postgres:qa-local-only@127.0.0.1:54339/klisteni_qa \
  node scripts/b2c-qa.mjs
# Opcional: un perfil por invocation
TEST_DATABASE_URL=postgres://postgres:qa-local-only@127.0.0.1:54339/klisteni_qa \
  node scripts/b2c-qa.mjs webkit-narrow
```

El runner acepta exclusivamente una DB de loopback, genera API/schema separados
por invocation y conserva los fallos. Artefactos por defecto `/tmp/klisteni-b2c-qa`;
`B2C_QA_ARTIFACTS` permite elegir otro directorio. `B2C_QA_CHROMIUM_PATH` y
`B2C_QA_WEBKIT_PATH` permiten usar ejecutables locales verificados.

En este Cloud se usaron `/tmp/b2c-qa-bin/pnpm` (pnpm 11.25.0 disponible, con
`manage-package-manager-versions=false`, `verify-deps-before-run=false` y
`XDG_DATA_HOME=/workspace/.cache/xdg`) y `/usr/bin/chromium`.
El Chromium Playwright no se descargo: su CDN devolvio 403. WebKit se descargo
por el mirror alternativo. Sus libs Debian se extrajeron en
`/workspace/.cache/webkit-libs`, sin cambiar permisos ni librerias del sistema.
El wrapper `/tmp/b2c-qa-bin/webkit` configura las libs reales con LD_LIBRARY_PATH
porque el wrapper del paquete las reemplaza. Se comprobo apertura y DOM de
WebKit 26.6 antes de ejecutar casos; las aserciones de UI no se omiten.

Comando exacto Cloud de esta tanda:

```sh
PATH=/tmp/b2c-qa-bin:$PATH XDG_DATA_HOME=/workspace/.cache/xdg \
  B2C_QA_CHROMIUM_PATH=/usr/bin/chromium \
  B2C_QA_WEBKIT_PATH=/tmp/b2c-qa-bin/webkit \
  TEST_DATABASE_URL=postgres://postgres:qa-local-only@127.0.0.1:54339/klisteni_qa \
  B2C_QA_ARTIFACTS=/tmp/b2c-final node scripts/b2c-qa.mjs
```

La ronda adicional es independiente y usa frontend 4195 y API 4196:

```sh
# Con el mismo entorno y las variables de navegador del comando anterior:
B2C_QA_CONFIG=playwright.b2c-qa-extra.config.ts \
  TEST_DATABASE_URL=postgres://postgres:qa-local-only@127.0.0.1:54339/klisteni_qa \
  node scripts/b2c-qa.mjs
```

`B2C_QA_GREP` permite reejecutar un caso por titulo. Cada invocacion sigue usando
un schema desechable independiente. Ejemplo: `B2C_QA_GREP='paid fixture can write'`.

## Levantar escenario para revision manual

Fuera de la suite automatica (no compartir puertos 4181/4182):

```sh
# Terminal 1, raiz del repo; Ctrl-C elimina solo el schema generado.
B2C_QA_FIXTURES=1 \
  TEST_DATABASE_URL=postgres://postgres:qa-local-only@127.0.0.1:54339/klisteni_qa \
  node scripts/accounts-e2e-server.ts
# Terminal 2
cd apps/b2c-web
VITE_APP_MODE=instance KLISTENI_PUBLIC_PROFILE_FILE=instance-profile.example.json \
  KLISTENI_API_URL=http://127.0.0.1:4182 \
  node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4181 --strictPort
```

Abrir `http://127.0.0.1:4181`. Password de **todas las cuentas ficticias**:
`Only-for-browser-tests-2026!`. `qaplan@accounts.test` tiene trial y datos vacios;
`qaactive@accounts.test` tiene acceso pagado simulado; `expired@accounts.test`
tiene trial vencido e historial; `lifetime@accounts.test` tiene acceso vitalicio;
`qayogaloss@accounts.test` tiene una practica y un snapshot historico.
Para generar una invitacion de prueba, `admin@accounts.test` abre Cuenta y
planificacion → Usuarios e invitaciones; no marcar envio por email.
Nunca trasladar estas passwords ni fixtures a una instancia real.

Checklist manual breve:

1. En 360 y 430 px, entrar con QAPlan; copiar rutina, timezone Kiritimati y dias;
   probar nombre vacio, zona invalida y cero dias; reload y comprobar lo guardado.
2. Personalizar a una serie, completar fuerza con repeticiones propias; abandonar
   otra sesion y comprobar que no se concede historial. Registrar cardio y export.
3. En QAYogaLoss editar la practica, contrastar el historial anterior. Para el fallo
   de respuesta exacto usar el spec automatizado; modo Offline antes del PUT
   prueba otro fallo (no acredita commit previo).
4. En Mi salud guardar medida, editar/cancelar/eliminar; revisar import preview y
   confirmar con template ficticio; descargar cuenta y comprobar JSON.
5. En Expired comprobar lectura/export/eliminacion y limites de guardar; cerrar
   sesion y comprobar modo local sin arrastrar datos privados.
6. Dos ventanas/perfiles: cambiar password, comprobar revocacion de la otra sesion,
   entrar con otra cuenta y confirmar que no ve la salud/historial anterior.
7. Revisar tab/teclado, scroll del modal, atras/adelante desde privacidad y reintento.
   Repetir en telefono fisico propio; la tanda automatica no lo reemplaza.

## Evidencia conservada

Capturas seleccionadas y resultados estan en este directorio. El paquete completo
(555 archivos, capturas, trazas, reportes y logs) queda en
`/workspace/shared/b2c-qa-20261013.tar.gz`; [hash y tamano](archive.json) y
[manifest de archivos](evidence-manifest.json). Las trazas contienen solamente
cuentas/tokens/cookies ficticios de schemas eliminados. No hay enlaces ni datos de
activacion productivos. Los schemas de navegador se limpiaron: conteo final cero.
El contenedor PostgreSQL local queda disponible para levantar el escenario manual.

## Retorno para Atlas (lectura; pendiente de integrar)

Klisteniapp B2C instance probado localmente sobre el baseline `7172041` mas esta
rama. B2C-01 corrige recuperacion de edicion yoga; no cambia B2B, despliegues,
marca blanca, modelos ni previews. Mantener separadas evidencia local nueva y
los releases historicos de Atlas. Previews/Blender/backups recurrentes siguen
con sus decisiones previas. No se verificaron CI, DNS, runtime publico ni servicios
externos. Incorporar este informe y SHA final como fuente fechada despues de
integrar las ramas, sin afirmar despliegue ni prueba fisica.
