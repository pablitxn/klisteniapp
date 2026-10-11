# Operación de dominios B2B y validación local

Este procedimiento prepara una aplicación compartida; no configura DNS, certificados públicos ni producción. B2C conserva su API, secretos, base y cookies independientes. El modo anterior usa `B2B_WHITE_LABEL=false` (valor por defecto) únicamente mientras no haya dominios verificados/activos ni múltiples sedes. La API rechaza ese modo con `WHITE_LABEL_REQUIRED` cuando la base ya exige aislamiento por dominio/sede; volver al binario anterior no es un rollback seguro.

## Frontera de confianza

En marca blanca la API requiere `B2B_WHITE_LABEL=true`, `B2B_PROXY_SECRET` independiente (32 caracteres como mínimo), `B2B_TRUSTED_PROXY_ADDRESSES` con IPs exactas del proxy y `B2B_DOMAIN_PROTOCOL=https`. Las direcciones por defecto son exclusivamente loopback IPv4/IPv6. Una red Docker debe fijar la IP del proxy y declararla explícitamente; no se admite confiar en toda una subred ni en cualquier cliente que conozca un dominio.

El gateway termina TLS y reemplaza las cabeceras de identidad. La API compara el peer TCP y el secreto antes de interpretar `X-Klisteni-B2B-Host`; no confía en `Host`, `Forwarded`, `X-Forwarded-Host` ni `Origin` como selector de marca. `Origin` se compara después con el origen exacto de esa marca para las mutaciones. Las credenciales de proxy no se envían al navegador.

El registro se consulta en cada petición. Un host solicitado, sin verificaciones, pausado, desconocido o con certificado vencido falla sin organización de respaldo. También falla un alias cuyo principal ya no está activo. La API puede exponer health/readiness internos sin contexto de marca; el proxy público expone sólo su health y las rutas de aplicación previstas.

`docker/nginx.b2b.conf` supone un listener privado detrás de TLS. Reemplaza las mismas cabeceras. Su mapa de secreto vacío funciona exclusivamente en modo anterior: para una instalación marca blanca, generar un archivo protegido y montarlo como `/etc/nginx/b2b-proxy-identity.conf`:

```sh
# B2B_PROXY_SECRET ya debe existir en el entorno privado; no imprimirlo.
node scripts/b2b-proxy-secret.mjs .cache/b2b/proxy-identity.conf
```

El generador crea un archivo nuevo con permiso 0600; nunca sobreescribe uno existente. Hacerlo legible únicamente para el UID del contenedor durante el montaje privado. No incorporar ese archivo al build ni a Git. La API debe recibir el mismo secreto y la IP exacta del Nginx. No publicar su puerto directamente.

## Registro, verificación y activación

El operador usa su entorno privado y una conexión autorizada a la base B2B. No hay endpoint que permita a un administrador de gimnasio activar o transferir dominios. Ejemplos con hosts ilustrativos:

```sh
node --env-file=apps/b2b-api/.env apps/b2b-api/src/domain-operator.ts request atlas.example.test atlas-demo
node --env-file=apps/b2b-api/.env apps/b2b-api/src/domain-operator.ts verify atlas.example.test
node --env-file=apps/b2b-api/.env apps/b2b-api/src/domain-operator.ts activate atlas.example.test --primary
node --env-file=apps/b2b-api/.env apps/b2b-api/src/domain-operator.ts diagnose
```

`request` entrega el nombre y valor TXT de comprobación de propiedad. Antes de `verify`, configurar `B2B_DOMAIN_EXPECTED_ADDRESSES` con las IPs exactas del ingress, separadas por coma. La comprobación consulta el TXT, todas las direcciones A/AAAA y TLS con validación de nombre/CA. Cualquier dirección no esperada falla. Las redes CDN necesitan declarar sus destinos admitidos mediante operación explícita; no desactivar la comprobación porque cambió una IP.

`verify` conserva evidencia de DNS, fecha, vencimiento y huella del certificado. `activate` exige las tres verificaciones vigentes; un alias requiere un principal activo. Los certificados y las resoluciones locales de las suites son fixtures, no evidencia de propiedad real ni activaciones públicas.

## Principal, alias, pausa y transferencia

Dar de alta y verificar otro host, luego `activate NUEVO --primary`, cambia el principal de forma transaccional. El anterior permanece como alias verificado mientras conserve su estado activo. Cambiar el principal incrementa la generación de todos los dominios de esa marca, por lo que las sesiones previas deben autenticarse de nuevo. Los enlaces nuevos se generan desde el registro del principal, nunca desde cabeceras del cliente.

Los alias sólo redirigen navegación GET/HEAD segura. Los redirects limpian fragmentos y rechazan queries, rutas de autenticación/invitación y métodos de escritura. No trasladar un token de sesión o invitación a otro origen automáticamente. Un QR público sin secretos puede continuar por el alias; un QR cuyo dominio fue pausado debe reimprimirse o reactivarse tras verificarlo. Los enlaces de invitación deben entregarse de nuevo desde el origen canónico mediante su flujo autorizado.

```sh
node --env-file=apps/b2b-api/.env apps/b2b-api/src/domain-operator.ts pause atlas.example.test
node --env-file=apps/b2b-api/.env apps/b2b-api/src/domain-operator.ts reassign atlas.example.test sur-demo
```

La pausa conserva la propiedad reservada y revoca contexto inmediatamente; para reactivar se exige una verificación nueva. Si se pausa el principal, sus aliases tampoco resuelven. La transferencia exige primero pausa, borra las asociaciones de sesión, rota el desafío TXT y vuelve a estado solicitado. No permite que otra marca reclame automáticamente un dominio abandonado.

`diagnose` muestra fechas, generación y aviso `renew-soon` a menos de 14 días del vencimiento. Repetir `verify` tras renovación comprueba el certificado nuevo. Un fallo de verificación de un dominio activo lo pausa e invalida su generación. Para rollback a un principal anterior: comprobar DNS/TLS/propiedad de nuevo y ejecutar `activate ANTERIOR --primary`; nunca restaurar asociaciones antiguas de sesión. La consulta por petición hace innecesario reiniciar procesos para invalidar la caché del registro.

## Pruebas reproducibles

```sh
node --test apps/b2b-api/tests/config.test.ts apps/b2b-api/tests/domain-context.test.ts
node --env-file=.cache/wl/test.env --test apps/b2b-api/tests/domain-lifecycle.test.ts scripts/b2b-gateway.test.mjs
```

La segunda orden requiere una base desechable cuyo nombre contenga `b2b` y `test`, sin `options`; crea y elimina su propio schema. No usar credenciales de desarrollo/producción. Cubre verificación incompleta, alias, cambio de principal, pausa, transferencia explícita, vencimiento y rechazo de cabeceras falsificadas. Las pruebas del gateway usan puertos efímeros en loopback.

### Dos dominios HTTPS en navegadores reales

`scripts/b2b-wl-e2e-server.mjs` crea tres entornos aislados (Chromium escritorio, Chromium táctil y WebKit táctil), cada uno con su schema, API, gateway TLS y proxy CONNECT restringido. El navegador usa `https://atlas.b2b.test` y `https://sur.b2b.test` simultáneamente; el proxy de cada proyecto resuelve ambos al mismo gateway en loopback. No se cambia `/etc/hosts` ni se instala DNS. Las cookies usan sus dominios reales y `Secure`; no se simulan orígenes con cabeceras `Host` del cliente.

Preparar una CA desechable y certificado con SAN para los hosts de prueba:

```sh
node scripts/b2b-wl-tls.mjs
```

Todo el material queda bajo `.cache/wl/tls/`, ignorado por Git; claves privadas 0600 y validez de siete días. No regenerar mientras haya navegadores corriendo: el helper falla ante vencimiento próximo para exigir un nuevo ciclo de confianza. Chromium recibe una excepción limitada al SPKI exacto de ese certificado; `ignoreHTTPSErrors` permanece desactivado. La prueba de WebKit requiere confianza real en la CA. En el Linux verificado, las variables `SSL_CERT_FILE`, `CURL_CA_BUNDLE` y `WEBKIT_TLS_CAFILE_PEM` no modifican el almacén del bundle instalado; se comprobó primero que el navegador rechazaba el certificado y después que aceptaba la CA local.

Para WebKit, agregar únicamente la CA pública al almacén de la máquina de pruebas y retirarla al finalizar (requiere permisos de administración de ese host):

```sh
sudo install -m 0644 .cache/wl/tls/ca.crt /usr/local/share/ca-certificates/klisteni-wl-test.crt
sudo update-ca-certificates
node --env-file=.cache/wl/test.env apps/web/node_modules/@playwright/test/cli.js test --config apps/web/playwright.white-label.config.ts
sudo rm /usr/local/share/ca-certificates/klisteni-wl-test.crt
sudo update-ca-certificates
```

La configuración falla ante errores TLS: no usar `NODE_TLS_REJECT_UNAUTHORIZED=0` ni desactivar globalmente las comprobaciones del navegador. En CI, usar una imagen aislada con esta CA instalada durante la tarea y destruirla después. Evidencia y trazas quedan en `.cache/wl/browser-results` y `.cache/wl/browser-report`. No acredita dispositivos físicos ni un dominio/certificado público de producción.

## Capacidades de plataforma

El administrador de marca configura preferencias en el backoffice; sólo el operador modifica el techo de capacidades de la plataforma. Esta operación toma el mismo bloqueo de organización que las escrituras, valida el módulo registrado y deja auditoría sin secretos:

```sh
B2B_ORG_SLUG=atlas-demo B2B_MODULE=voice B2B_MODULE_ENABLED=false \
  node --env-file=apps/b2b-api/.env apps/b2b-api/src/operator.ts module-access
```

Los IDs iniciales son `website`, `equipment`, `floorPlan`, `media`, `voice`. La preferencia de sede y la de marca no elevan el permiso de plataforma. `floorPlan` requiere equipamiento y medios. Apagar una capacidad conserva datos y aplica su política de lectura/historial documentada en WL-0; no deshabilita autenticación, historial propio ni exportación.

## Ensayo de recuperación

```sh
B2B_WL_TEST_POSTGRES_CONTAINER=klisteni-b2b-db-1 \
  node --env-file=.cache/wl/test.env scripts/b2b-wl-restore.mjs
```

Requiere PostgreSQL de pruebas en loopback y permiso para crear dos bases temporales. Detiene las escrituras del origen sintético, crea un `pg_dump` completo, copia medios/configuración a recursos separados y restaura con `pg_restore --exit-on-error`. Comprueba IDs, concesiones, invitaciones pendientes, snapshots, temas, dominios, bytes de medios, login e historial propio. Elimina solamente sus bases y archivos temporales; el informe sanitizado queda en `.cache/wl/restore-report.json`. La configuración privada y el dump nunca se agregan a Git.

Para una recuperación real, primero detener escrituras y preservar DB/medios/configuración actuales; restaurar en recursos separados, verificar esta matriz y decidir cómo reconciliar escrituras posteriores al respaldo antes de cambiar el servicio. El ensayo sintético no contiene escrituras posteriores pendientes. Una reversión de tema sólo cambia identidad; no revierte migraciones ni permisos. API y frontend deben actualizarse juntos con migraciones 004/005, y las sesiones anteriores al modo por dominio requieren nuevo login.

## Imágenes compartidas: smoke local

Con los bundles de `member-web` y `backoffice` compilados, construir tags exclusivos de prueba y verificar el SHA esperado. La revisión siguiente corresponde a la ejecución registrada; para otra revisión, usar el mismo SHA en ambas imágenes y en el smoke:

```sh
docker build -f Dockerfile.b2b-api --build-arg OCI_REVISION=04d78368b6e0b6ac1ca74288dc9235145e563799 -t klisteni-b2b-api:wl-test .
docker build -f Dockerfile.b2b-web --build-arg OCI_REVISION=04d78368b6e0b6ac1ca74288dc9235145e563799 -t klisteni-b2b-web:wl-test .
B2B_WL_EXPECTED_REVISION=04d78368b6e0b6ac1ca74288dc9235145e563799 \
  node --env-file=.cache/wl/test.env scripts/b2b-wl-runtime-smoke.mjs
```

El harness usa un schema sintético propio, migraciones ejecutadas desde la imagen API, contenedores de sólo lectura sin capacidades y puertos efímeros vinculados exclusivamente a loopback. Un terminador TLS local conserva el host hacia el Nginx real de la imagen; éste reemplaza las cabeceras de confianza. Las solicitudes validan certificado/CA/SNI explícitamente, sin modificar el almacén de confianza del sistema.

La ejecución del 11/10/2026 pasó sus seis grupos de comprobaciones: migración, readiness, HTML/contexto/login/sesión con dos sedes por marca para Atlas y Sur, rechazo de cookies copiadas, y política de hosts desconocidos/alias/queries secretas en Nginx. Ambas marcas compartieron las mismas imágenes y procesos. Se eliminaron los contenedores, schema y archivos privados temporales; no se desplegó producción. Los tags locales quedan disponibles para inspección.

[Evidencia de imágenes](validation/b2b-white-label-images-2026-10-11.json) incluye IDs, revisión OCI comprobada, Node y Nginx. [Evidencia de navegadores](validation/b2b-white-label-browsers-2026-10-11.json) registra los 30 casos finales aprobados en Chromium escritorio/táctil y WebKit táctil, las revisiones por proyecto y la retirada de la CA temporal. Son navegadores con emulación táctil, no dispositivos físicos.
