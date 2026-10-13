<a id="qa-e-implementación-socio-b2b-13-de-octubre-de-2026"></a>
# QA and implementation: B2B member, October 13, 2026

Local review with real backend and fictional data. Branch
`qa/b2b-member-20261013-session-b752`; clean base
`7172041102a8a7029af5fb3e2527a1fa51611a86`, equal to `origin/main` after
`git fetch origin` and `git merge --ff-only origin/main`. Code checkpoint:
`14fd1b4287c4f209466d5519528b7a5201cc9f8e`. No push, PR, merge or deployment in this recorded task.

Final harness checkpoint: `4856be577b0374a643d93dec52ee204f9c8c9228`.

Adjacent matrix/JSON summary document final results. Exploratory runs retained
separately in `.cache/member-qa/exploration/`, `branch-reproduction/`,
`qr-reproduction/` and `extra-results/`. Snapshots, receipts and gates not replaced.

<a id="contexto-e-inventario-previo-a-elegir-casos"></a>
## Context and inventory before case selection

Read `AGENTS.md`, instructions and `atlas-navigate` from `../sysadmin-workspace`,
Atlas precedence policy, wiki and `2026-10-12-klisteniapp-retrospective` entry,
`docs/roadmap-implementacion.md`, `docs/b2b.md` and white-label contracts. Atlas
remained clean at `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`, updated by fetch/FF.
No writes there. Owner app establishes implementation; Atlas deployment history
does not establish today's runtime.

Inventory from `apps/b2b-web/src/routes.ts`, `App.tsx`, `app/Workspace.tsx`,
`app/MemberWorkspace.tsx` and public/invitations/training/catalog/voice features,
checked against client, contracts and API.

| Member route/action | Inventoried actions | Coverage |
| --- | --- | --- |
| `/`, `/gimnasios`, `/sedes/:slug`, `/g/:gym` | Website/branches, enter workspace, public equipment | QR entry, contextual reads and two-brand websites; complete website navigation outside scope |
| `/g/:gym/units/:unit` | Page, settings, written instructions; equipment → routine; return to gym | Valid QR, foreign-branch unit, filtered routine and no matches |
| `/login`, `/app` without session | Email/password, pre-login brand, errors, role destination | Valid login/foreign brand; origin-independent session; explicit selection |
| `/app/invite` | New activation, native validation, existing account, consent, return, confirmation | New/existing, missing/reused token and wrong brand |
| Branch/role selector | Allowed context, retained reload selection, cancel previous-context requests | Centro/Norte, isolated drafts, branch data/history |
| `/app`, `/app/routines` | Assigned routines, QR filter, start session, counters | Empty, published version, missing equipment/four branches |
| Session within routines | Reps/seconds/load/RPE/completion, alternative/reason, notes, instructions/rest | Edits, validation, substitution, partial/complete, double click, drafts, reload, offline, lost/late submission |
| `/app/catalog` | Search/clear/open/close instructions; optional voice | Empty search, text, simulated voice/no-voice-API fallback |
| `/app/history` | Partial/complete state, version, branch, prescribed/actual | Persistence/comparison; current branch; new session without prior-record edit |
| `/app/history/all` | Brand history, JSON export, return to branch | Other branch retained, JSON downloaded/inspected |
| Logout/reload/back-forward/another tab | Logout, recover own draft, avoid restoring from old response | Cookie-removal expiration, account changes, cross-tab logout, late private response |
| `/manage`, `/backoffice` | Member rejection and return link | Visible rejection; other-role actions not member cases |

No confirmed-execution editing, email sending, remote autosave or partial-execution
continuation action exists. Both save forms close an immutable record; returning
without saving retains local draft. Effective authorization remains in API.

<a id="defectos-reproducidos-y-corregidos"></a>
## Reproduced and corrected defects

1. **M01: mixed branch progress.** Person with Centro/Norte access saves in Norte
   and returns to Centro: “Mi progreso”/counters loaded entire brand.
   `MemberWorkspace.tsx` now uses `executions.list(org.id)`, with client account/
   branch/role guard already applied. `/app/history/all` retains authorized brand
   history. S01 checks both destinations/exported JSON.
2. **M02: other-branch QR presented as current-branch equipment.** Centro-only
   member opens Norte cable machine and sees Centro routine as if for that unit.
   `Workspace.tsx` checks QR branch before displaying routines. With access, user
   explicitly chooses that branch; machine/unit retained in URL. Without access,
   rejection shown with return to own routines. S01/S10 regressions.
3. **M03: existing-invitation confirmation hidden.** Server accepted consent with
   200 to join Atlas from a Sur identity, but inherited login condition hid `done`.
   `Invitation.tsx` no longer renders login after acceptance. S16 checks confirmation,
   invited-branch access and independent Sur password/session.

Three focused UI/query changes, without migrations/server-rule changes. Shared
integration files: `app/Workspace.tsx`, `app/MemberWorkspace.tsx`,
`features/invitations/Invitation.tsx`, `apps/b2c-web/tsconfig.json` (new config types).
Two new Playwright files and `scripts/b2b-member-review-fixture.mjs` belong to this
recorded task. No models/previews/providers/permissions/infrastructure changed.

<a id="entorno-y-alcance-de-navegador"></a>
## Environment and browser scope

Node `24.19.0`, pnpm `12.7.0` (early exploration used 11.25.0 fallback; frozen
lockfile reinstall and checks repeated with pinned version). PostgreSQL `17.11`
in dedicated QA container, published only at `127.0.0.1:54339`, DB
`klisteni_b2b_test`. Harness creates random per-engine schemas/media directories
and removes them on exit. Atlas/Sur, Centro/Norte/Oeste and all identities fictional.

| Project | Engine | CSS viewport | Touch/mobile | DPR |
| --- | --- | --- | --- | --- |
| C320 | Environment Chromium 154.0.8037.57 | 320 × 740 | true/true | 2 |
| C430 | Chromium 154.0.8037.57 | 430 × 932 | true/true | 2 |
| C1440 | Chromium 154.0.8037.57 | 1440 × 1000 | false/false | 1 |
| W320 | Playwright WebKit 26.6, build 2359 | 320 × 740 | true/true | 2 |
| W430 | Playwright WebKit 26.6, build 2359 | 430 × 932 | true/true | 2 |
| W1440 | Playwright WebKit 26.6, build 2359 | 1440 × 1000 | false/false | 1 |

Playwright `1.63.0`, locale `es-AR`, UTC, light, reduced motion, one worker, no
automatic retries. Linux touch emulation, without physical iPhone/Android or real
Safari claims. Observed user agent/metrics attached per case. Each viewport
visits locally served app screens/controls; additional API checks establish
persisted effects. Screen/viewport captures and traces generated.

Chromium v1243 download rejected with 403; `/usr/bin/chromium` used. WebKit came
from `cdn.playwright.dev/builds/webkit/2359/` after two mirrors failed. Missing
Debian libs downloaded/extracted into `.cache/member-qa/libs/` and added to local
WebKit bundle at `/workspace/.cache/ms-playwright`; no system installation.
WebKit launch/render verified. Host validator still looks for system `libGLESv2`;
only that installation diagnostic skipped through
`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`, with loadable libs/actual engine execution.

Both brands use fictional HTTPS through restricted loopback proxies. Chromium
accepts harness certificate SPKI; Node uses its CA only through `NODE_EXTRA_CA_CERTS`.
WebKit accepts self-signed certificate inside test context. These historical runs
establish neither public-CA trust nor production certificates; original WL
config/gates retained. Subsequent user instruction forbids new TLS bypasses/trust
changes: adapt future runs to isolated HTTP loopback or valid HTTPS with normal validation.

<a id="matriz-de-ejecución"></a>
## Execution matrix

<!-- MEMBER_QA_MATRIX -->
Final consolidated result: **96/96 combinations**. First run: 85 PASS, 11 harness
FAIL; explicit rerun after correction: **24/24 PASS**. Unaffected 72 cases retain
first evidence. This is not one passing 96-case run; earlier failures remain visible.

| Case | Flow | C320 | C430 | C1440 | W320 | W430 | W1440 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | Branches, drafts, progress/export | PASS | PASS | PASS | PASS | PASS | PASS |
| S02 | New invitation, validation, empty/rejection states | PASS | PASS | PASS | PASS | PASS | PASS |
| S03 | QR → contextual login/filter without activity | PASS | PASS | PASS | PASS | PASS | PASS |
| S04 | Sets, substitution, validation, return/reload/back-forward/partial | PASS | PASS | PASS | PASS | PASS | PASS |
| S05 | Seconds/RPE, complete/double click | PASS | PASS | PASS | PASS | PASS | PASS |
| S06 | Lost response after commit, reload/exact retry | PASS | PASS | PASS | PASS | PASS | PASS |
| S07 | Offline/503 without commit; confirm submission | PASS | PASS | PASS | PASS | PASS | PASS |
| S08 | Expired session, reentry/another account | PASS | PASS | PASS | PASS | PASS | PASS |
| S09 | Catalog, empty search, failed load, routes/permissions | PASS | PASS | PASS | PASS | PASS | PASS |
| S10 | Inaccessible-branch QR/recovery | PASS | PASS | PASS | PASS | PASS | PASS |
| S11 | Simulated optional voice/text without speech API | PASS | PASS | PASS | PASS | PASS | PASS |
| S12 | Rest/pause/resume without recording sets | PASS | PASS | PASS | PASS | PASS | PASS |
| S13 | Two brands, cross-tab logout/late private response | PASS | PASS | PASS | PASS | PASS | PASS |
| S14 | No local storage; real save | PASS | PASS | PASS | PASS | PASS | PASS |
| S15 | Late save after navigation/reopen; retry | PASS | PASS | PASS | PASS | PASS | PASS |
| S16 | Existing-identity invitation/consent | PASS | PASS | PASS | PASS | PASS | PASS |

Inspectable JSON: [consolidated result](b2b-member-qa-2026-10-13.json).
Complete traces/captures: `.cache/member-qa/full-first-pass/results/` and
`.cache/member-qa/results/`; logs `full-first-pass/ui.log`, `final-ui.log`.
<!-- /MEMBER_QA_MATRIX -->

| Additional scope | Status | Evidence/limit |
| --- | --- | --- |
| Complete routine in four branches/cross-tab logout | PASS | 4/4 `white-label.spec.ts` groups in narrow Chromium/WebKit; separate schema on proxy 4344 |
| Create/repeat manual fixture | PASS | Helper run twice; existing assignments reused |
| Server-clock invitation expiration | UI NOT RUN | API covers expiry/one-use; UI tests missing/reused/wrong-brand token |
| Printed QR/real camera | NOT RUN | QR destination opened in browser, not physical scanning |
| Real voice/device audio | Cloud BLOCKED | No phone audio/voice validation; simulated API/control and alternative text tested |
| Virtual keyboard, orientation/OS gestures; real iOS bfcache | NOT RUN | Emulated touch/back-forward does not establish physical behavior |
| B2B service change/branch retirement during save | UI NOT RUN | API tests revocation/queues/history preservation; additional physical review pending |
| New models/animations/previews | NOT RUN | Deferred/outside authorized scope |
| Production/remote CI | NOT RUN | Neither queried nor operated |

<a id="checks-y-distinción-de-fallos"></a>
## Checks and failure distinctions

`pnpm check` passed B2B boundaries/lint/format/types/tests before failing at
`previews:check`: Yoga `Extraction receipt is stale`. Repeated
`node scripts/generate-yoga-previews.mjs --check` in clean initial-SHA worktree:
same error. Pre-existing/deferred per roadmap; hashes/captures unchanged.
Aggregate build did not run because gate stopped it. B2B build executed for UI.
After browsers finished, separate `pnpm build` passed **16/16 tasks**; neither
makes aggregate pass nor removes preview gate.

Lint/types: 14/14 tasks; aggregate tests: 14/14 plus 23 root tests. B2B API 76/76,
zero skips; B2B frontend 53/53. Aggregate without B2C DB skips that integration
group; no B2C account coverage attributed to member role. New config included in typecheck.

Exploration records repaired setup issues: pnpm cache outside workspace, native
pnpm bins without postinstall, WebKit dependencies, HTTPS interception without
Node CA, incorrect text fixture and login 429. Exploratory WebKit imports 404
caused by rebuilding during a suite; final matrix uses fixed build. Trace retained.
First complete run found contextual login without 429 handling and counted WebKit
Inspector canceled-fetch diagnostics as exceptions (`Fetch API cannot load … due
to access control checks`). Invitation/expiration probe reproduced them with
**zero** `window.error`/`unhandledrejection`. Final monitor captures actual boundaries,
asserts zero script failures and separately attaches all Inspector diagnostics;
logs not filtered. New invitation, QR/login, expiration and existing-identity
consent rerun in six configurations. Negative controls provoked error/rejected
promise in both engines: gate detected 4/4 deliberate failures outside product
matrix. JSON/traces retained in `runtime-probe/`, `monitor-negative/`. Zero WebKit
browser diagnostics not claimed.

<a id="evidencia-visual-y-trazas"></a>
## Visual evidence and traces

Selected real captures also included with delivery hashes:

- [M01 before: Norte inside Centro](b2b-member-qa-2026-10-13/before-branch-progress.png), [brand history after](b2b-member-qa-2026-10-13/all-history-webkit-430.png).
- [M02 before: Norte QR shows Centro](b2b-member-qa-2026-10-13/before-foreign-qr.png).
- [M03 before: login after acceptance](b2b-member-qa-2026-10-13/before-existing-invitation.png), [access after acceptance on WebKit 430](b2b-member-qa-2026-10-13/existing-invitation-webkit-430.png).
- [Timed session, Chromium 320](b2b-member-qa-2026-10-13/timed-session-chromium-320.png), [partial, WebKit 320](b2b-member-qa-2026-10-13/partial-history-webkit-320.png).
- [Desktop WebKit catalog](b2b-member-qa-2026-10-13/catalog-webkit-desktop.png), [desktop history](b2b-member-qa-2026-10-13/all-history-desktop.png).

Inspected QR, session/validation form, history, catalog, both brands and invitation
confirmation; not merely HTTP responses. Delivery archive:
`/workspace/shared/klisteni-b2b-member-qa-2026-10-13.zip`: reports, per-case traces,
captures, original results, reproductions, logs, probes and SHA-256 manifest.
Traces contain exclusively **fictional** cookies/accounts/links from disposable
schemas; no envs, TLS keys or real credentials.

Open a trace from checkout:

```sh
pnpm --filter @klisteniapp/b2c-web exec playwright show-trace /ruta/a/trace.zip
```

No reproduced product defects remain uncorrected in executed journeys. BLOCKED/
NOT RUN rows retain acceptance limits; this conclusion promises no absolute coverage.

<a id="escenario-reproducible-sin-credenciales-reales"></a>
## Reproducible scenario without real credentials

Requirements: Node 24+, pnpm 12.7.0, Docker/Playwright browsers. New fictional DB
only; never reuse real connections. Following historical commands retain recorded
TLS settings as evidence, not authorization for new bypasses. Adapt harness before
future runs under the subsequent no-bypass instruction.

```sh
pnpm install --frozen-lockfile --ignore-scripts
docker run -d --name klisteni-b2b-member-qa \
  -e POSTGRES_PASSWORD=qa-local-only -e POSTGRES_DB=klisteni_b2b_test \
  -p 127.0.0.1:54339:5432 postgres:17
export B2B_TEST_DATABASE_URL=postgresql://postgres:qa-local-only@127.0.0.1:54339/klisteni_b2b_test
pnpm --filter @klisteniapp/b2c-web exec playwright install chromium webkit
node scripts/b2b-wl-tls.mjs
export NODE_EXTRA_CA_CERTS="$PWD/.cache/wl/tls/ca.crt"
pnpm --filter @klisteniapp/b2c-web exec playwright test --config playwright.member-qa.config.ts
```

For system Chromium set `B2B_QA_CHROMIUM_PATH=/usr/bin/chromium`. Cloud caches are
under `/workspace`; see recorded summary commands for local libs/run environment.
No machine security-policy changes to install dependencies.

For manual review keep harness in one terminal and generate fixture in another.
Reserved proxy 4344 separate from main matrix:

```sh
pnpm build:b2b
node scripts/b2b-wl-e2e-server.mjs
# Another terminal, with previous variables and an available browser:
node scripts/b2b-member-review-fixture.mjs
```

Helper saves `.cache/member-qa/review-fixture.json`. Fictional person
`review-member@atlas.example.test`, test password `browser-tests-only-password-2026`,
Centro/Norte, sets routine in both and `QA manual · tiempo` in Centro. Repeating
helper reuses account/program/assignments. Stopping harness removes schemas;
regenerate fixture. No email or activation links shown.

Historical separate-test-profile entry used proxy `http://127.0.0.1:4344` and
`https://atlas.b2b.test/app`. Its scoped Chromium SPKI command, without CA installation,
is preserved below as prior evidence. New runs must not use this bypass.

```sh
# Print only the fictional certificate's public fingerprint.
node --input-type=module -e 'import {whiteLabelTLS} from "./scripts/b2b-wl-tls.mjs"; console.log(whiteLabelTLS().spki)'
# Replace HUELLA with that output; dedicated workspace profile.
chromium --user-data-dir="$PWD/.cache/member-qa/manual-profile" \
  --proxy-server=http://127.0.0.1:4344 \
  --ignore-certificate-errors-spki-list=HUELLA https://atlas.b2b.test/app
```

Brief manual checklist:

1. Sign in fictional person; select **Centro · Socio**. Open sets routine, change
   reps/load/RPE/mark set. Return without saving, reload/reopen: retain values.
2. Substitute authorized alternative: load/RPE/completion reset. Save without
   reason, check error, supply reason.
3. Save partial: one immutable execution. Starting another session creates new
   draft. In `QA manual · tiempo` record 38 seconds/RPE 7.5, complete both sets,
   compare prescribed/actual.
4. Select Norte, record there, return Centro: **Mi progreso** is Centro;
   **Todo mi historial** retains both branches and exports JSON.
5. Open `/g/atlas-demo/units/atlas-demo-norte-cable-01` from Centro, choose
   equipment→routine and explicitly confirm Norte. Fictional
   `member@atlas.example.test` (same test password) must be rejected there.
6. Network panel offline; edit/save: pending submission retained. Online/reload/
   reopen/confirm without duplicate history. For **post-commit** loss use automated
   S06 `--headed` or trace: offline alone does not establish that condition.
7. Logout in another tab/reenter: prior response must not restore access. Other
   account sees no own draft. Review voice/audio/keyboard on physical test device
   as additional acceptance.

<a id="resumen-para-integrar-en-atlas-después"></a>
## Summary for later Atlas integration

New local Klisteniapp reading, no new production evidence. Three member UI fixes
and six engine/viewport combinations with disposable PostgreSQL; task JSON fixes
results/limits. WL implementation remains complete; WL-0–WL–8 not reopened.
Yoga gate, authoring/previews, physical devices, backups/retention and future
integrations retain pending work. Incorporate report/commit as **local/committed**
evidence after role-branch reconciliation; do not describe recorded changes as
pushed/merged/deployed. Atlas received no writes.
