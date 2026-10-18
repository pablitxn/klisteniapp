# WP12 matching runtime and transport receipt v2

Date: 2026-10-17. Status: **matching runtime and synthetic full-stack HTTP ready**.
This amends the runtime/transport blockers in [v1](../v1/report.md), preserving
that published evidence unchanged. Parent retains orchestration and merge authority.

| Input | Immutable revision / artifact |
| --- | --- |
| Application base | `d65261d18de4522fb9a66104aabb5750104fb8b8` |
| Plan | `447d77ebb5587e319018e7b56003f0ef7299bb6c` |
| Previous published WP12 head | `d8b048c93b390a0e241f5bc48a8887283ce73829` |
| Probe source commit | `4e76766e2b04f785a7a170bbc58c41e7abc70229` |
| Official image digest | `sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27` |
| Task runtime directory | `/workspace/wp12-runtime-v2` |

Parent explicitly authorized task-local official package/image acquisition and
synthetic full-stack transport preparation after the v1 delivery. No dependency
head is assumed accepted by this amendment; no application feature/seed/config
or shared manifest lease is taken. The original 108-obligation inventory and
88 reserved feature browser scenarios remain unchanged and blocked on dependencies.

## What is now proven

The exact official Playwright 1.63.0 image downloaded successfully from
`mcr.microsoft.com`, and isolated `@playwright/test`, `playwright` and
`playwright-core` 1.63.0 packages downloaded from `registry.npmjs.org`. All three
package integrities match the unchanged application pnpm lockfile. The official
v1.63.0 seccomp profile was downloaded through verified HTTPS from
`raw.githubusercontent.com`; its SHA-256 matches the existing reviewed profile.
No registry/download policy block remains. An initial npm default-cache ENOENT
was resolved with a cache under the task runtime directory, without permission
or persistent environment changes.

The official image supplies Node 24.20.0 and matching Chromium 153.0.8010.12 /
WebKit 26.6. Both browser engines ran the synthetic app at 320x740 and 430x932
touch/mobile plus 1440x1000 desktop. Evidence:

| Engine | Matrix cases passed | Failed | Skipped | Check groups passed |
| --- | ---: | ---: | ---: | ---: |
| [Chromium](chromium.json) | 3 | 0 | 0 | 21 |
| [WebKit](webkit.json) | 3 | 0 | 0 | 21 |

An additional isolated toolchain check executed task-local pnpm 12.7.0 as UID
1001 with Node 24.20.0 and Playwright 1.63.0, matching the app's declared tools.
Its packages/cache also remain outside the application and installed helpers.

The 42 groups exercised real browser-to-server HTTP requests for:

- Unauthorized GET, session POST and HttpOnly/SameSite cookie delivery.
- Frontend input/POST, JSON body and unchanged same-origin Host/Origin transport.
- Offline failure, reconnect and no phantom server write.
- Accepted POST with a lost response, exact replay and changed-payload 409.
- Two-tab PATCH with exactly one acceptance/one 409 and stable earlier receipt.
- HEAD without a body, response headers and byte-range 206.
- Foreign-Origin denial with no write, DELETE 204 and subsequent GET 404.

These are generic `/transport/*` synthetic protocol checks, not B2B DTOs,
authentication product acceptance, weekly adherence or workout/consent test
results. The probe is a tiny in-memory app and does not connect to PostgreSQL.
Product feature browser tests executed: **0**. The original **88 remain blocked**.

## Isolation and preservation

The browser and synthetic HTTP server run together in one container; the server
binds to `127.0.0.1` on an ephemeral port. `--network none` disables external
networking, with no host relay or published port. The old GET/HEAD relay was not
broadened. Only the public task-owned runtime directory is mounted read-only;
there are no secret, host socket or application-private mounts.

Both engines run as `pwuser` UID 1001 with no-new-privileges and zero effective
capabilities in the probe process. Chromium explicitly sets
`chromiumSandbox: true`, and an observed browser-process check rejects a
`--no-sandbox` argument. Both use the official seccomp profile and existing Docker
default capability bounding set. WebKit retains nonroot container isolation;
this is not an assertion of Chromium-equivalent sandboxing or physical Safari/iOS.

All requests use local HTTP with `ignoreHTTPSErrors: false`; no TLS verification
exception, trust modification or host security change was made. The synthetic
HTTP cookie intentionally is not Secure. Trusted HTTPS/Secure-cookie acceptance
remains a separate gate, rather than being inferred from HTTP transport success.

The task containers and in-memory servers were removed. The matching image and
isolated package cache are retained for this task's later acceptance. No saved
environment publication or cross-task cache persistence is claimed. Application
lockfile and selected pinned 1.62 helper hashes match their before values; v1
evidence and shared manifests are byte-preserved. Details are in
[runtime-receipt.json](runtime-receipt.json).

## Reproduction and owner handoff

[Runtime probe and instructions](../../../../../apps/b2c-web/e2e/fixtures/b2b-product/runtime-v2/README.md)
provide the immutable image, exact package versions/integrities, profile hash and
cached-image-only sequential run commands. The actual successful commands were:

```sh
bash apps/b2c-web/e2e/fixtures/b2b-product/runtime-v2/run-probe.sh /workspace/wp12-runtime-v2 chromium
bash apps/b2c-web/e2e/fixtures/b2b-product/runtime-v2/run-probe.sh /workspace/wp12-runtime-v2 webkit
node --check apps/b2c-web/e2e/fixtures/b2b-product/runtime-v2/transport-probe.mjs
bash -n apps/b2c-web/e2e/fixtures/b2b-product/runtime-v2/run-probe.sh
git diff --check
```

The runtime checks executed the exact source bytes identified by SHA-256 in the
receipt, then committed unchanged as `4e76766`. No browser run is invented for
the subsequent documentation-only receipt. Earlier v1 test totals were not rerun
or added to these six runtime cases.

For final acceptance, INTEGRATION should run the accepted frontend/API/harness
and browsers together in the matching nonroot container, sharing container
loopback for existing unified/WL gateways and proxies. If a separate disposable
PostgreSQL container is needed, use a task-only internal network without published
ports; retain per-project schema/media/origin isolation and current DB URL guards.
That database/application composition has not been executed by this amendment.

INTEGRATION must explicitly set Chromium
`launchOptions.chromiumSandbox: true`; Playwright's default does not enable it.
Keep certificate verification enabled, omit certificate-ignore arguments and
avoid unrelated native executable overrides. Use the accepted candidate's own
locked Playwright 1.63 package and six-project metadata/config registration from
the [v1 owner request](../v1/integration-requests.md). No shared file is edited here.

Remaining inputs are parent-accepted WP00/final feature heads, actual seed/config
binding and real disposable-DB application verification. Trusted HTTPS remains
separate. There is no remaining matching-runtime download blocker for this task.
Production/provider/real-user, Yoga provenance, historical browser totals,
physical/release gates, application merge and deployment remain outside this scope.
