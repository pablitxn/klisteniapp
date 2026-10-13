<a id="qa-b2c-autogestionado--13-de-octubre-de-2026"></a>
# B2C self-service QA — October 13, 2026

<a id="revision-y-limites"></a>
## Revision and limits

Initial app HEAD and origin/main: `7172041102a8a7029af5fb3e2527a1fa51611a86`.
Branch: `codex/qa-b2c-selfservice-20261013`. Fix: `5ab2729b2e0097bb1be63b3f317003c974545bfb`; expanded QA: `87ae036bd92e228370094e5ec072b0b1442f7481`. Both checkouts were clean;
`git fetch origin` found no new commits requiring fast-forward.
Atlas consulted: `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`, branch `work`, clean.
Atlas remains without writes. See [prior inventory](inventory.md), [flow matrix](flows.md) and [per-case results](results.json).

Real B2C backend, PostgreSQL 17.11 in a dedicated container on loopback 54339,
DB `klisteni_qa`, distinct disposable UUID schemas per run.
No SMTP, payment provider or real data. API 4182, instance frontend 4181.
`*@accounts.test` accounts and suite passwords are exclusively public fixtures.
`/api/me/state` reads and exports verify persisted state; [SQL observation](database-observation.json) establishes the local DB.
Each API and its schema are removed at completion; the container remains available.

UI executed with Playwright 1.63.0, Node 24.19.0, Debian 13. System Chromium
154.0.8037.57 and Playwright WebKit 26.6 (build 2359). Emulated touch profiles,
not physical iPhone/Android or Safari on an Apple device.
Mostly click automation, without certifying gestures, virtual keyboard or mobile
hardware. Reduced motion; GLBs aborted to test fallbacks and avoid 3D work.
Models, previews, existing visual snapshots and gates were unchanged.

Inherited cases sometimes change viewport to 390x844 then 1440x1000;
second-device viewports are explicitly declared in specs. Each project therefore
identifies its **initial viewport**, not every pixel during a journey.
New cases retain their project viewport. Inherited health/yoga-conflict tests
simulate transport and are marked separately in the matrix. Billing uses sandbox
fixtures, never real Mercado Pago.

<a id="resultados-de-navegador"></a>
## Browser results

| Engine | Initial CSS viewport | Touch / DPR | Final unique cases |
| --- | --- | --- | --- |
| Chromium 154.0.8037.57 | 360x800 | yes / 2 | 48 PASS |
| Chromium 154.0.8037.57 | 430x932 | yes / 2 | 48 PASS |
| Chromium 154.0.8037.57 | 1440x1000 | no / 1 | 48 PASS |
| WebKit 26.6 / 2359 | 360x800 | yes / 2 | 48 PASS |
| WebKit 26.6 / 2359 | 430x932 | yes / 2 | 48 PASS |
| WebKit 26.6 / 2359 | 1440x1000 | no / 1 | 48 PASS |

288 final case/profile combinations: 41 first-round cases plus 7 per profile.
Additional active writes rerun 6/6 and health captures/reloads rerun 3/3 after
waiting for lazy loading. Rechecks are not new flows. Seven extras use the real
API; yoga uses Playwright Clock to verify 3 recorded seconds and exclude pauses,
without long waits or inferring physical-phone accuracy.

The additional round records browser errors. Explicitly aborted GLB fetch errors
are retained as expected by path; Chromium reports `Failed to fetch`, WebKit
`Load failed`. Any other exception fails the test. Zero GLB errors or certification
of the excluded renderer are not promised.

<a id="checks-y-problemas-de-setup"></a>
## Checks and setup issues

| Command | Result |
| --- | --- |
| `pnpm lint` | PASS: boundaries, 14 tasks and B2B formatting; new QA UI also linted directly |
| `pnpm typecheck` | PASS: 14 tasks; new configs/tests also checked directly |
| `TEST_DATABASE_URL=... pnpm test` | PASS: 534 tests, 10 B2B integration SKIP without DB; B2C API 97/97, B2C web 198/198 |
| `VITE_APP_MODE=instance KLISTENI_PUBLIC_PROFILE_FILE=instance-profile.example.json pnpm exec turbo run build --concurrency=1` | PASS: 16/16 tasks |
| `node --check scripts/accounts-e2e-server.ts` and `node --check scripts/b2c-qa.mjs` | PASS |
| Default Playwright `--list` | PASS: 83 demo cases; new instance specs excluded from demo config |
| `git diff --check` | PASS |
| Complete `pnpm check` / `check:all` / `check:release` and public-demo GPU E2E | NOT RUN: previews/models deferred and outside scope |

Pre-fix baseline: 30/30 desktop Chromium, recorded in [baseline](baseline-desktop.json).
B2C-01 was reproduced later when expanding scenarios. No other product failures
in final journeys. Harness selector errors are separate from regressions: sets
selection, mobile menu, wrapping labels, duplicate cancellations and shared rate
limiter corrected in tests with real actions/roles and documentation IPs per case.
Limiter retained without larger quotas. Initial instance build failed because its
required public profile was absent; configured build passed. Browser downloads/libs
were repaired in the workspace as described below. Original logs remain in evidence.

<a id="correccion"></a>
## Correction

**B2C-01 — lost response while editing yoga (corrected).** PUT committed the edit
in PostgreSQL but the browser lost its response. Retrying produced 409, refreshed
state and presented the user's own edit as a remote change; Save was disabled and
an unnecessary copy offered.

On 409, state is now queried under the same account and only the complete yoga
snapshot exactly matching the submission is recognized. Confirmed revision is
published and editor closed. Different version, failed query or account change
retains the conflict. Historical snapshots are not rewritten.

Product file: `apps/b2c-web/src/lib/store.ts`. Regressions:
`test/yoga-store.test.ts` and `e2e/b2c-selfservice.spec.ts`, aborting response
**after** `route.fetch()` (real commit). Before: reproduced failure and
[before screenshot](yoga-response-loss-before.png); after: one practice and retained
historical name, [after screenshot](yoga-response-loss-after.png).

Other changes are fixtures, config, runner and navigation-selector adaptations
to choose the visible mobile/desktop menu. No B2B product/shared package changes.
For integration, particularly review `scripts/accounts-e2e-server.ts` and account
specs; B2C `store.ts` may overlap another B2C branch.

<a id="reproduccion-automatizada"></a>
## Automated reproduction

Requirements: Node 24+, pnpm, Docker, lockfile dependencies and Playwright
Chromium/WebKit with their libraries. From root:

```sh
# Only if the name is unused. Do not delete others' containers/volumes.
docker run -d --name klisteni-qa-b2c-20261013 \
  -p 127.0.0.1:54339:5432 \
  -e POSTGRES_PASSWORD=qa-local-only -e POSTGRES_DB=klisteni_qa \
  postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
docker exec klisteni-qa-b2c-20261013 pg_isready
pnpm --filter @klisteniapp/b2c-web exec playwright install chromium webkit
TEST_DATABASE_URL=postgres://postgres:qa-local-only@127.0.0.1:54339/klisteni_qa \
  node scripts/b2c-qa.mjs
# Optional: one profile per invocation
TEST_DATABASE_URL=postgres://postgres:qa-local-only@127.0.0.1:54339/klisteni_qa \
  node scripts/b2c-qa.mjs webkit-narrow
```

Runner accepts only a loopback DB, creates separate API/schema per invocation
and preserves failures. Default artifacts: `/tmp/klisteni-b2c-qa`;
`B2C_QA_ARTIFACTS` selects another directory. `B2C_QA_CHROMIUM_PATH` and
`B2C_QA_WEBKIT_PATH` select verified local executables.

This Cloud run used `/tmp/b2c-qa-bin/pnpm` (available pnpm 11.25.0 with
`manage-package-manager-versions=false`, `verify-deps-before-run=false` and
`XDG_DATA_HOME=/workspace/.cache/xdg`) and `/usr/bin/chromium`.
Playwright Chromium was not downloaded: CDN returned 403. WebKit downloaded from
an alternate mirror. Debian libraries extracted into `/workspace/.cache/webkit-libs`,
without changing system permissions/libraries. `/tmp/b2c-qa-bin/webkit` configures
actual libraries through LD_LIBRARY_PATH because the package wrapper replaces it.
WebKit 26.6 launch/DOM verified before cases; UI assertions are not skipped.

Exact Cloud command for the recorded run:

```sh
PATH=/tmp/b2c-qa-bin:$PATH XDG_DATA_HOME=/workspace/.cache/xdg \
  B2C_QA_CHROMIUM_PATH=/usr/bin/chromium \
  B2C_QA_WEBKIT_PATH=/tmp/b2c-qa-bin/webkit \
  TEST_DATABASE_URL=postgres://postgres:qa-local-only@127.0.0.1:54339/klisteni_qa \
  B2C_QA_ARTIFACTS=/tmp/b2c-final node scripts/b2c-qa.mjs
```

Independent additional round uses frontend 4195 and API 4196:

```sh
# With the same environment/browser variables as above:
B2C_QA_CONFIG=playwright.b2c-qa-extra.config.ts \
  TEST_DATABASE_URL=postgres://postgres:qa-local-only@127.0.0.1:54339/klisteni_qa \
  node scripts/b2c-qa.mjs
```

`B2C_QA_GREP` reruns a case by title. Each invocation retains an independent
disposable schema. Example: `B2C_QA_GREP='paid fixture can write'`.

<a id="levantar-escenario-para-revision-manual"></a>
## Start a manual review scenario

Outside the automated suite (do not share ports 4181/4182):

```sh
# Terminal 1, repo root; Ctrl-C removes only the generated schema.
B2C_QA_FIXTURES=1 \
  TEST_DATABASE_URL=postgres://postgres:qa-local-only@127.0.0.1:54339/klisteni_qa \
  node scripts/accounts-e2e-server.ts
# Terminal 2
cd apps/b2c-web
VITE_APP_MODE=instance KLISTENI_PUBLIC_PROFILE_FILE=instance-profile.example.json \
  KLISTENI_API_URL=http://127.0.0.1:4182 \
  node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4181 --strictPort
```

Open `http://127.0.0.1:4181`. Password for **all fictional accounts**:
`Only-for-browser-tests-2026!`. `qaplan@accounts.test`: trial/empty data;
`qaactive@accounts.test`: simulated paid access; `expired@accounts.test`: expired
trial/history; `lifetime@accounts.test`: lifetime; `qayogaloss@accounts.test`: one
practice/historical snapshot. For a test invitation, `admin@accounts.test` opens
Cuenta y planificación → Usuarios e invitaciones; do not select email delivery.
Never transfer these passwords/fixtures to a real instance.

Brief manual checklist:

1. At 360/430 px, sign in as QAPlan; copy routine, Kiritimati timezone and days;
   test empty name, invalid timezone and zero days; reload and verify saved state.
2. Customize to one set, finish strength with custom repetitions; abandon another
   session and verify no history awarded. Record cardio and export.
3. Edit QAYogaLoss practice and compare previous history. Use automated spec for
   exact response loss; Offline before PUT tests another failure, not a prior commit.
4. In Mi salud save/edit/cancel/delete a measurement; review import preview and
   confirm a fictional template; download account and check JSON.
5. In Expired check reads/exports/deletion and save limits; logout and verify local
   mode without carrying private data.
6. Two windows/profiles: change password, check other session revocation, sign in
   to another account and confirm previous health/history absent.
7. Review tab/keyboard, modal scroll, back/forward from privacy and retry. Repeat
   on a personal physical phone; automated results do not replace it.

<a id="evidencia-conservada"></a>
## Retained evidence

Selected captures/results are in this directory. Complete package (555 files,
captures, traces, reports and logs): `/workspace/shared/b2c-qa-20261013.tar.gz`;
[hash/size](archive.json), [file manifest](evidence-manifest.json). Traces contain
only fictional accounts/tokens/cookies from removed schemas. No production
activation links/data. Browser schemas cleaned: final count zero. Local PostgreSQL
container remains available for the manual scenario.

<a id="retorno-para-atlas-lectura-pendiente-de-integrar"></a>
## Atlas handoff (read-only; integration pending)

Klisteniapp B2C instance tested locally on baseline `7172041` plus this branch.
B2C-01 corrects yoga-edit recovery; no B2B, deployment, white-label, model or preview
changes. Keep new local evidence separate from historical Atlas releases.
Previews/Blender/recurring backups retain prior decisions. CI, DNS, public runtime
and external services were not verified. After branch integration, incorporate
this report/final SHA as a dated source, without claiming deployment/physical tests.
