<a id="qa-b2b-entrenador-de-sede--13102026"></a>
# B2B QA: branch trainer — 2026-10-13

Two duplications after losing backend responses were corrected: creating a routine
and assigning it to a member. Retries retain a stable identity even after reload;
the server checks content, author and context. Published versions and existing
snapshots are not rewritten. This recorded task had no migration, merge, push,
PR or deployment.

**Completion:** 20 flows × 4 projects = **80 unique checks PASS**.
Final rounds total 86 executions (six revalidate T01/T02), without UI failures,
flakes or skips. Final WebKit uses HTTP loopback.

<a id="revisión-y-contexto"></a>
## Revision and context

| Item | Evidence |
| --- | --- |
| Initial checkout | Branch `work`, clean, `7172041102a8a7029af5fb3e2527a1fa51611a86` |
| Update | `git fetch origin`; HEAD equals `origin/main`, divergence `0 0`; no fast-forward needed |
| Exclusive branch | `qa/b2b-trainer-20261013-cloud` |
| Corrections | `077f60790994b510fe0caa89e1c856dbaa793b77` |
| QA checkpoint | `147c7ef`; suite, harness and demonstration; later HTTP adjustment recorded at completion |
| Atlas | `/workspace/sysadmin-workspace`, branch `work`, clean, `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`; fetch without divergence |
| Instructions | Both repos' `AGENTS.md`, `atlas/AGENTS.md` and `.agents/skills/atlas-navigate/SKILL.md` read |
| Product sources | `docs/b2b.md`, `docs/roadmap-implementacion.md`, WL docs, routes, frontend, contracts and API |

Atlas consulted read-only: source policy, catalogs, relations, `wiki/klisteniapp.md`
and October 12 retrospective entry. Deployment evidence is historical. Owner code
confirms existing WL implementation; not reopened as a new product. Production,
GitOps, DNS, payments, mail, remote infrastructure and real data were not queried.

The environment exposes no controls to verify/change model, reasoning or speed.
Platform settings are not claimed to have been verified.

<a id="inventario-previo-a-la-selección-de-casos"></a>
## Inventory before case selection

App: `apps/b2b-web`; trainer works in `/manage`. `/backoffice` retains compatibility.
`Workspace.tsx` and `managementPageAllowed` guard navigation; API authorizes every operation.

| Route/surface | Accessible actions and limits | Coverage |
| --- | --- | --- |
| `/login`, `/manage`, `/backoffice` | Login/logout, explicit branch/role selection; professional access | T01, T03, T10, T11, T16 |
| `/manage/programs` | Create/edit/save/reopen/recover/discard draft; order/remove movements; reps/time/load/RPE/rest/notes/alternatives; publish/read version; assign/cancel assignment/view assignments | T02–T09, T12, T15, T16, T18–T20. Movement removal and 100-movement/10-alternative maxima: UI NOT RUN |
| `/manage/reports` | Totals, authorized people, member selector, planned/actual comparison, partial/complete, reasons/historical prescriptions | T01, T02, T06, T11, T13, T14. Filter between two differently active members: NOT RUN |
| `/manage/people` | Read/search assigned members; no invitations, role changes or trainer assignments | T01, T06, T07, T13 |
| `/manage/catalog` | Search/filter, create exercise/variant, edit/recover/review/publish authorized content, read library | T01, T12, fictional text. Template variants/editor conflicts: NOT RUN |
| `/manage/equipment` | Read equipment/units/resources; administrators configure/publish. Model library/QR links visible by content | Read T01; mutation rejected T07. Models/viewer/previews and QR download/scan: NOT RUN |
| `/manage/media` | List/search/refresh, upload image/video/GLB, open file, reuse from editors | Image/search/persistence/isolation T17; video/GLB/clip comparison/exercise media selection: NOT RUN |
| `/manage/preparation`, `/brand`, `/website`, `/qr`, `/whiteLabel` | Administrator sections: trainer sees permission denial | T01 direct URL |
| `/app` and member-role switch | Selector enters that role's workspace; member cannot enter management | T03. Member training UI outside ownership |
| Website, public page, `/app/invite` | Public/invitation surfaces outside this professional workflow | NOT RUN; independent session coverage |

Retiring an assignment through `/assignments/:id/retire` requires administrator.
No trainer retirement UI action exists; no new product decision added. Permission/
coaching revocation seeded as administrative fixtures without editing that UI.

<a id="entorno-y-límites-de-navegador"></a>
## Environment and browser limits

Node `24.19.0`, PostgreSQL `17.11`, effective pnpm `11.25.0`, Playwright `1.63.0`.
Repo requests pnpm `12.7.0`. Local wrapper puts caches in `/workspace/.cache` and
avoids automatic package-manager reinstallation whose initial path failed;
lockfile/manifests unchanged. Application dependencies already materialized.
Docker PostgreSQL, **fictional disposable** DB `klisteni_b2b_trainer_test`, only
`127.0.0.1:55433`.

One schema/API/gateway/temporary media directory per project. Each case uses
unique names/IDs; revocation/pause fixtures restored in `finally`. Cleanup removes
only runner-created schemas. B2C DB neither read nor changed. Real login limiter
remains active; 429 waits for retry window without weakening the gate.

| Project | Exact engine | CSS viewport | Entry and scope |
| --- | --- | --- | --- |
| C360 | System Chromium `154.0.8037.57` | 360×800, touch, `isMobile` | HTTPS Atlas/Sur, proxy 4362, synthetic certificate with exact SPKI |
| C430 | Chromium `154.0.8037.57` | 430×932, touch, `isMobile` | HTTPS, proxy 4364 |
| C1440 | Chromium `154.0.8037.57` | 1440×1000, no touch | HTTPS, proxy 4366 |
| W390 | WebKit `26.6`, bundle `2359` | 390×844, touch, `isMobile` | Final development HTTP: Atlas `localhost:4468`, Sur `127.0.0.1:4468`; no proxy/added TLS trust |

Browser emulation, **not physical iPhone/Android testing**. Wide/desktop WebKit,
Firefox, mobile hardware and physical scanning: **NOT RUN**.

Bundled Chromium download rejected by network (403); installed Chromium used.
WebKit downloaded through standard fallback. Missing libraries extracted in
workspace and linked to local bundle: no system packages installed or permissions
changed. Final journeys used no host-requirement disabling flag; selected executable
started and rendered actual pages.

**Host WebKit TLS: BLOCKED** by untrusted synthetic CA. Before the subsequent
no-CA-installation instruction, 18 HTTPS journeys passed in a disposable Debian
container with its own trust store; host never received that CA. Container removed
on instruction and evidence retained as separate history. Final HTTP loopback uses
`ignoreHTTPSErrors: false`; Secure cookies/TLS validation for WebKit are not
established. Initial HTTP `.test` did not enable `crypto.randomUUID`; setup moved
to loopback origins without product/security-flag changes.

<a id="matriz-de-flujos"></a>
## Flow matrix

PASS requires visible controls/persisted reads where applicable. FAIL: reproduced
defect; BLOCKED: environment limit; NOT RUN: unexecuted. Member session only creates
fictional records through API.

| Case | Flow | C360 HTTPS | C430 HTTPS | C1440 HTTPS | W390 HTTP |
| --- | --- | --- | --- | --- | --- |
| T01 | Navigation, six sections, protected routes, reload/back/forward | PASS | PASS | PASS | PASS |
| T02 | Reps/time/RPE, alternatives, order, v1/v2, partial/complete history | PASS | PASS | PASS | PASS |
| T03 | Recovery/cancellation; account/branch/role isolation | PASS | PASS | PASS | PASS |
| T04 | Simultaneous two-tab editing and real 409 conflict | PASS | PASS | PASS | PASS |
| T05 | Load 503/retry and rejected write retaining draft | PASS | PASS | PASS | PASS |
| T06 | Empty monitoring/members and assignment cancellation | PASS | PASS | PASS | PASS |
| T07 | Unrelated resources, unassigned member, prohibited mutations | PASS | PASS | PASS | PASS |
| T08 | Assignment: lost response, reload/double click without duplication | PASS | PASS | PASS | PASS |
| T09 | New routine: lost response, reload and single replay | PASS | PASS | PASS | PASS |
| T10 | Expired session, data cleanup and copy recovery | PASS | PASS | PASS | PASS |
| T11 | Branch permission revocation blocks save/changes context | PASS | PASS | PASS | PASS |
| T12 | Review/publish exercise; retirement blocks new assignment/retains snapshot | PASS | PASS | PASS | PASS |
| T13 | Coaching revocation hides data without deleting versions | PASS | PASS | PASS | PASS |
| T14 | Paused service retains reads/blocks mutations | PASS | PASS | PASS | PASS |
| T15 | Late response carries neither copy nor notice into another branch | PASS | PASS | PASS | PASS |
| T16 | Authoring/publication/assignment in two brands/four branches | PASS | PASS | PASS | PASS |
| T17 | Image: invalid format, persisted upload, search/isolation | PASS | PASS | PASS | PASS |
| T18 | Numeric limits and save/publish double click | PASS | PASS | PASS | PASS |
| T19 | Lost publication response: 409 and v1 without v2 | PASS | PASS | PASS | PASS |
| T20 | Lost editing response: explicit recovery of accepted revision | PASS | PASS | PASS | PASS |

T02 checks v1 snapshots after editing/publishing v2 and records complete/partial
execution through API, with substitution/RPE. Trainer reads real screens and
checks prescription columns, missing sets, reason and reload persistence. Mobile
table scroll checked through DOM displacement and alternative-column screenshot;
not presented as physical-phone gesture.

T19 retains publication uncertainty: lost response shows error, old-revision replay
returns 409, reload reveals v1 without creating v2. T20 explicitly resolves the
accepted revision while preserving local copy. No automatic retry added for
non-idempotent mutations.

<a id="defectos-corregidos-y-pendientes"></a>
## Corrected and pending defects

| Defect | Reproduction / prior effect | Correction/regression |
| --- | --- | --- |
| D1: duplicate creation | Save new routine; backend accepts; cut response; retry: two distinct rows with identical content | `Idempotency-Key`, draft identity recoverable by account/branch/role; exact replay returns existing routine. T09 + API + editor/client tests |
| D2: duplicate prescription | Confirm assignment; cut response after commit; retry: two member assignments | Pending identity by account/branch/role/program/version/member survives reload; backend compares author/target/version. T08 + API + client tests |

API accepts optional key only for program/assignment creation. Old callers without
key retain their contract; universal mutation idempotency not claimed. Different-data
replay returns 409, retains local copy and requests list review. Actor/context
changes neither expose nor alter the resource. Checks also require one row/audit
per submission and replay of accepted assignment after catalog content retirement.

[Observed fictional counts/IDs](validation/trainer-2026-10-13/bugs.json),
[previous assignment duplication](validation/trainer-2026-10-13/assignment-response-loss-before.png),
[assignment after correction](validation/trainer-2026-10-13/assignment-response-loss-after.png).
No other confirmed product defects remain in executed cases. NOT RUN cases and
WebKit TLS BLOCKED retain their own limits.

Intermediate harness failures (201 expected as 200, branch not selected in new tab,
fixture with member role, limiter, strict selector matching two identical reasons,
HTTP hostname without secure context, incomplete local record) diagnosed/corrected.
They do not represent seven or more product defects. Existing visual snapshots unchanged.

<a id="verificación-de-código-y-evidencia"></a>
## Code verification and evidence

| Command | Result |
| --- | --- |
| `pnpm lint` | PASS: boundaries, 14 tasks and B2B formatting |
| `pnpm typecheck` | PASS: 14 tasks including new E2E suite |
| `B2B_TEST_DATABASE_URL=… pnpm test` | PASS: 14 tasks; B2B API 77/77 without skips. B2C API 17 pass/1 skip without B2C DB, outside scope |
| `B2B_TEST_DATABASE_URL=… pnpm test:b2b:api` | PASS: initially 76/76; 77/77 after correction |
| `pnpm build` | PASS: 16 tasks, both webs/APIs; existing >500 kB chunk warning |
| `tsc … --types node playwright.trainer.config.ts` | PASS: independent config check |
| `node --check scripts/b2b-trainer-{e2e-server,demo}.mjs` | PASS |
| Main Chromium | 54/54, T01–T18 in three HTTPS viewports |
| Targeted final Chromium | 12/12, T01/T02/T19/T20 in three HTTPS viewports |
| Earlier HTTPS WebKit, removed container | 18/18; historical session evidence, not host TLS gate |
| Final HTTP WebKit | PASS: 20/20 including T19/T20 and alternatives scroll |
| Demo `node scripts/b2b-trainer-demo.mjs --smoke` | PASS: seeded time/reps, alternative/two executions; saw two monitoring cards |
| `git diff --check` | PASS at documentation completion |

Preview generation/validation, complete `pnpm check`, `check:release`, B2C E2E and
remote gates not run. Preview exception does not establish a passing full gate.
Global checks reused Turbo cache on matching hashes; relevant API/client/editor/
E2E changes executed.

JSON, per-case captures, traces and HTML reports remain in
`.cache/trainer/{chromium,final-chromium,final-webkit-http}/`. Selected evidence
versioned in `docs/validation/trainer-2026-10-13/`; final manifest records paths,
hashes, revisions/results. Complete traces contain only fictional local sessions;
retained in Git-ignored workspace without external publication.

<a id="levantar-el-escenario-y-revisión-manual"></a>
## Start scenario and manual review

From repo root with Node 24, installed dependencies and pnpm. Following values
are demonstration-only; never reuse instance credentials. Historical commands
retain recorded certificate settings as evidence; subsequent runs must follow the
current no-bypass/no-trust-change instruction and adapt the harness where required.

Cloud paths used during recorded QA:

```sh
export PATH=/workspace/.cache/qa-bin:$PATH
export PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright
export TRAINER_CHROMIUM_EXECUTABLE=/usr/bin/chromium
export TRAINER_WEBKIT_EXECUTABLE=/workspace/.cache/ms-playwright/webkit-2359/pw_run.sh
```

On another host install normal dependencies/Playwright browsers; omit Cloud-specific
executables/wrapper.

```sh
docker run -d --name klisteni-b2b-trainer-manual \
  -e POSTGRES_DB=klisteni_b2b_trainer_test -e POSTGRES_USER=trainer_qa \
  -e POSTGRES_PASSWORD=local-trainer-fixture-only \
  -p 127.0.0.1:55433:5432 postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
export B2B_TEST_DATABASE_URL='postgresql://trainer_qa:local-trainer-fixture-only@127.0.0.1:55433/klisteni_b2b_trainer_test'
node scripts/b2b-wl-tls.mjs
pnpm build:b2b
TRAINER_WEBKIT_HTTP=1 node scripts/b2b-trainer-e2e-server.mjs
```

This workspace already had a QA container at that port: use it or stop it before
creating another; never reset someone else's DB. In another terminal:

```sh
TRAINER_CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/b2b-trainer-demo.mjs
# Omit TRAINER_CHROMIUM_EXECUTABLE when using Playwright-installed Chromium.
```

Launcher opens a 390×844 touch window, authenticates only fictional trainer,
seeds **Demostración entrenador · tiempo y repeticiones** and two fictional records
through a separate member session. Remains open for review. `--smoke` verifies the
same setup, saves `.cache/trainer/manual-demo.png` and closes. No added system
trust. `--smoke` verified; interactive GUI launch remains NOT RUN, separate from
automated UI journeys. Fixture includes Atlas Centro/Norte and Sur Centro/Oeste;
addresses end in `.example.test`. Synthetic harness password:
`browser-tests-only-password-2026`; no real credentials/mail.

Manual checklist:

1. In Seguimiento open both demo cards. Compare v1, 12/9 reps, 45/38 seconds,
   target/actual RPE, alternative and unrecorded rows. Scroll mobile tables horizontally.
2. In Rutinas create both objectives, alternative/note; save/publish v1 and assign
   fictional member. Edit/publish v2 and check historical v1 record unchanged.
3. Edit without saving, navigate to Personas and return/recover draft. Reload/recover
   again. Switch to Norte: Centro copy must not appear. Return to Centro to recover.
4. Open second tab, select Centro/Entrenador and edit same routine. Save second;
   first-tab save must conflict without overwriting. Explicitly retain/discard copy.
5. Read Personas/Equipamiento; try direct administrator URL. Trainer must receive
   no brand/invitation/role/unit forms.
6. Use T08–T11, T13, T19/T20 for reproducible response loss/revocation/expiration:
   harness simulates after commit and checks persisted rows. Do not pause a real account.

Historical role-test command:

```sh
NODE_EXTRA_CA_CERTS="$PWD/.cache/wl/tls/ca.crt" \
TRAINER_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
TRAINER_WEBKIT_HTTP=1 \
pnpm --filter @klisteniapp/b2c-web exec playwright test \
  --config playwright.trainer.config.ts
```

For local Cloud WebKit add `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright`
and `TRAINER_WEBKIT_EXECUTABLE=/workspace/.cache/ms-playwright/webkit-2359/pw_run.sh`.
Config starts backend unless explicitly using `TRAINER_REUSE_SERVER=1` for **this
same owned harness** already running. No two runners on identical ports.
`TRAINER_RESULTS_ROOT` retains separate results. Do not install a CA on the host.

Server Ctrl-C removes its temporary schemas/media. Stop DB container after all
runners close. Recreating scenario seeds new fixtures; recorded data is not
application data.

<a id="integración-y-retorno-para-atlas"></a>
## Integration and Atlas handoff

Shared cherry-pick files requiring coordination: `apps/b2b-api/src/http.ts`,
`src/training/index.ts`, `src/training/repository.ts`, WL API regression,
`packages/b2b-client/src/client.ts`, `transport.ts` and test. Editor/Programs,
programDraft/editorModels belong to this workflow but administrators also use them.
New QA files independent. Models, previews, existing snapshots and member/admin UI unchanged.

Later Atlas intake: local trainer review from `7172041`, two duplicates corrected
in `077f607`, two-brand/four-branch fixtures, Chromium mobile/desktop and emulated
WebKit UI; host WebKit TLS blocked, final HTTP loopback. Local gates and manual/
physical/production acceptance separate. KB intact; historical deployment, backup,
preview or integration evidence not renewed.
