<a id="operación-de-dominios-b2b-y-validación-local"></a>

# B2B domain operation and local validation

Shared-app procedure, not public DNS/certificate/production setup. B2C independent
API/secrets/DB/cookies. Legacy default `B2B_WHITE_LABEL=false` only without active-
verified domains/multiple branches; otherwise `WHITE_LABEL_REQUIRED`, old binary
unsafe rollback. Historical browser-certificate procedures below are preserved
evidence. **Current instruction: no new browser bypasses or trust changes; use
isolated HTTP loopback or valid HTTPS with existing trust for future runs.**

<a id="frontera-de-confianza"></a>

## Trust boundary

White-label requires B2B_WHITE_LABEL=true, independent B2B_PROXY_SECRET≥32,
B2B_TRUSTED_PROXY_ADDRESSES exact proxy IPs, B2B_DOMAIN_PROTOCOL=https. Default IPv4/
IPv6 loopback only. Docker fixed proxy IP/explicit declaration, no subnet-wide trust/
trust merely because client knows domain.

Gateway TLS/replaces identity headers. API TCP peer/secret check before
X-Klisteni-B2B-Host; Host/Forwarded/X-Forwarded-Host/Origin not brand selector.
Origin then exact-brand mutation check. No browser proxy credentials. Registry
per request; requested/unverified/paused/unknown/expired certificate rejects with
no fallback, alias rejects inactive primary. Internal API health/readiness may
lack brand; public proxy only own health/intended app paths.

`docker/nginx.b2b.conf` private listener behind TLS/replaces headers. Empty secret
map legacy only; white-label private protected /etc/nginx/b2b-proxy-identity.conf:

```sh
# B2B_PROXY_SECRET must already exist in the private environment; do not print it.
node scripts/b2b-proxy-secret.mjs .cache/b2b/proxy-identity.conf
```

New0600 file, never overwrite; private mount readable container UID only, no build/Git.
API same secret/exact Nginx IP, no direct public port.

<a id="registro-verificación-y-activación"></a>

## Request, verify and activate

Operator private env/authorized B2B DB, no gym-admin activation/transfer endpoint.
Illustrative hosts:

```sh
node --env-file=apps/b2b-api/.env apps/b2b-api/src/domain-operator.ts request atlas.example.test atlas-demo
node --env-file=apps/b2b-api/.env apps/b2b-api/src/domain-operator.ts verify atlas.example.test
node --env-file=apps/b2b-api/.env apps/b2b-api/src/domain-operator.ts activate atlas.example.test --primary
node --env-file=apps/b2b-api/.env apps/b2b-api/src/domain-operator.ts diagnose
```

request TXT name/value. Before verify, B2B_DOMAIN_EXPECTED_ADDRESSES comma-separated
exact ingress IPs; TXT/all A-AAAA/TLS hostname-CA, unexpected address fails. Explicit
CDN allowed destinations, no disabling due changed IP. Verify persists DNS/date/
expiry/fingerprint; activate three current verifications, alias active primary.
Suite cert/local resolution fixtures, not real ownership/public activation.

<a id="principal-alias-pausa-y-transferencia"></a>

## Primary, alias, pause and transfer

Register/verify new host, activate NUEVO --primary transaction. Old remains verified
active alias. Primary change increments brand domain generations, old sessions
reauthenticate. New links primary registry, never client headers. Aliases safe
GET-HEAD navigation only; clear fragment/reject queries/auth-invite paths/writes.
No automatic session-invite token transfer. Secret-free public QR through alias;
paused-domain QR reprint/reactivation after verify. Reissue invitation from canonical
origin authorized flow.

```sh
node --env-file=apps/b2b-api/.env apps/b2b-api/src/domain-operator.ts pause atlas.example.test
node --env-file=apps/b2b-api/.env apps/b2b-api/src/domain-operator.ts reassign atlas.example.test sur-demo
```

Pause reserves ownership/revokes context immediately; new verification for reactivation.
Primary pause blocks aliases. Transfer pause first/remove session links/rotate TXT/
requested state, no automatic abandoned-domain claim. diagnose dates/generation/
renew-soon<14days. Verify renewed cert; active failure pauses/invalidates generation.
Rollback primary: recheck DNS-TLS-ownership/activate ANTERIOR --primary, never old
session associations. Per-request registry invalidation needs no process restart.

<a id="pruebas-reproducibles"></a>

## Reproducible tests

```sh
node --test apps/b2b-api/tests/config.test.ts apps/b2b-api/tests/domain-context.test.ts
node --env-file=.cache/wl/test.env --test apps/b2b-api/tests/domain-lifecycle.test.ts scripts/b2b-gateway.test.mjs
```

Second needs disposable b2b/test DB/no options, own schema cleanup, no dev-production
credentials. Incomplete verification/alias-primary-pause-transfer-expiry/forged
headers; gateway ephemeral loopback ports.

<a id="dos-dominios-https-en-navegadores-reales"></a>

### Two HTTPS domains in actual browser engines

Historical b2b-wl-e2e-server three environments: desktop-touch Chromium/touch WebKit,
each schema/API/TLS gateway/restricted CONNECT. Simultaneous atlas.b2b.test/sur.b2b.test
same loopback gateway/project; no hosts/DNS. Actual per-host Secure cookies, not
Host-header origin simulation. Historical disposable SAN certificate setup:

```sh
node scripts/b2b-wl-tls.mjs
```

.cache/wl/tls Git-ignored/private keys0600/seven-day validity. No regeneration while
browsers active; near-expiry fails/new trust cycle. Historical Chromium exact-SPKI
exception/ignoreHTTPSErrors disabled; WebKit local CA trust. Verified Linux
SSL_CERT_FILE/CURL_CA_BUNDLE/WEBKIT_TLS_CAFILE_PEM did not change installed bundle
store; browser rejection then CA acceptance observed.

**Historical trust-change transcript, not authorization for future tests:** previous
WebKit run added public CA to test host store/removed it afterward with admin permission:

```sh
sudo install -m 0644 .cache/wl/tls/ca.crt /usr/local/share/ca-certificates/klisteni-wl-test.crt
sudo update-ca-certificates
node --env-file=.cache/wl/test.env apps/b2c-web/node_modules/@playwright/test/cli.js test --config apps/b2c-web/playwright.white-label.config.ts
sudo rm /usr/local/share/ca-certificates/klisteni-wl-test.crt
sudo update-ca-certificates
```

Config rejects TLS errors; never NODE_TLS_REJECT_UNAUTHORIZED=0/global browser
checks off. Historical CI used disposable CA image/destroyed afterward. Current
rule supersedes new trust installation/SPKI exceptions; adapt harness first.
Results .cache/wl/browser-results/browser-report, not physical devices/public production cert.

<a id="capacidades-de-plataforma"></a>

## Platform capabilities

Brand admin preferences in management; operator only platform ceiling. Organization
write lock/registered module validation/secret-free audit:

```sh
B2B_ORG_SLUG=atlas-demo B2B_MODULE=voice B2B_MODULE_ENABLED=false \
  node --env-file=apps/b2b-api/.env apps/b2b-api/src/operator.ts module-access
```

IDs website/equipment/floorPlan/media/voice; branch-brand preference no platform
escalation. floorPlan needs equipment/media. Disabled retains data/WL-0 read-history
policy, not auth/own history/export removal.

<a id="ensayo-de-recuperación"></a>

## Recovery rehearsal

```sh
B2B_WL_TEST_POSTGRES_CONTAINER=klisteni-b2b-db-1 \
  node --env-file=.cache/wl/test.env scripts/b2b-wl-restore.mjs
```

Loopback test PostgreSQL/two temporary DB creation. Quiesce synthetic source/full
pg_dump/separate media-config/pg_restore --exit-on-error. IDs/grants/pending invites/
snapshots/themes/domains/media/login/own history checked. Own DB/temp cleanup,
.cache/wl/restore-report.json sanitized; no private config/dump Git.

Actual recovery: quiesce/preserve current DB-media-config, restore separately/check
matrix/decide post-backup reconciliation before switching. Synthetic run has no
pending later writes. Theme rollback identity-only, no migration-permission rollback.
API/frontend coordinated004-005, pre-domain sessions new login.

<a id="imágenes-compartidas-smoke-local"></a>

## Shared images: local smoke

Historical member-web/backoffice bundles compiled, exclusive test tags/expected SHA;
new revision same SHA both images/smoke:

```sh
docker build --platform linux/amd64 -f docker/b2b-api/Dockerfile --build-arg OCI_REVISION=04d78368b6e0b6ac1ca74288dc9235145e563799 -t klisteni-b2b-api:wl-test .
docker build --platform linux/amd64 -f docker/b2b-web/Dockerfile --build-arg OCI_REVISION=04d78368b6e0b6ac1ca74288dc9235145e563799 -t klisteni-b2b-web:wl-test .
B2B_WL_EXPECTED_REVISION=04d78368b6e0b6ac1ca74288dc9235145e563799 \
  node --env-file=.cache/wl/test.env scripts/b2b-wl-runtime-smoke.mjs
```

Own synthetic schema/image migrations/read-only capability-free containers/free
loopback ports. Local TLS preserves host to actual Nginx, which replaces trust
headers. Explicit certificate-CA-SNI validation, no system store changes.
October11 six groups: migration/readiness/HTML-context-login-session/two branches
per brand/copied cookies/unknown-alias-secret queries. Shared images/processes,
container-schema-private cleanup, no production deployment; tags remain inspection.
[Image evidence](validation/b2b-white-label-images-2026-10-11.json) IDs/OCI/Node-Nginx;
[browser evidence](validation/b2b-white-label-browsers-2026-10-11.json)30 final cases/
project revisions/temporary-CA removal, emulation not physical devices.
