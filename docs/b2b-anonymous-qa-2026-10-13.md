<a id="qa-b2b-visitante-anonimo--2026-10-13"></a>
# Anonymous B2B visitor QA — 2026-10-13

Final: **252/252 UI cases PASS**, zero failures/skips/retries/flakes in the final
11-minute run. API **80/80 PASS**. Establishes neither production nor physical
phones. WebKit HTTPS remains BLOCKED; functional matrix uses HTTP.

<a id="revision-y-alcance"></a>
## Revision and scope

- Owner repo: `pablitxn/klisteniapp`, checkout `/workspace/klisteniapp`.
- Initial: branch `work`, clean tree, `7172041102a8a7029af5fb3e2527a1fa51611a86`.
  Fetch confirmed `HEAD...origin/main = 0 0`; no fast-forward required.
- Original local branch: `qa/b2b-anonymous-20261013`.
- Publishable variant: `qa/b2b-anonymous-20261013-publicable`; retains four code/QA
  commits, omits binary commit.
- Fixes: `7542001dba4bacb512b58c6ad1f3a7bb89ba4797`.
- Matrix/fixtures: `0aa942e`; expansion/launcher `435ef3a`; final QA typing fix
  `128d332b11822b4df4aedae0f3d55bc8cf357441`.
- Atlas: `/workspace/sysadmin-workspace`, branch `work`, clean,
  `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`. Fetch confirmed origin/main parity;
  content read only, no Atlas update.
- Role: unsigned visitor in Atlas Centro/Norte and Sur Centro/Oeste. Websites,
  published catalog/equipment, images/video/plan, per-unit QR, login entry, aliases,
  invalid URL/privacy/read recovery.
- No real data, production, DNS, payments, SMTP or infrastructure operated.
  Variant prepared for authorized push/draft PR; no merge/deploy. Model/preview files retained.

Read `AGENTS.md`, local `atlas-navigate`, authority policy, `atlas/wiki/klisteniapp.md`,
KLI-01 retrospective, `docs/roadmap-implementacion.md`, `docs/b2b.md`,
`docs/b2b-white-label.md`, `docs/b2b-white-label-runtime.md`, `docs/development.md`.
Atlas documents implemented white-label and pending previews/Blender/recurring
backups/physical acceptance. Release tests retain SHA/date, not reused as this run's result.

<a id="inventario-anterior-a-elegir-casos"></a>
## Inventory before case selection

Derived from `apps/b2b-web/src/routes.ts`, `App.tsx`, `ApplicationProvider.tsx`,
`features/public/*`, `ExerciseDetails.tsx`, `VoiceGuide.tsx`, `Invitation.tsx`,
`packages/b2b-ui/src/{components,login}.tsx`, `content/*`, API `http.ts`,
`service.ts`, `white-label-service.ts`, `equipment/index.ts`, `catalog/index.ts`.

| Route / surface | Actions without account | Coverage |
| --- | --- | --- |
| `/`, `/gimnasios` | Brand/branches, Ingresar, Entrar a mi espacio, logo to `/app`, skip link | A01, A14, A20, A21, A26, A30, A33, A36 |
| `/sedes/:slug` | Activities/schedules/contact/gallery/video controls/plan-list/equipment links/branch login | A02-A05, A08-A12, A18-A19, A29 |
| `/g/:slug` | Brand website/schedules/gallery/login; reject other-brand slug | A07, A13, A16, A30 |
| `/g/:slug/units/:unitId` | QR/settings/media/expandable instructions/return to gym/routine-login entry | A03, A05-A06, A10-A12, A27-A28 |
| `/login` | Email/password/validation/submission/error/busy state | A05, A14, A22-A23, A31 |
| `/app`, `/app/{routines,catalog,history,history/all}` | Login, no private content; QR retains unit/machine/branch | A06, A24 |
| `/manage`, `/manage/{reports,people,programs,catalog,equipment,brand,preparation,website,media,qr,whiteLabel}` | Login, no administrative content | A24 |
| `/backoffice`, management aliases | Canonicalize to `/manage`; anonymous guard | A24, existing route tests |
| `/app/invite` | Activation/existing-account entry; invalid invitation creates no account | A25, A36; valid flow belongs to invited role |
| Missing route/slug/unit, malformed encoding | Missing page/recoverable error or gateway 400 rejection | A15, A32 |
| Alias/unknown host | Canonical redirect without fragment; reject sensitive queries/unknown host | A17 |
| `/api/b2b/media/:id` | Currently published references only; GET/HEAD/Range | A07-A09, A16, A34, API regressions |
| Optional voice script/movement viewer | Text/browser voice/explicitly requested animation | A35 no-speech fallback; animation/models and physical audio NOT RUN |
| Legacy `GymEntry` | Gym code/validation | NOT RUN: six fixtures use white-label domains; no public directory |

<a id="defectos-corregidos"></a>
## Corrected defects

| ID | Previous reproduction/result | Correction/regression |
| --- | --- | --- |
| PUB-01 | Norte showed general Atlas address/contact despite its own published profile | API uses branch `published_profile` for website/QR contact, never draft. A04 + API |
| PUB-02 | Norte QR header login lacked `branch`; return opened general landing page | Derive branch from `unit.branchId`; login/return retain public branch. A05, A27 |
| PUB-03 | Image published only in brand gallery returned 404 | `mediaAccess` checks published landing references plus theme/branches. A07 + GET/HEAD/Range/revocation/API isolation |
| PUB-04 | Public branches/unpublished landing caused 404 read/error on landing | `context.websitePublished` reflects landing publication; branches remain independent. A13 + API |
| PUB-05 | Context failure required reload with only error | Reintentar calls `brand.refresh`. A20 |
| PUB-06 | Landing-read failure had no recovery action | Reintentar calls `website.reload`. A21 |

API also requires `published_profile` for direct QR resolution: knowing a unit
cannot expose incompletely published branch. Dedicated new regression plus UI
unpublished-branch cases.

<a id="setup-real-y-limites-de-herramientas"></a>
## Actual setup and tool limits

Node `24.19.0`, pnpm `12.7.0` preinstalled in `.onboarding/tools`, Playwright
`1.63.0`, PostgreSQL `17.11` in owned container, DB `b2b_anonymous_test`,
`127.0.0.1:55439`. Per-project random schema/API/gateway/restricted proxy/separate
media directory. No development DBs. Teardown removes only owned schemas/directories.

System Chromium `154.0.8037.57`, HTTPS with ephemeral CA/exact-certificate SPKI
exception; `ignoreHTTPSErrors=false`. WebKit `26.6`, Playwright `2359`: functional
HTTP tests on two distinct local hosts. HTTPS WebKit **BLOCKED** by rejected CA;
`SSL_CERT_FILE` does not change trust store. TLS not disabled/system CA not installed.
These are historical settings; future tests must not reuse certificate bypasses
or change trust under the subsequent user instruction.

WebKit/FFmpeg downloaded through accepted alternate mirror; initial mirrors
returned 403 Domain forbidden. Bundled Chromium unavailable; installed Chromium
used. Missing WebKit libs downloaded from Debian trixie/extracted into
`.cache/qa-anonymous/libroot`: `libgtk-4-1`, `libgraphene-1.0-0`,
`libharfbuzz-icu0`, `libmanette-0.2-0`, `libhyphen0`, `libgles2`,
`libcairo-script-interpreter2`, `libhidapi-hidraw0`, `libglvnd0`, `libopengl0`,
`liblzo2-2`; also `gstreamer1.0-libav`, `gstreamer1.0-plugins-good`,
`gstreamer1.0-tools` for H.264/MP4. Versioned
`scripts/qa-b2b-anonymous-webkit.sh` restores bundle-launcher `LD_LIBRARY_PATH`
and runs same MiniBrowser. WPE media cache uses workspace
`WPE_SHELL_MEDIA_DISK_CACHE_PATH` instead of unwritable `/var/tmp`; TMP/XDG/
GStreamer use owned directories. Host permissions/packages/trust store unchanged.
H.264 plugin/actual playback advancing `currentTime` verified, not only
`canPlayType`. Isolated-namespace attempt failed with `setting up uid map:
Read-only file system`; no escalation/environment change.

Preliminary tests corrected harness assumptions: `/media` is not `/me`, a fragment-
removing redirect may end in `#`, `/g/%ZZ` returns 400 before SPA render.
Lost-response test uses real-backend `route.fetch()` and `NODE_EXTRA_CA_CERTS`
so Node validates same local CA without disabling checks.

<a id="reproducir-el-escenario-y-revisar-manualmente"></a>
## Reproduce scenario and manual review

Recorded Cloud had tools/dependencies; root
`source /workspace/.onboarding/activate.sh` selects pnpm 12.7.0. Other checkout:
Node 24+, pnpm 12.7.0, FFmpeg, Docker/lockfile dependencies:
`pnpm install --frozen-lockfile`. Do not copy `.env` or real accounts.
Historical commands below preserve recorded setup; future runs require isolated
HTTP loopback or valid HTTPS with existing trust, without new bypass/trust changes.

```sh
# NEW owned container; choose another name/port if occupied.
docker run -d --name klisteni-qa-anonymous-demo \
  -p 127.0.0.1:55439:5432 \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=b2b_anonymous_test postgres:17
# Wait for pg_isready to confirm availability.
docker exec klisteni-qa-anonymous-demo pg_isready -U postgres
pnpm --filter @klisteniapp/b2b-web build
node scripts/b2b-wl-tls.mjs
```

DB has no real credentials, loopback only. Manual scenario needs no login.
Harness generates internal ephemeral secrets without printing them; seeds only
fictional people/activity.

```sh
# Terminal 1: manual scenario; leave this process running.
B2B_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55439/b2b_anonymous_test \
QA_WEBKIT_HTTP=true node scripts/qa-b2b-anonymous-server.mjs

# Terminal 2: restore normal/another preset for project 0 (Chromium 360).
curl -fsS -X POST 'http://127.0.0.1:4348/fixture?project=0&case=normal' -o /dev/null
```

Preset cases: `normal`, `hiddenBranch`, `archivedBranch`, `unpublishedBranch`,
`empty`, `hiddenUnit`, `archivedUnit`, `unpublishedMachine`, `unpublishedRoot`,
`noBranches`, `websiteOff`, `equipmentOff`, `mediaOff`, `noExercises`. `mediaOff`
available for demo but absent from executed matrix. Each change restores base
before applying case; never use fixture controls during active suite.

`atlas.b2b.test`, `sur.b2b.test`, `alias.b2b.test`, `unknown.b2b.test` resolve through
loopback proxies without hosts/DNS edits. Chromium projects 0/1/2: proxy
4342/4344/4346; WebKit 3/4/5: 4350/4352/4354. Historical GUI helper:
`node scripts/qa-b2b-anonymous-open.mjs --touch`, omit `--touch` for desktop.
`--headless --touch` verifies launch/saves `.cache/manual-open.png`. Helper uses
exact proxy/SPKI, no global trust/public link; adapt before new runs.

```sh
# Terminal 2: automated Cloud matrix, with terminal 1 scenario.
NODE_EXTRA_CA_CERTS="$PWD/.cache/wl/tls/ca.crt" \
QA_WEBKIT_HTTP=true \
QA_WEBKIT_EXECUTABLE="$PWD/scripts/qa-b2b-anonymous-webkit.sh" \
QA_REUSE_SERVER=true \
pnpm --filter @klisteniapp/b2c-web exec playwright test \
  --config playwright.anonymous.config.ts

# Report/selected trace; use exact results-listed path.
pnpm --filter @klisteniapp/b2c-web exec playwright show-report \
  ../../.cache/qa-anonymous/report
pnpm --filter @klisteniapp/b2c-web exec playwright show-trace /ruta/a/trace.zip
```

Historical guide allowed omitting `QA_WEBKIT_HTTP`/`QA_WEBKIT_EXECUTABLE` on a
machine with WebKit/CA. Current instruction requires existing valid trust without
new trust changes. Chromium-only: `--project=anonymous-chromium-narrow` (or
`wide`/`desktop`). Without `QA_REUSE_SERVER=true`, Playwright builds/creates/removes
its own scenario; pass DB variable. No public-domain changes authorized.

Brief manual checklist (normal fixture, unsigned browser):

1. Open Atlas/Sur, compare brands, visit Centro/Norte/Oeste at 360/430/1440 CSS px
   (touch helper opens 360; matrix covers three). Read schedules/published contacts.
2. Norte → Polea 01 from card/plan list. Reload/back/forward, verify unit/branch,
   expand/collapse written instructions.
3. Use "Ver el gimnasio", "Mi espacio", "Ver este equipo en mi rutina"; check
   Norte and unit/machine URL parameters for routine. Visitor sees login.
4. Review landing/branch galleries, play/pause synthetic clip, open long-title
   unit. Do not request viewer/model/animation.
5. Apply hidden/archived/unpublished branch/unit; card/marker/QR absent.
   `empty`/`noBranches`: messages/login access.
6. Cut a DevTools read/retry; empty/invalid-email validation/invented credentials.
   No visit records training.
7. Both-brand tabs/foreign/missing URLs: no private content. Restore `normal`.

SIGTERM/Ctrl-C harness, check cleanup. Stop only owned fictional container;
leave others' containers/volumes untouched. QA container uses no persistent volume.

<a id="integracion-entre-roles-y-retorno-para-atlas"></a>
## Role integration and Atlas handoff

Shared cherry-pick review: API `service.ts`, `white-label-service.ts`; web
`App.tsx`, `BrandEntry.tsx`, `PublicGym.tsx`. Regressions/config/helpers have distinct
names; contracts/shared packages/CSS/models/previews unchanged. Branch website/QR
contact uses frozen public branch profile; landing retains general brand contact.

Later Atlas intake: local anonymous QA revision/evidence, six fixes, API 80/80,
browser protocols and physical/TLS limits. Do not replace October 11 deployment
snapshots or claim these commits deployed. Previews/Blender/recurring backups
remain deferred. Member session must review authorized branch precedence after
QR login: this task checks anonymous parameters/entry, not post-login selection.

<a id="resultados-y-evidencia-final"></a>
## Final results and evidence

Final run: `2026-10-13T10:51:54.398Z`, 662.871 seconds, 3 workers, 42 cases/project,
no retries. Full-run revision `435ef3a`. Final check found TS2352 in test A33's
injected-property annotation; corrected in `128d332` without product/assertion
changes. Final types/lint/format PASS; A33 rerun **6/6 PASS**. JSON retains both
cuts. Every test checks no horizontal overflow/private markers and compares
11-table counts/hashes before/after. Executions/audits remain zero; 13 accounts,
four branches, six units, four assignments/five media fictional. Zero unexpected
JS errors in final run. Fixture controls mutate only owned schema before baseline.
A24 uses expired fictional cookie/checks unsigned visitor; not UI expiration of
an actual authenticated session.

| Project | Verified engine | CSS viewport | Touch / mobile | Transport | Result |
| --- | --- | --- | --- | --- | --- |
| anonymous-chromium-narrow | 154.0.8037.57 | 360x800 | true / true | HTTPS | 42/42 PASS |
| anonymous-chromium-wide | 154.0.8037.57 | 430x932 | true / true | HTTPS | 42/42 PASS |
| anonymous-chromium-desktop | 154.0.8037.57 | 1440x1000 | false / false | HTTPS | 42/42 PASS |
| anonymous-webkit-narrow | 26.6 | 360x800 | true / true | HTTP | 42/42 PASS |
| anonymous-webkit-wide | 26.6 | 430x932 | true / true | HTTP | 42/42 PASS |
| anonymous-webkit-desktop | 26.6 | 1440x1000 | false / false | HTTP | 42/42 PASS |

Default device scale 1, es-AR, UTC, light, reduced motion. A33 checks touch
pointerType via tap() in four mobile projects, mouse desktop. Others use click/
keyboard/history; emulated contexts without physical-phone UA/hardware identity.

| Executed check | Result |
| --- | --- |
| Fetch both repos | Clean, origin/main parity, no discarded work |
| `pnpm lint` | PASS, boundaries + 14 tasks + B2B format |
| `pnpm typecheck --concurrency=2` | PASS, 14 tasks |
| `B2B_TEST_DATABASE_URL=... pnpm test --concurrency=2` | PASS, 25 root tests + 14 tasks; existing API 76/76 |
| `pnpm --filter @klisteniapp/b2b-api test` with isolated DB | Final PASS 80/80, four new regressions, zero skips |
| `pnpm build --concurrency=2` | PASS 16 tasks; existing large-chunk warning |
| Playwright config types with dedicated tsconfig | PASS |
| Node/bash syntax, helper formatting | PASS |
| QA lint/types/format on `128d332` | PASS after test TS2352 fix |
| Final A33 rerun in six projects | PASS 6/6 |
| Final Playwright matrix | PASS 252/252, 3 workers, no retries/skips/flakes |
| Helper `--headless --touch` | PASS, local manual-open.png; manual GUI NOT RUN |
| `pnpm previews:check` | PRE-EXISTING FAIL: yoga Extraction receipt is stale; receipt intact |
| Complete `pnpm check`, `check:all`, `check:release` | NOT RUN complete; preview gate not claimed passing |

First full pre-setup-fix matrix: 221/228; three codec/cache video failures, three
timeouts, one WPE canceled-fetch diagnostic. Retained in
`.cache/qa-anonymous/matrix-initial-results`, `matrix-initial-results.json`.
Next interrupted for cache/temp repairs and waiting for actual landing load before
negative absence assertions. No retries/weakened assertions added. Final reran
ALL cases in six projects; video checks advancing currentTime. Timings establish no load SLA.

No pending reproducible role defects in executed cases.

| Limit / pending | Status | Reason |
| --- | --- | --- |
| WebKit HTTPS with local CA | BLOCKED | Unacceptable TLS certificate; SSL_CERT_FILE changes no store; global trust intact |
| Phones/real Safari/printed QR/camera | NOT RUN | No hardware; later manual checklist |
| Real sound/native voice | NOT RUN | Text/no-speech fallback tested; audible audio not |
| Models/viewers/previews | UI NOT RUN | Scope-deferred; originals intact |
| Valid login/post-QR selection | UI NOT RUN | Separate role sessions; anonymous entry/parameters verified |
| Legacy GymEntry/mediaOff fixture | NOT RUN | Outside executed white-label matrix |
| Complete CI/merge/deploy | NOT RUN | Recorded local commits; previous preview gate pending |

[252-case textual summary](validation/b2b-anonymous-2026-10-13/summary.json)
retains engines/viewports/protocols/flow states/final touch recheck. Full captures,
traces/table hashes/logs remain local in original branch/verified role Git package.
Variant adds no captures/traces/real data/secrets/large evidence blobs remotely.
Representative screenshots from both engines visually reviewed; others inspected
through snapshots/assertions/traces, not human pixel-by-pixel review or modified
visual-snapshot comparisons.

Final cleanup verified: **0 remaining b2b schemas** in disposable DB, harness stopped,
owned `klisteni-qa-anonymous-20261013` container stopped. Evidence/cache/checkout
retained. Review requires above scenario/new container, no background process dependency.

<a id="matriz-completa-de-flujos"></a>
## Complete flow matrix

C = Chromium HTTPS; W = WebKit HTTP. CSS-width columns; per-case captures/trace.zip
in JSON-recorded directory. A10/A11 fixtures are independent cases.

| Flow / fixture | C360 | C430 | C1440 | W360 | W430 | W1440 |
| --- | --- | --- | --- | --- | --- | --- |
| A01 Atlas and Sur show distinct brands and every public branch | PASS | PASS | PASS | PASS | PASS | PASS |
| A02 all four branch pages load with their published catalog and schedules | PASS | PASS | PASS | PASS | PASS | PASS |
| A03 navigation through branch catalog QR reload and browser history | PASS | PASS | PASS | PASS | PASS | PASS |
| A04 branch published contact differs from private profile drafts | PASS | PASS | PASS | PASS | PASS | PASS |
| A05 QR header login and return link preserve the unit branch | PASS | PASS | PASS | PASS | PASS | PASS |
| A06 QR routine entry retains unit machine branch and login context | PASS | PASS | PASS | PASS | PASS | PASS |
| A07 root-only published gallery loads real image bytes | PASS | PASS | PASS | PASS | PASS | PASS |
| A08 published branch media and video controls load and play | PASS | PASS | PASS | PASS | PASS | PASS |
| A09 floor plan marker opens the unit; failed image keeps the textual route | PASS | PASS | PASS | PASS | PASS | PASS |
| A10 hiddenBranch hides branch and QR without exposing private content | PASS | PASS | PASS | PASS | PASS | PASS |
| A10 archivedBranch hides branch and QR without exposing private content | PASS | PASS | PASS | PASS | PASS | PASS |
| A10 unpublishedBranch hides branch and QR without exposing private content | PASS | PASS | PASS | PASS | PASS | PASS |
| A10 websiteOff hides branch and QR without exposing private content | PASS | PASS | PASS | PASS | PASS | PASS |
| A11 hiddenUnit removes catalog entry QR and floor marker | PASS | PASS | PASS | PASS | PASS | PASS |
| A11 archivedUnit removes catalog entry QR and floor marker | PASS | PASS | PASS | PASS | PASS | PASS |
| A11 unpublishedMachine removes catalog entry QR and floor marker | PASS | PASS | PASS | PASS | PASS | PASS |
| A11 equipmentOff removes catalog entry QR and floor marker | PASS | PASS | PASS | PASS | PASS | PASS |
| A12 empty branch equipment and no published exercises have usable empty states | PASS | PASS | PASS | PASS | PASS | PASS |
| A13 unpublished organization website keeps branch navigation and login usable | PASS | PASS | PASS | PASS | PASS | PASS |
| A14 brand without published branches retains login and empty guidance | PASS | PASS | PASS | PASS | PASS | PASS |
| A15 invalid routes encoded slugs unknown gym branch and unit fail safely | PASS | PASS | PASS | PASS | PASS | PASS |
| A16 private media foreign brand URLs and auth-only endpoints are inaccessible | PASS | PASS | PASS | PASS | PASS | PASS |
| A17 unknown host and canonical alias redirects reject secret queries | PASS | PASS | PASS | PASS | PASS | PASS |
| A18 branch request failure response loss and retry recover without stale data | PASS | PASS | PASS | PASS | PASS | PASS |
| A19 cancelled slow branch response cannot replace a different route | PASS | PASS | PASS | PASS | PASS | PASS |
| A20 public context error offers a retry and recovers | PASS | PASS | PASS | PASS | PASS | PASS |
| A21 landing website request error can be retried | PASS | PASS | PASS | PASS | PASS | PASS |
| A22 login native validation wrong credentials and double submit stay anonymous | PASS | PASS | PASS | PASS | PASS | PASS |
| A23 login response loss leaves a retryable anonymous form | PASS | PASS | PASS | PASS | PASS | PASS |
| A24 every protected route shows login with expired synthetic cookies | PASS | PASS | PASS | PASS | PASS | PASS |
| A25 invalid invitation is safe and has no account side effects | PASS | PASS | PASS | PASS | PASS | PASS |
| A26 double activation of a branch link keeps one public context and no session | PASS | PASS | PASS | PASS | PASS | PASS |
| A27 all four branch QR units and long title stay readable and isolated | PASS | PASS | PASS | PASS | PASS | PASS |
| A28 published text instructions expand and collapse without loading a model | PASS | PASS | PASS | PASS | PASS | PASS |
| A29 two simultaneous brand tabs expose only their own public data | PASS | PASS | PASS | PASS | PASS | PASS |
| A30 keyboard skip link and normal brand route aliases remain usable | PASS | PASS | PASS | PASS | PASS | PASS |
| A31 foreign query parameters do not expose a workspace or switch the brand | PASS | PASS | PASS | PASS | PASS | PASS |
| A32 malformed percent encoding is rejected at the document gateway | PASS | PASS | PASS | PASS | PASS | PASS |
| A33 touch activation uses real touch pointer events in the mobile viewport | PASS | PASS | PASS | PASS | PASS | PASS |
| A34 unpublishing branch or brand revokes direct anonymous media access | PASS | PASS | PASS | PASS | PASS | PASS |
| A35 browser without speech retains the full published written instructions | PASS | PASS | PASS | PASS | PASS | PASS |
| A36 brand logo enters login and invitation account entry can be cancelled | PASS | PASS | PASS | PASS | PASS | PASS |
