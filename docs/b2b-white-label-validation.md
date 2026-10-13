<a id="validación-de-marca-blanca-b2b--11102026"></a>

# White-label B2B validation — 2026-10-11

Checkpoint: **WL-0–WL-8 completed/locally verified**, `codex/b2b-white-label`,
base `af87f603876cb99b2e6673f290fa8ec03721454b`. New evidence, not reused `508e9e1`.
No production deployment/deferred-preview regeneration at this checkpoint.
Later authorization/public Atlas-Sur tests: [deployment checkpoint](b2b-white-label-deployment.md).

<a id="checkpoints-y-alcance"></a>

## Checkpoints and scope

| Stage | Checkpoint | Result |
| --- | --- | --- |
| WL-0 | `a451d9c` | Inventory/permissions/modules/migration/transfers/retention-export |
| WL-1 | `5fdf22d` | Contracts/migration004/two-brand-four-branch fixture |
| WL-2/WL-3/WL-7 | `d0a9011` | Trusted domains/brand sessions/branch permissions/DNS-TLS operator/migration005 |
| WL-4/WL-5/WL-6 | `15660fd` | Login/branch-role selection/admin/published themes/modules/history/isolated drafts |
| Integration corrections | `a266ae4` | Normalized default ports; website edit retains disabled plan without modification permission |
| WL-8 | `c451df2` | Multi-host-engine HTTPS harness/local images/full restore |
| Image preparation | `815142d`, `04d7836` | Validator formatting/public proxy map in Docker context, no secrets |

JSON identifies SHA/diff. First in-progress run interrupted/found test cleanup
failure, not acceptance. Final full runs/project/new builds: desktop `c451df2`,
touch `04d7836`; formatting/Nginx-map Docker inclusion only, no frontend/API functional
difference. Later documentation leaves binaries unchanged.

<a id="topología-y-datos"></a>

## Topology and data

Node 24.21.0/pnpm12.7.0/local test PostgreSQL. Private `.cache/wl/test.env`,
`B2B_TEST_DATABASE_URL`, disposable b2b/test DB without `options`, never app DB.
Each integration test creates/drops schema; restore two complete temporary DBs,
no development/production tables.

Atlas Centro/Norte, Sur Centro/Oeste/distinct themes/staff-members; extra multi-brand
identity/different branch roles. Independent of B2C accounts/sessions/endpoints/DB.

Per-project same gateway/API serves two HTTPS hosts: Chromium1440×1000/Pixel7 touch/
WebKit iPhone13 touch. Loopback CONNECT resolves hosts; no public DNS/`/etc/hosts`
change. Per-host Secure cookies. Historical Chromium exact-SPKI exception/WebKit
temporary CA, `ignoreHTTPSErrors` disabled. [Operation guide](b2b-white-label-runtime.md)
records preparation/removal. Future user instruction forbids new bypass/trust changes;
these historical results are not normal public-certificate validation.

<a id="matriz-d01d19"></a>

## D01–D19 matrix

Three-engine UI/actual HTTP/PostgreSQL transaction acceptance. Concurrency waits
actual locks; media GET/HEAD/Range. Responsible tests below; screenshot alone not authorization evidence.

| Case | Automated evidence |
| --- | --- |
| D01 | `white-label.spec.ts`: simultaneous origins/published themes/two pre-login branches; both-host image smoke |
| D02 | `domain-context.test.ts`, `b2b-gateway.test.mjs`, HTTP/browser: unknown-unverified/forged peer-secret-headers/direct entry/document preflight |
| D03 | Browser member-trainer-admin login/explicit selection/role navigation/scoped `/me` |
| D04 | Browser/HTTP Sur account rejected Atlas/no authorized cookie/other-brand disclosure |
| D05 | Browser/authorization/React session: shared account/different roles/validated persistence without escalation |
| D06 | HTTP/catalog-inventory-training SQL/browser: brand-branch-resource IDs/invalid role/rejected persisted selection |
| D07 | HTTP/authorization: copied cookie/cross Origin/permission-domain revoke/queued expiry; React drops late response/browser cross-tab logout |
| D08 | HTTP/migration/authorization: new-existing consent/used-expired/wrong domain/queued acceptance after pause/legacy Principal invitation scope |
| D09 | HTTP/authorization/browser: independent branch publication/frozen profile/foreign routes/website disabled with login |
| D10 | HTTP/authorization: private/reference-shared media/encoded URLs/GET-HEAD-Range/private cache/identity media hidden until publication |
| D11 | UI creates branch/grants; trainer publish-prescribe/member execute/trainer monitor in four branches; SQL rejects unassigned reads |
| D12 | Authorization/HTTP: explicit retire before transfer-archive/own historical access without operational access/intact snapshots/archived write rejected |
| D13 | UI recovers routine only on original branch; draft tests brand-branch-account-role/website no global fallback/batches-comparisons |
| D14 | Browser themes/private preview/save-publish-restore-reload; revision-contrast authorization; preview metadata never substitutes published |
| D15 | UI/HTTP/authorization brand-branch-platform modules/dependencies/direct calls; hidden retained plan allows text/rejects plan edits |
| D16 | Domain lifecycle/gateway/HTTP/browser primary-alias-pause-transfer/canonical QR/unit link/token-safe redirect |
| D17 | Full UI Atlas Centro-Norte/Sur Centro-Oeste; API idempotent retry/cross-branch execution-ID conflict |
| D18 | Migration5/5/pg_dump-pg_restore: old-empty DB/backfill/invites/IDs-snapshots; restart/restored inventory-themes-domains-permissions-media-config |
| D19 | Boundaries/lint-types-global tests/build/independent demo B2C E2E; WL excluded from B2C config |

Reviewed touch Chromium [Atlas](validation/b2b-white-label-atlas-touch.png)/[Sur](validation/b2b-white-label-sur-touch.png):
same surface/synthetic data, distinct typography/geometry/palette. Wide tables horizontal scroll.
[API](../apps/b2b-api/tests/), [domain E2E](../apps/b2c-web/e2e/white-label.spec.ts),
[workflow](../apps/b2c-web/e2e/white-label-workflow.spec.ts),
[gateway](../scripts/b2b-gateway.test.mjs), [session](../packages/b2b-react/tests/session-controller.test.ts).

<a id="ejecuciones-y-comandos"></a>

## Runs and commands

| Verification | Result |
| --- | --- |
| Boundaries/serialized lint-types/B2B format | PASS; final combined quality report |
| `pnpm exec turbo run typecheck --concurrency=1` | 15/15 packages PASS |
| Root infrastructure/provenance/gateway | 23/23 PASS; no previews generated |
| `node --env-file=.cache/wl/test.env --test --test-concurrency=1 apps/b2b-api/tests/*.test.ts` | 76/76, no skips |
| Authorization after disabled-plan fix | 12/12, no skips |
| Workspace global tests | 15/15 tasks,424 PASS; DB skips below |
| Per-project HTTPS/test DB/fixture CA | **30/30**,10/engine, no retries-flakes-skips; [report](validation/b2b-white-label-browsers-2026-10-11.json) |
| Independent B2C `demo.spec.ts` | **3/3**, no account-payment-analytics transports/private requests; local export-restore |
| API/web/Nginx images | **6/6**, OCI `04d7836`, Node 24.21.0/Nginx1.30.5; [SHA256/checks](validation/b2b-white-label-images-2026-10-11.json) |
| DB/media/config restore | 6/6 from clean `5b27687`; [sanitized report](validation/b2b-white-label-restore-2026-10-11.json) |

[Quality report](validation/b2b-white-label-quality-2026-10-11.json) preserves logs/
hashes. Global11 skipped tests/eight unexecuted suites without DB variables;
dedicated76/76 establishes B2B integration, not skips. No B2C cloud/payments/mail integration.

Historical browser commands use test-only `B2B_TEST_DATABASE_URL`; private env not printed.
Before new browser run adapt to isolated HTTP or valid HTTPS/existing trust, without
new bypass/CA changes:

```sh
node scripts/b2b-wl-tls.mjs
node --env-file=.cache/wl/test.env apps/b2c-web/node_modules/@playwright/test/cli.js test \
  --config apps/b2c-web/playwright.white-label.config.ts
# On resource-limited hosts, add --project=wl-chromium-desktop,
# --project=wl-chromium-touch or --project=wl-webkit-touch and run serially.
# Historical procedure: prepare/remove the WebKit CA before/after per the operations guide.
B2B_WL_TEST_POSTGRES_CONTAINER=klisteni-b2b-db-1 \
  node --env-file=.cache/wl/test.env scripts/b2b-wl-restore.mjs
```

Temporary CA removed; schemas/processes/containers cleanup verified. Synthetic
reports/captures only. Image smoke local `klisteni-b2b-api:wl-test`,
`klisteni-b2b-web:wl-test`, SHA256/temporary loopback API-Nginx; no image publication/
active services changed. Restore quiesces synthetic writes before backup, no later
writes to reconcile. Report hashes/evidence only, never passwords/cookies/keys/dump/private config.

<a id="límites-vigentes"></a>

## Retained limits

- Automated/local HTTPS runtime; physical Safari-iPhone/WebGL/voice/printed QR/human pilot acceptance pending.
- No client DNS-TLS/production deployment at recorded checkpoint.
- Deferred previews retained; `check`, `check:all`, `check:release`, CI gates not claimed passing.
- Theme restore no schema rollback. Active multi-branch/domain makes legacy fail `WHITE_LABEL_REQUIRED`; old binary unsafe rollback. [Recovery](b2b-white-label-runtime.md#ensayo-de-recuperación).
