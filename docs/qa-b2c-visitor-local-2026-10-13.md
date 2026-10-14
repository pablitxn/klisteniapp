<a id="qa-b2c-visitante--modo-local--13-de-octubre-de-2026"></a>
# B2C visitor / local-mode QA — October 13, 2026

Branch: `qa/b2c-visitor-local-20261013`. Clean base: `7172041102a8a7029af5fb3e2527a1fa51611a86`.
`git fetch origin main` confirmed HEAD = origin/main; no fast-forward needed.
Atlas: `/workspace/sysadmin-workspace`, clean, `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`, also fetched without content changes.

This publication copy preserves tested code/textual documentation. No merge or
deployment. Original commits/binary evidence remain in original checkout/verified
bundle. Models, source captures and previews preserved. [Engine/width/mode matrix](validation/b2c-visitor-2026-10-13/matrix.md)
and [JSON results](validation/b2c-visitor-2026-10-13/results.json) retain counts,
original runs/evidence.

<a id="inventario-previo-a-los-casos"></a>
## Inventory before cases

Read `AGENTS.md`, local Atlas `atlas-navigate`, source-of-truth policy,
Klisteniapp catalog/relations/wiki, `docs/roadmap-implementacion.md`, architecture,
public demo, development, health/import, yoga and store components/actions. Atlas
provides historical context; code/local execution determine tested behavior.

Six main sections are internal `/` state, not six browser routes. `AppRoot.tsx`
manages `/privacy`, browser history and public account routes. Localized section
names below identify actual UI.

| Surface | Inventoried visitor actions | Cases / evidence |
| --- | --- | --- |
| `/` · Mi rutina | Select exercise; technique/steps/variants/muscles/progressions/alternatives/mobility/sources/tips; customize order/add/remove/sets; start strength/cardio | V01–V07, app/catalog/planning/library tests |
| Biblioteca | Bilingual/accent-insensitive search; combined pattern/difficulty/equipment; empty/reset; open without routine change | V01, existing catalog/planning |
| Mi cuerpo | Twelve regions/filters, anatomy/yoga search, expand anatomy, routine roles, open exercise/asana, optional viewer/fallback | V01, existing library/body-guide/anatomy |
| Shared viewer | Skin/muscle/bone, select structure, play/pause/speed/phase, reset/orbit/camera, expansion/annotations/no-WebGL fallback | Existing renderer/fallback tests; separate limits below |
| Yoga | 24 cards, Sanskrit/English, level/family/sources/cautions; create from scratch/template/asana; order/repeat/side/duration; cancel/discard/edit/delete; guide/pause/skip/summary/notes/history/delete | V12/V16, existing yoga suite |
| Mi progreso | Empty/calendar/XP, strength/cardio/yoga/details, add cardio, confirm/cancel deletion | V03–V07, V12, V18 |
| Mi salud · Resumen | Period/measurement/source, visible records/dates, trends/sleep/training/nutrition/supplements/goals/form links | V08, audit/captures |
| Mi salud · Cuerpo | Optional profile, records/edit/delete/date/source/notes/date filters/pagination | V08/V09; filters/pagination pending per matrix |
| Sleep/activity | Sleep/phases/times/score; steps/pulse/energy/activity/optional training association; CRUD | V08/V09; extra fields pending per matrix |
| Nutrition | Meals/macronutrients, supplements/dose/unit, CRUD | V08; every editing variant pending per matrix |
| Goals | Metric/value/start/deadline/notes/progress/edit/delete | V08; all deadlines/metrics pending per matrix |
| Salud · Importar | Empty template, normalized JSON, preview/reanalyze/discard/confirm/deduplicate/errors/2 MiB limit | V10 |
| Ajustes | ES/EN/FR; light/dark/system; six palettes/body model/weekly goal/reduced motion/initial setup/privacy/v1-v2 export-import/recovery/9 MiB limit | V02/V11/V13/V14/V17, existing settings/themes/model-variant |
| `/privacy` | Direct entry/return/back-forward, retain draft/focus | V13 and existing demo/settings |
| Instance without account | Session discovery/invalid cookie/unresponsive API/retain local/account-planning button/public access | V15; account lifecycle belongs to signed-in B2C session |
| `/account/join`, recovery/reset, `?account=login` | Demo ignores account intent; instance opens public account UI | Demo route ignoring: existing suite. Registration/login/recovery: role NOT RUN |

<a id="escenario-y-motores"></a>
## Scenario and engines

- Node `24.19.0`; checkout dependencies available. Initial native pnpm `11.25.0`;
  pnpm `12.7.0` installed in workspace cache for final validation.
- Built demo without account transports/analytics. Built instance with example
  public profile/proxy to real B2C API.
- PostgreSQL `17.11`, disposable `klisteni-visitor-qa-pg-20261013` container,
  loopback `54339`, fictional DB/user `visitor_qa`; random schema created/removed
  by `accounts-e2e-server.ts`.
- API `127.0.0.1:4182`, instance `127.0.0.1:4181`, final demo `127.0.0.1:4177`
  (4176 retains pre-overflow-adjustment build). Fixture billing/mail disabled.
  Visitor performed no login/API user writes.
- System Chromium `154.0.8037.57`, Debian 13. Bundled download blocked by HTTP 403;
  `/usr/bin/chromium` used.
- Playwright `1.63.0`, WebKit `26.6` / build `2359`, WPE Linux. Dependencies
  downloaded/extracted only in `/workspace/.cache`, linked to
  `minibrowser-{gtk,wpe}/sys/lib`; no system packages installed.
- `chromium-narrow`, `webkit-narrow`: **320×740**, touch + isMobile; `*-mobile`:
  **430×932**, touch + isMobile; `*-desktop`: **1440×1000**, no touch. Existing
  tests also use **390×844**, **320×740**, **320×926 / 486×926** for thumbnails;
  internal viewport changes retain desktop flags, while role projects enable touch/isMobile.
- V18 generates `pointerType=touch` through `tap()` and checks persisted data.
  Browser simulation, not physical iPhone/Android or phone Safari testing.

Data tests deliberately abort GLB for textual fallback; real renderer tested
separately without conflating content/fallback availability. Traces retain DOM/
network/code, captures taken explicitly; acceptance snapshots not updated to pass.

<a id="bugs-corregidos"></a>
## Corrected bugs

| ID | Prior reproduction | Correction / regression |
| --- | --- | --- |
| B01 | Customize order/sets without prior health/yoga save → v1 export omits routine | Export v2 when local preferences exist; V02 restores in another context/reloads; both stores tested |
| B02 | Record cardio → simulate deletion quota → row disappears although on disk and retry unavailable | Retain row until durable deletion; V05 retains/retries/checks disk; both stores |
| B03 | Corrupt personal copy → export original → confirm valid v2 import → permanent rejection | Only confirmed import replaces unreadable copy; recoverable original/prior recoveries retained; V17/store tests |
| B04 | Health summary: `small` outside `dt/dd` in `dl` group | Record coverage inside `dd`, appearance retained; axe definition-list |
| B05 | Yoga button accessible name omits visible family | Name includes asana/translated family; axe label-content-name-mismatch |
| B06 | WebKit 320 px: intrinsic appearance-select width creates 15 px Settings horizontal scroll | Tracks/labels shrink within content without hiding overflow; themes/settings and clientWidth = scrollWidth |

Files shared with signed-in B2C role requiring careful integration:
`src/lib/store.ts`, `store.local.ts`, `components/HealthDashboard.tsx`,
`health-dashboard.css`, `YogaPage.tsx`, `components/settings.css`,
`account-store.test.ts`, `local-store.test.ts`, `tsconfig.json`. Authenticated path
unchanged; store suite retains account regressions. No anatomy/catalog/geometry/API package changes.

<a id="matriz-de-flujos"></a>
## Flow matrix

Per-engine/width/mode duration/status/trace path: `results.json`. V01–V18 each use
fresh contexts/separate fixtures. PASS requires UI assertions and, for mutations,
storage inspection and/or reload.

| Case | Scope |
| --- | --- |
| V01 | Six empty sections, captures, no overflow, filters/reset, anatomy/no invented history |
| V02 | Custom routine only → export → independent context → import → reload |
| V03 | Invalid/future cardio, cancel, double submit, exact minutes/distance, reload/delete/cancel |
| V04 | Cardio quota: retain form/retry without duplicate |
| V05 | Delete quota: retain row/disk/retry |
| V06 | Strength: invalid reps, edit/reset blocking, six different sets, double save/reload |
| V07 | Strength: continue, leave without saving, reload discards draft, zero XP |
| V08 | Body profile/measurement/edit/sleep/pulse/meal/supplement/goal; reload/delete retain other collection |
| V09 | Empty/out-of-range health, impossible phases/quota; retain form/retry |
| V10 | Health JSON: empty template, preview/discard/confirm/duplicate/corrupt/future/>2 MiB |
| V11 | v1/v2: confirm/cancel/corrupt/>9 MiB/retain other collections/export/reload |
| V12 | Partial yoga: pause/skip excluded, notes/double save; deleting sequence retains history |
| V13 | Privacy: back-forward/return retain draft, Escape/focus restoration |
| V14 | ES → EN → FR, dark/reload/document lang/controls/captures |
| V15 | Expired fictional cookie/lost API response/local cardio without PUT/POST/reload |
| V16 | Complete yoga: simulated visibility/pause/quota/notes/exact retry/reload |
| V17 | Downloadable corrupt personal original; confirmed import; recovery downloadable after reload |
| V18 | Synthetic tap / mouse by project, navigation/cardio/native-dialog focus trap |

<a id="límites-y-pendientes-explícitos"></a>
## Explicit limits and pending work

| Status | Area | Reason / follow-up |
| --- | --- | --- |
| Pre-existing FAIL | Yoga `previews:check` gate | `Extraction receipt is stale`; roadmap/Atlas documented. Exercise 74/74, body 24/24 pass. No regeneration/gate change |
| NOT RUN | Physical phones/screen reader/voice/iOS Safari/virtual keyboard | Available Linux browsers; user physical review |
| NOT RUN | Every health CRUD field/variant, goal metric/deadline, filters/pagination with hundreds of rows | Representative collection cases, not full combinations |
| NOT RUN | Two simultaneous writers to same local keys | Isolated contexts/reload tested; same-origin concurrent writers not |
| NOT RUN | Real clock/OAuth/Health Connect/native Samsung | Normalized import with fictional source; native integration product-deferred |
| NOT RUN | Authenticated account isolation/administration/billing/mail recovery | Independent role sessions; visitor neither authenticates nor sends mail |
| NOT RUN | Offline restart before files downloaded | No service worker; local mode does not guarantee offline app availability |
| NOT RUN | Weekly goal/reduced-motion portability | Device preferences outside personal schema; V02 tests routine order/sets, not every preference |

Two broad initial runs overloaded software WebGL and were interrupted, not counted
as passing. Logs retained; regressions run later. Preparation selector failures and
pnpm executable without postinstall separate from product defects. Final validation
uses installed pnpm binary.

<a id="reproducción-automática"></a>
## Automated reproduction

From root with normal dependencies/browsers:

```sh
pnpm install --frozen-lockfile
pnpm --filter @klisteniapp/b2c-web exec playwright install chromium webkit
pnpm --filter @klisteniapp/b2c-web exec playwright test --config playwright.visitor.config.ts
```

Instance visitor with disposable DB, no real credentials:

```sh
docker run --rm -d --name klisteni-visitor-review-pg \
  -p 127.0.0.1:54339:5432 \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_USER=visitor_qa -e POSTGRES_DB=visitor_qa postgres:17-alpine
TEST_DATABASE_URL=postgresql://visitor_qa@127.0.0.1:54339/visitor_qa \
  VISITOR_INSTANCE=1 \
  pnpm --filter @klisteniapp/b2c-web exec playwright test --config playwright.visitor.config.ts
docker stop klisteni-visitor-review-pg
```

Fixture creates/removes random schema; only needs isolated DB. Do not log in:
local visitor experience is tested. Internal test accounts generated by fixture;
no credential copying/connection activation required.

Harness options: `VISITOR_BROWSERS=chromium,webkit`, `VISITOR_CHROMIUM_PATH`,
`VISITOR_WEBKIT_PATH`, `VISITOR_RUN` for immutable evidence names,
`VISITOR_EXTERNAL_SERVER=1`, `VISITOR_URL` for prepared server.
`VISITOR_EXISTING=1` selects existing educational suites. Cloud used system Chromium/
local-library WebKit launcher; final results need no product-validation bypass.

Accessibility audit without changing application dependencies:

```sh
npm install --prefix /tmp/klisteni-visitor-axe axe-core@4.14.0
VISITOR_AXE_PATH=/tmp/klisteni-visitor-axe/node_modules/axe-core/axe.min.js \
  VISITOR_URL=http://127.0.0.1:4177 node scripts/visitor-accessibility.mjs
```

<a id="checklist-manual-breve"></a>
## Brief manual checklist

1. Run `pnpm dev:demo`, open `http://127.0.0.1:5173` in new profile, check six empty sections.
2. Ajustes → Datos → import [demo-personal.json](validation/b2c-visitor-2026-10-13/demo-personal.json), confirm replacement. Fictional profile/three five-second segments, no invented history.
3. Customize: move Sentadilla up/select one set. Export/import another profile/reload: same order/sets.
4. Record Bici 25 minutes/4.5 km; complete six-set strength; review details/XP/reload/cancel deletion/confirm.
5. Yoga → Mis prácticas → Pausa ficticia QA: start/pause/skip segment/finish now/review/save note. Delete sequence; history record retained.
6. Salud → Importar → [demo-health.json](validation/b2c-visitor-2026-10-13/demo-health.json), review/confirm/repeat: one record, no duplicate. Edit waist/add sleep/meal/goal/reload.
7. Open initial setup/fill draft/visit Privacy/back-forward. Change language/dark mode; keyboard navigation/dialog focus.
8. Repeat at 320/430 px/desktop. Physical-device test complements emulation.

<a id="retorno-para-atlas-sin-escrituras-allí"></a>
## Atlas handoff, without writes there

After review/merge: reading of `main@7172041` and Atlas `27ae86c`, six focused local
visitor corrections, browser matrix/fictional scenarios, document commits/results.
Establishes implementation/local QA, not remote CI/deployment/physical devices.
Retain deferred Blender/previews, failed yoga gate, later backups/integrations.

<a id="resultado-final-y-comandos"></a>
## Final result and commands

Final tested code: `fa6f7b185ce2e506d175be1d8bac659fe462cc0b`; first two fixes in
`ae60efa`, recovery/accessibility `8d35f3e`, harness `316d14d`, WebKit layout
`fa6f7b1`. Report commit only adds documentation/evidence.

- **216/216 role scenarios**, unique case/mode/engine/width, PASS on latest execution.
- **74/74 additional educational journeys**, PASS after corrections/reruns.
- **Real renderer 2/2**, desktop Chromium/WebKit: layers/selection/expansion/keyboard,
  zero JS errors there. Chromium also checked 390×844 baseline, not touch/physical phone.
- **Axe 48/48 surfaces**, zero automatic violations; final audit repeated after overflow fix.
- `pnpm lint`: PASS, 14 tasks + boundaries/B2B format.
- `pnpm typecheck`: PASS, 14 tasks; visitor config in tsconfig.
- `pnpm exec turbo run test --concurrency=1`: PASS, 14 tasks, B2C frontend **201/201**;
  generic suites skip one B2C DB group/ten B2B groups without test variables.
  B2C API rerun on real isolated DB: **97/97**, zero skips.
- Root `node --test scripts/{preview-provenance,preview-workspace-relocation,b2b-boundaries,dev-environment,b2b-gateway}.test.mjs`: **25/25 PASS**.
- `pnpm build`: PASS, 16 tasks; usual large-chunk warning, no build error.
- `pnpm previews:check`: pre-existing FAIL, stale yoga receipt; exercise/body passed.
  `check`/`check:all` not claimed passing.
- `git diff --check`: PASS; Atlas unchanged.

Original runs retained in JSON: main instance **101 PASS / 1 FAIL**, exact-selector
failure on filled V16 textarea; corrected to accessible name/rerun **6/6**.
Original educational **72 PASS / 2 FAIL**: WebKit-incompatible fallback fixture
(repaired), actual Settings overflow (B06). Settings/themes/fallback rerun **16/16**;
CSS-affected role flows demo **30/30**, instance **30/30**. Results replace their
matrix statuses without hiding original exit codes.

API schema retained **1 row / revision sum 1** before/after visitor tests; local
data checked by keys/reloads. QA schema/container removed at completion. API tests
use their own schemas, distinct from fixture.

Selected screenshots/traces preserved in original checkout, excluded from this
publication branch/history. Textual results/fictional fixtures published in
`docs/validation/b2c-visitor-2026-10-13`. Open trace ZIP with
`pnpm --filter @klisteniapp/b2c-web exec playwright show-trace <ruta.zip>`.
Versioned logs retain results/messages; only trailing spaces/final blank lines
normalized. Unnormalized originals remain in `artifacts/visitor-qa`. Complete working
evidence there; local `artifacts/visitor-qa/visitor-local.bundle` transports commits
without publishing the branch in the recorded handoff.
