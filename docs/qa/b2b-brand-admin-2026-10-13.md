<a id="qa-e-implementación-administrador-de-marca-b2b--13102026"></a>
# QA and implementation: B2B brand administrator — 2026-10-13

**Completed: 108 unique UI groups passed** (27/profile), through runs/reruns detailed
below. Lint/types/587 tests (including B2B API 77/77)/B2B build passed. Eight issues
corrected in local commits; no active blocker. Matrix explicitly retains unexecuted cases.

Final tested code: `a87daf4f8460e6dd710defca8bea57b0f8bf9414`. Base:
`7172041102a8a7029af5fb3e2527a1fa51611a86`; branch `qa/b2b-brand-admin-20261013`.
Evidence commits complete report/artifacts. Later handoff disables config TLS
exception without repeating suite; browser results still correspond to historical
protocol documented below.

<a id="revisión-y-aislamiento"></a>
## Revision and isolation

- Initial clean checkout, branch `work`, HEAD `7172041102a8a7029af5fb3e2527a1fa51611a86`.
- `git fetch origin`, `git merge --ff-only origin/main`: already current; no reset/
  discard. Own branch `qa/b2b-brand-admin-20261013`.
- Atlas: `/workspace/sysadmin-workspace`, HEAD `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`,
  initial branch `work`, clean/current after fetch/fast-forward. No edits.
- Read both repo instructions/`atlas/AGENTS.md`, local
  `.agents/skills/atlas-navigate/SKILL.md`, authority policy, Klisteniapp wiki/
  retrospective/catalog, `docs/roadmap-implementacion.md`, B2B product/white-label decisions.
- `seedWhiteLabelDemo` fixtures: Atlas/Sur, Centro/Norte and Centro/Oeste. Each project
  owns PostgreSQL/random schema/sessions/media. Runner adds fourth WebKit context
  through `B2B_QA_EXTRA_PROXY=true`; WebKit ran after Chromium with new server.
  Runner rejects DB names without B2B/test and URLs with `options`; all actual
  connections loopback/disposable.
- No production/DNS/payments/mail/models/3D authoring/previews changed. No merge/
  deploy/push/PR in this recorded task.

<a id="motores-y-límites-del-entorno"></a>
## Engines and environment limits

| Project | Engine | CSS viewport | Mobile/touch | Final result |
| --- | --- | --- | --- | --- |
| admin-chromium-narrow | System Chromium 154.0.8037.57 | 320 × 740 | yes/yes | PASS 27/27, aggregated runs |
| admin-chromium-wide | System Chromium 154.0.8037.57 | 412 × 915 | yes/yes | PASS 27/27, aggregated runs |
| admin-chromium-desktop | System Chromium 154.0.8037.57 | 1440 × 1000 | no/no | PASS 27/27, aggregated runs |
| admin-webkit-touch | Playwright WebKit 26.6, build 2359, Linux WPE | 390 × 844 | yes/yes | PASS 27/27, aggregated runs |

Emulated engine tests, not physical iPhone/Android/iOS Safari. Locale `es-AR`, UTC,
reduced motion. Captures show actual screens served by Vite build/gateway/API/PostgreSQL.

Playwright 1.63.0, Node 24.19.0, pnpm 12.7.0 (general PATH was 11.25.0; used
`/workspace/.onboarding/tools/node_modules/.bin`). Playwright Chromium download 403;
available Chromium used. WebKit/FFmpeg from official alternate mirror. Missing
libs downloaded as Debian packages/extracted to `/workspace/.cache/webkit-deps`,
no system installation. Local launcher retains bundle paths/adds library folder.
Actual engine smoke reported `26.6 Engine ready`.

Actual protocol: browser → HTTP CONNECT proxy `127.0.0.1:4350` for WebKit → HTTPS/TLS
gateway `127.0.0.1:4448` → internal HTTP API `127.0.0.1:4449`. Browser URLs:
`https://atlas.b2b.test`, `https://sur.b2b.test`. Fixture certificate self-signed
by disposable local CA. Three Chromium projects used same scheme/own ports.

**All four projects used `ignoreHTTPSErrors: true` during historical tests.** Browser
certificate rejection bypassed; evidence establishes neither chain/CA validation,
server TLS identity nor system trust. Trust store unchanged. WebKit was Linux WPE
26.6 through Playwright `--inspector-pipe`, emulated touch, not physical Safari/iOS.

October 11 historical WL evidence uses different protocol:
`playwright.white-label.config.ts` has `ignoreHTTPSErrors: false`, but Chromium
uses `--ignore-certificate-errors-spki-list` for exact fixture certificate; runtime
guide records temporary CA trust for WebKit. These are SPKI exception/temporary
trust change, not valid public certificates or evidence from this task.

**Future-test handoff rule:** isolated HTTP loopback or HTTPS with valid certificate/
existing trust. No `ignoreHTTPSErrors`, SPKI exceptions,
`NODE_TLS_REJECT_UNAUTHORIZED=0` or browser/system trust changes. Branch config now
sets `ignoreHTTPSErrors: false`; not rerun per user instruction. Current self-signed
HTTPS fixture cannot run under that rule until adapted to permitted alternative.

<a id="inventario-previo-de-rutas-y-acciones"></a>
## Prior route/action inventory

Source: `apps/b2b-web/src/routes.ts`, `app/Workspace.tsx`,
`app/ManagementWorkspace.tsx`, features. API checks permissions independently of navigation.

| Route | Administrator actions | Scope |
| --- | --- | --- |
| `/manage` | Choose branch/role, logout, preparation/monitoring entry | Brand/context |
| `/manage/whiteLabel` | Branches/access, published design, modules/catalog/transfers, brand-history export | Brand/explicit branch |
| `/manage/preparation` | Read readiness/open pending sections | Branch |
| `/manage/reports` | Filter members/read saved prescriptions/executions | Branch |
| `/manage/people` | Search/invite/copy link/change role-membership/pause-reactivate/assign coaching | Brand membership/branch coaching |
| `/manage/programs` | Create/edit/recover/movements-prescriptions/publish version/open-cancel-assign | Branch/immutable snapshots |
| `/manage/catalog` | Search/filter/create/adapt/edit/recover/review/publish exercises | Availability/owner catalog |
| `/manage/equipment` | Units/batches/settings-resources/recovery-conflicts/publish-retire-restore/QR | Branch |
| `/manage/media` | Upload/search/select/open/retry; optional private clip comparison | Branch library/authorized resources |
| `/manage/website` | Text/activities/schedules/gallery; save/recover/compare/review/publish/unpublish; optional plan | Branch |
| `/manage/qr` | Diagnostics/select-clear/generate/open pages/print-download | Eligible public units |
| `/manage/brand` | Legacy URL identity, absent from WL navigation | Compatible route/render verified; legacy edit NOT RUN |
| `/login`, `/backoffice/*` | Shared login/link compatibility | Legacy canonicalized to `/manage/*` |
| `/`, `/sedes/:slug`, `/g/:slug/units/:id` | Entry/read published content/QR | Public brand/branch |
| `/app/invite#token=…` | Fictional activation/one-use/existing account | Brand/branch invitation |

UI displays model library/optional viewer; editing/authoring excluded by user.
Domain/bootstrap/service and other CLI-only operator tools not implemented in UI.

<a id="bugs-reproducidos-y-corregidos"></a>
## Reproduced and corrected bugs

| ID | Before | Correction | Regression/evidence |
| --- | --- | --- | --- |
| ADMIN-01 | People displayed branch grants, omitted administrators, changed global memberships with inconsistent visible roles | Admin brand roster; separate scoped coaching list; explicit scope text | `people` baseline; visible admin/last-admin/promotion-reversal/pause-reactivation/scoped selection E2E |
| ADMIN-02 | Duplicate branch slug caused generic 500 | Atomic `ON CONFLICT`, HTTP 409 `BRANCH_SLUG_TAKEN`; no overwrite/duplicate | Validation/duplicate E2E and HTTP test with real DB count |
| ADMIN-03 | Design lost navigation edits, unrecoverable conflict, fields editable during submission | Per-account/context local copy/original revision/explicit compare-rebase/locked controls/current-component guard | `theme` baseline; reload/navigation/conflict/publication/restoration/late-response regressions |
| ADMIN-04 | Branch lost unsaved address on reload; 409 without compare/continue | Local copy/controlled fields/latest revision/explicit compare-rebase; no remount each revision | `branch` baseline; reload/real concurrent update E2E |
| ADMIN-06 | Mobile role selectors showed arrow only; brand roster did not resolve foreign-branch coach names | Readable minimum width/brand-roster lookup | `role-layout` baseline, actual text measurement/three Chromium reruns |
| ADMIN-07 | WebKit header overflowed 44 px with long branch name | Local selector containment/flex limits/container-visible focus; no body/html overflow hiding | 434/390 geometry, long-branch fixture/four-profile rerun |
| ADMIN-08 | Return before exercise/routine ACK unmounted editor, left stale list despite persisted save | Return disabled while saving; general navigation retains recovery | Two regressions with committed/held PUT response; four profiles |
| ADMIN-05 | Reopening fragment invitation retained previous success without revalidation | Token state/hashchange-popstate sync/post-acceptance cleanup | `invitation` baseline; fictional activation then same-document used-link rejection |

Local code corrections: `94c9eb8`, `a889a4c`, `a87daf4`; QA checkpoint `49459ab`.
Final commit stores definitive report/manifest. Contracts/authorization unchanged.
Local copy does not validate incomplete fields; server/publication still validate.
Key retains account/brand/branch/role. Design belongs to brand, but copy retains
opening operational context: return to that branch to recover.

<a id="matriz-de-flujos"></a>
## Flow matrix

PASS means latest flow/project result, not one clean full-suite run. Manifest
retains all earlier attempts/failures/diagnostics. Requires UI interaction and
persisted verification for writes. APIs prepare fixtures/conflicts/errors/check
effects, without replacing screen inspection.

| Flow | Fixture/condition | Chromium 320 | Chromium 412 | Desktop | WebKit 390 | Check |
| --- | --- | --- | --- | --- | --- | --- |
| 11 routes, both Atlas branches | Initial Atlas data | PASS | PASS | PASS | PASS | 22 screens/project; no overflow/alerts/JS errors |
| 11 routes, both Sur branches | Initial Sur data | PASS | PASS | PASS | PASS | 22 screens/project |
| Back-forward/reload | Personas → Website, both brands/branches | PASS | PASS | PASS | PASS | URL/context retained |
| People/brand roles | Admin/multicontext | PASS | PASS | PASS | PASS | Last admin protected; role after reload |
| Pause/reactivate/coaching | Brand member/Centro member-coach | PASS | PASS | PASS | PASS | Real state; selector excludes Norte |
| No-match person search | Fictional query | PASS | PASS | PASS | PASS | Empty table |
| Create branch/validation | Empty/invalid zone/duplicate slug | PASS | PASS | PASS | PASS | One branch row/recoverable error |
| Grant/revoke access | New-branch member without activity | PASS | PASS | PASS | PASS | Grant appears/disappears |
| Save branch/reload/conflict | Local address/real concurrent update | PASS | PASS | PASS | PASS | Compare/rebase/persisted address |
| Archive with activity | Centro active assignments | PASS | PASS | PASS | PASS | Rejection/history intact |
| Archive/restore without activity | Per-project empty branch | PASS | PASS | PASS | PASS | Persisted selector/state/metadata |
| Empty inventory/routine | Newly created branch | PASS | PASS | PASS | PASS | Empty states/actual arrays |
| Two-unit batch/double submit | Numbered labels/same-frame clicks | PASS | PASS | PASS | PASS | One initial POST |
| Lost response/batch recovery | Committed POST/aborted response | PASS | PASS | PASS | PASS | Reload retry/exactly two rows |
| Close/recover editor | Unsubmitted batch | PASS | PASS | PASS | PASS | Draft retained |
| Unit conflict/publish/retire/restore | Seed unit/concurrent revision | PASS | PASS | PASS | PASS | Required review/revision/visibility |
| Generated QR/correct page | Published Atlas Centro unit | PASS | PASS | PASS | PASS | QR image/absolute URL/public screen |
| Design draft/conflict/recovery | Fictional title/other editor | PASS | PASS | PASS | PASS | No implicit publication/explicit compare |
| Publish/restore design | Brand published history | PASS | PASS | PASS | PASS | Public context changes/restored through new version |
| Late design response | Committed/held PUT; navigate/edit new copy | PASS | PASS | PASS | PASS | Locked fields/later copy survives reload |
| Branding/logo/contrast | Owned PNG/invalid contrast | PASS | PASS | PASS | PASS | Reject without public mutation; publish/restore logo |
| Website validation/conflict/reload | Sur Oeste/incomplete activity/concurrent edit | PASS | PASS | PASS | PASS | Compare/retain-rebase/persist |
| Website review/publication | Saved fictional content | PASS | PASS | PASS | PASS | Required confirmation/public render |
| Unpublish/retain local edits | Unsaved title during withdrawal | PASS | PASS | PASS | PASS | Public removed/server prior draft/local recovery |
| Library empty/format/errors | SVG/empty PNG/spoofed content/valid PNG | PASS | PASS | PASS | PASS | Rejections/actual bytes-hash/decoded image |
| Library search/retry | No matches/intercepted 503 | PASS | PASS | PASS | PASS | Empty/visible error/recovery |
| Library isolation | Atlas Centro → Norte → Sur | PASS | PASS | PASS | PASS | Foreign image absent/crossed media 404 |
| Exercise validation/recovery | Fictional text/no new model-animation | PASS | PASS | PASS | PASS | Required instructions/recovered copy |
| Exercise review/publish/edit | Local Norte exercise | PASS | PASS | PASS | PASS | Review before publish/edit returns draft |
| Program conflict | Real concurrent edit/reload/local copy | PASS | PASS | PASS | PASS | Explicit compare/rebase/persisted prescription |
| Return during exercise/routine save | Held responses after real commit | PASS | PASS | PASS | PASS | Blocked until ACK/refreshed list |
| Long branch header | UI-created long name | PASS | PASS | PASS | PASS | No horizontal overflow/control-focus retained |
| Programs in four branches | Time/RPE routine/scoped member | PASS | PASS | PASS | PASS | Recover/save/publish V1/assign/V2 retains V1 snapshot |
| Branch/brand modules | Centro equipment/brand website | PASS | PASS | PASS | PASS | Direct routes/POST blocked; other branches/data correct |
| Catalog availability | Hide/enable base exercise Sur Centro | PASS | PASS | PASS | PASS | Persisted config/UI reversal |
| Unit transfer | Sur Centro → Oeste/initial activity | PASS | PASS | PASS | PASS | Initial reject; finish assignments; branch changes/private unit |
| Session expiry during write | Removed fictional-context cookie | PASS | PASS | PASS | PASS | POST rejection/login/same-account recovery |
| Draft isolation | Centro/Norte, admin/coach | PASS | PASS | PASS | PASS | No copy for different account/context |
| Cross-tab/brand logout | Two Atlas tabs/separate Sur session | PASS | PASS | PASS | PASS | Atlas private UI lost/Sur session retained |
| Other-brand IDs/URL | Real Sur unit through Atlas | PASS | PASS | PASS | PASS | Actual rejection/Sur before-after data comparison |
| Invitation/one-use | New fictional Sur Oeste email | PASS | PASS | PASS | PASS | Activation/Oeste-only grant/used-link rejection |
| Monitoring/export | Fictional partial Norte execution via fixture API | PASS | PASS | PASS | PASS | Actual filter/partial-snapshot/JSON exact ID-branch |
| Invitation clipboard copy | Browser clipboard permission | NOT RUN | NOT RUN | NOT RUN | NOT RUN | Creation/activation yes, clipboard unexecuted |
| Print/PDF/physical QR | Real device/printer | NOT RUN | NOT RUN | NOT RUN | NOT RUN | Image/link/page yes; physical print/scan pending |
| Legacy identity editing/operators | Compatible routes/CLI | NOT RUN | NOT RUN | NOT RUN | NOT RUN | Legacy render yes; WL published Design workflow |
| Plan/video-GLB/playback/clip comparison | Corresponding content/review | NOT RUN | NOT RUN | NOT RUN | NOT RUN | No content/model/preview certification |
| Every module/dose-editor option | Additional variants | NOT RUN | NOT RUN | NOT RUN | NOT RUN | Equipment/website/time-RPE tested |
| Lost creation response: routine/exercise/invitation | Non-idempotent creation | NOT RUN | NOT RUN | NOT RUN | NOT RUN | Exact recovery tested for unit batch only |
| External services/production/email | Outside scope | NOT RUN | NOT RUN | NOT RUN | NOT RUN | Not operated |

<a id="checks-de-cierre"></a>
## Completion checks

| Command | Result |
| --- | --- |
| `pnpm lint` | PASS; boundaries, 14 packages/B2B format |
| `pnpm typecheck` | PASS; 14 packages |
| `pnpm test` with both disposable DB URLs | PASS 587/587, zero skips; 14 packages + 25 root tests; B2B integration included |
| `pnpm test:b2b:api` with disposable DB | PASS 77/77, zero skips |
| `pnpm build:b2b` | PASS; existing >500 kB chunk warning |
| Chromium admin UI | PASS 81/81 unique aggregated groups: initial 68/72, rechecks 9/9, concurrent routine 3/3, affected completion 12/12 |
| WebKit admin UI | PASS 27/27 unique aggregated groups: initial 23/25, targeted diagnostic/completion 4/4 |
| `git diff --check` | PASS |
| `pnpm check` / release / previews | NOT RUN; previews explicitly deferred, gates/snapshots unchanged |

Three assignment-retirement failures in first full run used `first()` pointing to
next row; fourth was undecoded lazy image. Reruns wait for actual row change/image
load with multi-assignment fixtures. No hidden failures/weakened product assertion.

Rate limit respected: helper waits `retry-after` for 429, no disabled/lowered limit.
Development selector/fixture errors corrected (two-digit unit names, assignment
snapshot shape, website compare button, PNG type, async module refresh), not product
bugs. Concurrent runner attempt failed on occupied port/affected intermediate
artifacts; definitive evidence repeated serially. Bug baselines/final report
separate. Final completion also includes header/return-button fixes; all affected
journeys rerun. No pending reproduced bugs; NOT RUN variants remain for later task.

<a id="setup-histórico-y-preparación-de-una-revisión-futura"></a>
## Historical setup and future review preparation

1. Install Node 24/declared pnpm; `pnpm install --frozen-lockfile --ignore-scripts`.
   Prepare local PostgreSQL with `pnpm setup:dev`, `docker compose up -d`. Create
   **new disposable** `klisteni_b2b_test`; export local `B2B_TEST_DATABASE_URL` with
   schema-creation permission. No production credential needed.
2. Install Playwright browsers or `QA_CHROMIUM_PATH` for available Chromium. Cloud
   WebKit: `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright`,
   `QA_WEBKIT_PATH=/workspace/.cache/webkit-deps/webkit-local.sh`.
3. Following commands record historical invocation. Before new run adapt to isolated
   HTTP loopback or valid HTTPS, without certificate exception/trust changes:

{{BLOCK0}}

4. Historical scenario (grants no new TLS trust): `pnpm build:b2b`, then
   `node scripts/b2b-wl-e2e-server.mjs` with exported DB URL. Schemas/media created
   fresh/removed on Ctrl-C. Separate Chromium profile/proxy `http://127.0.0.1:4342`,
   fictional `https://atlas.b2b.test/manage`, `https://sur.b2b.test/manage`, no real
   domains. New review uses isolated HTTP loopback or valid HTTPS; no reused SPKI
   exception/fixture CA installation.
5. Fictional `admin@atlas.example.test`, `admin@sur.example.test`; coaches/members
   in `seedWhiteLabelDemo`. Fixture-only password `browser-tests-only-password-2026`,
   no real account; never reuse outside demo.
6. Reports: `.cache/brand-admin/<grupo>/report/index.html`;
   `playwright show-trace /ruta/trace.zip` replays DOM/interactions/network. Traces
   contain **synthetic** credentials/tokens; separate from production captures.

Brief manual checklist:

- Scroll mobile tables horizontally to read/use every column.
- At 320/412 px/desktop sign in Atlas admin, switch Centro/Norte, check each section context.
- Personas: administrators/both branches; change fictional membership/pause-reactivate;
  coaching uses current branch only.
- Brand/branches: create/repeat slug/edit address/reload-recover; another-tab change,
  compare/continue/discard.
- Units: register two with existing model, close/recover/review publication/open correct
  QR/page/retire-restore. Physical print/scan requires phone-accessible installation.
- Design: edit/navigate-recover/save without publish/publish-restore. Sur Oeste Website:
  save-review-publish/unpublish with pending edit retained.
- Upload fictional valid image, invalid file, change branch/brand/check isolation.
- Time/RPE program each branch: publish V1/assign correct member/publish V2; assignment stays V1.
- Remove session with editor open/save/reenter/recover only same account/context;
  cross-tab logout.

<a id="integración-y-retorno-para-atlas"></a>
## Integration and Atlas handoff

Shared integration files:

- `features/organization/WhiteLabelSettings.tsx`: design/branch editors/stable keys/shared brand UI.
- `features/people/People.tsx`, `PeoplePage.tsx`: admin roster, retain scoped coach view/coaching.
- `features/catalog/ExerciseEditor.tsx`, `features/programs/ProgramEditor.tsx`: save-time return guard shared with coach.
- `packages/b2b-ui/src/white-label.css`: admin/coach/member header/context; field containment/focus.
- `features/invitations/Invitation.tsx`: token state for all invitation roles.
- `shared/editor/editorDraftStorage.ts`, `useEditorDraft.tsx`: new `theme`/`branch` types; existing key shape/semantics unchanged.
- `apps/b2b-api/src/white-label-service.ts`: duplicate-slug branch creation only.
- `scripts/b2b-wl-e2e-server.mjs`: optional fourth context disabled for prior suites.
  Shared `white-label-http.test.ts`; new brand-admin helpers/config/specs without
  altering existing suites/snapshots.

Later Atlas intake: **local B2B administrator implementation/QA**, base `7172041`,
own branch. White-label remains implemented; corrected People coherence/read,
duplicate slug, brand/branch editor recovery/concurrency, invitation navigation,
long-branch header and save-time editor return. Evidence: 108 unique aggregated
passing UI groups/587 tests, declared physical/TLS limits/pending variants. Separate
code/local tests/emulation/historical deployment. No new deployment, physical
validation, model/preview generation, recurring backup or public domain/TLS check.
Historical Atlas preview/content/backup pending work unchanged; KB not written.

<a id="evidencia-seleccionada"></a>
## Selected evidence

Stable review captures in [evidence directory](b2b-brand-admin-2026-10-13-evidence/).
[Hashes/per-flow results manifest](b2b-brand-admin-2026-10-13-evidence/manifest.json).
Full JSON/traces/logs remain in `.cache/brand-admin` and local
`.cache/brand-admin-evidence-2026-10-13.tar.gz`.

Retained main runs:

| Group | Raw result | Purpose |
| --- | --- | --- |
| `final-chromium-initial` | 68/72 | Initial full suite; three dynamic-selector errors/one lazy-image wait |
| `final-chromium-recheck` | 9/9 | People/library/transfer in three profiles/multiple assignments |
| `final-chromium-program` | 3/3 | Routine conflict/recovery in three profiles |
| `final-webkit` | 23/25 | Full WPE suite; overflow/premature editor return |
| `webkit-overflow-diagnostic` | 1/2 | Overflow reproduction/geometry |
| `editor-pending-baseline` | 0/2 | Return before ACK reproductions |
| `final-webkit-recheck` | 2/4 | Intermediate: insufficient containment/same-name exercise-template ambiguity |
| `closeout-affected` | 16/16 | Four affected journeys/four profiles on final code |

Final count uses **only latest result per flow/project pair**; neither converts
failed run to passing nor hides files. Remaining browser schemas: **0**, verified
read-only on local test DB. Schema data not retained; manual scenario reseeded.

<a id="relevo-git"></a>
## Git handoff

Incremental code bundle transports commits from base
`7172041102a8a7029af5fb3e2527a1fa51611a86` to branch HEAD. Includes complete tracked
tree (code/tests/docs/small captures), excludes external 389 MiB evidence archive,
DBs/certificates/secrets/node_modules/caches. Restore verified in disposable clone
initially containing only base: final commit absent before import, `git bundle verify`,
branch import, HEAD/tree equality and tracked files byte-for-byte. Evidence/hashes
outside Git tree avoid self-reference. Suite not repeated and branch/PR not
published in the recorded handoff.
