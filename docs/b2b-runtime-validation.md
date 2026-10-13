<a id="validación-de-las-imágenes-b2b"></a>

# B2B image validation

Smoke runs production Dockerfiles/instance Compose, `NODE_ENV=production`, local
HTTPS. Fictional accounts/data; no demo/existing DB/volume/instance.

```sh
pnpm build:b2b
node scripts/b2b-runtime-smoke.mjs
```

Node 24+, Docker/Compose/OpenSSL/free image-layer/two disposable DB space. At least
2 GiB free; base downloads need more. Monitors/cancels below384 MiB. No connection
arguments/existing project names. Build frontends first; script reads current
`dist`, does not alter. Run after same-change checks/browser tests, no concurrent rebuild.

<a id="qué-verifica"></a>

## Checks

| Area | Automated evidence |
| --- | --- |
| Images | `docker/b2b-api/Dockerfile`, `docker/b2b-web/Dockerfile`; immutable IDs recorded |
| Migrations | Liveness before migration/readiness503; repeatable migration; auth-schema failure stays503 until API restart |
| Containers | Nonzero API/Nginx UID/read-only root/dropped capabilities/`no-new-privileges` |
| DB | Runtime role no superuser/DB-role creation/DDL; container lacks migration password |
| HTTPS/session | Ephemeral cert validated by specific local CA; Secure/HttpOnly/SameSite; foreign-origin/anonymous/other-gym rejection |
| Publication/media | >1 MiB PNG through Nginx; private before/after publication withdrawal; public SHA256/ranges |
| Inventory | Two same-model units/unit QR/exact batch replay without duplicates |
| Training | Real invitation/time-RPE prescription/version assignment/actual-target distinction/exact retry |
| Restart | Session/records/media bytes retained after API/Nginx restart |
| Restore | Quiesced `pg_dump`/media archive to separate project-DB-volume; migration/login/permissions/snapshots/execution/SHA256 |

<a id="orden-de-arranque-y-readiness"></a>

## Startup order and readiness

Production Compose starts API after successful migration. Other orchestrators:
migrate first, start/replace API afterward. Better Auth caches incompatible-schema
result; migrating externally does not repair already-started auth instance.
Restart API after migration. Smoke deliberately starts empty: `/healthz`200,
`/readyz`503 after table creation,200 only after restart. Both APIs check auth availability.

`apps/b2b-api/tests/readiness.test.ts`, `apps/b2c-api/tests/readiness.test.ts` reproduce
with PostgreSQL/two independent connections, preventing proxy routing to tables-ready
but authentication-broken process.

<a id="aislamiento-limpieza-y-resultado"></a>

## Isolation, cleanup and result

Random `klisteni-b2b-smoke-` prefix, two Compose projects/free loopback ports/fresh
secrets; second restore-only. TLS loopback only; no system trust certificate/global
TLS-validation disable. Historical local certificate setup is not permission to
introduce new browser bypass/trust changes in this language task.

On completion/failure/handled interruption: stop containers/remove own volumes-
image tags/keys/env files; verify no project containers/volumes remain. No global
prune/changes to previous instances.

Sanitized `.cache/b2b/runtime/<ejecución>/report.json`: passing checks/times/image
IDs/Git revision/dirty flag/backup sizes. Restrictive `diagnostics.private.log`
never publish. Dump/media transferred in memory, not retained as installation backups.

Failure nonzero/records stage; existing resources intact. Abrupt host stop/SIGKILL:
review only exact run project names before cleanup. Establishes local built-artifact
runtime, not public proxy-DNS/operational backups/real-load performance/physical QR/
exercise technique/3D authoring.

<a id="evidencia-del-11-de-octubre-de-2026"></a>

## October 11, 2026 evidence

[Recorded run](validation/b2b-runtime-2026-10-11.json): eight groups, independent
PostgreSQL/media restore/temporary cleanup. Production images/local HTTPS,
`B2B_DEMO_MODE=false`, real operator-created accounts.

JSON image IDs/times/temporary backup sizes; Git
`508e9e166e89b06c0a1d6ea4c2111a57ecc5af2e`, `workingTreeChanges: false`.
**10:45:59–10:47:39 UTC**, `cleanupComplete: true`. Evidence applies to that run's
artifacts, renew after code/dependency/frontend changes.
