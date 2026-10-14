<a id="integración-de-las-siete-tandas-qa--klisteniapp"></a>
# Integration of seven QA tasks — Klisteniapp

**Verified integration: 1164/1164 consolidated PASS combinations across seven roles.**
Per-combination status/full history: [matrix.json](matrix.json); readable table:
[flows.md](flows.md). 828 cases use API/PostgreSQL, 120 simulated UI contracts,
216 local-storage journeys. Failed attempts remain recorded. Branch published;
draft PR blocked by automatic review, awaiting explicit authorization. No merge/deploy.

<a id="fuentes-y-trazabilidad"></a>
## Sources and traceability

Verified common base/`origin/main`: `7172041102a8a7029af5fb3e2527a1fa51611a86`.
Independent worktree `/workspace/klisteni-integration-20261013`, branch
`qa/klisteni-integration-20261013`. Final verified code/harness:
`2822decd496bb51bf5ae1b2e321746c858ba0af7`; combined product merge:
`4f903962094bcc7069891d7aba7ad8683544d44c`. Later commits change fixtures/tests/docs,
without adding product decisions.

| Role | Source branch | SHA | PR |
| --- | --- | --- | --- |
| B2C self-service | codex/qa-b2c-selfservice-20261013 | 640ec502 | [2](https://github.com/pablitxn/klisteniapp/pull/2) |
| B2C administration | qa/b2c-admin-20261013-sol | 478bcfb2 | [3](https://github.com/pablitxn/klisteniapp/pull/3) |
| B2B trainer | qa/b2b-trainer-20261013-cloud | ed53bbc4 | [4](https://github.com/pablitxn/klisteniapp/pull/4) |
| B2B member | qa/b2b-member-20261013-session-b752 | bafb7bf6 | [5](https://github.com/pablitxn/klisteniapp/pull/5) |
| B2B anonymous | qa/b2b-anonymous-20261013-publicable | 32a80111 | [6](https://github.com/pablitxn/klisteniapp/pull/6) |
| B2C visitor | qa/b2c-visitor-local-20261013 | d35365c6 | [7](https://github.com/pablitxn/klisteniapp/pull/7) |
| B2B brand administrator | qa/b2b-brand-admin-20261013 | a959fceb | [8](https://github.com/pablitxn/klisteniapp/pull/8) |

[sources.json](sources.json) retains full SHAs. Seven sources are integration
ancestors; remote heads/main reread before publication. Original branches/commits/
PRs preserved. Anonymous uses user-confirmed publishable variant; original large
binary evidence stays outside Git. No reset/discard/rebase of others' work.
Original B2C checkout remains clean at `640ec502`.

Original integration task read `AGENTS.md`, roadmap/product docs; read-only Atlas
`sysadmin-workspace@27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`, instructions,
atlas-navigate, source-of-truth/Klisteniapp wiki. For intake notes it also recorded
reading atlas-maintain/privacy/intake runbook/templates/enums. These are historical
claims from that task, not claims of retroactive skill use by this language audit.
Atlas unedited. Existing white-label/renames remain implemented; models/previews/
Blender deferred.

<a id="integración-y-correcciones"></a>
## Integration and corrections

Text conflicts: demo Playwright config/B2C tsconfig. Role-suite exclusions united;
all `playwright*.config.ts`/E2E included in types. Found unexported `WebServerConfig`
in extra B2C config; replaced with actual-server-array guard.

Reviewed automatic Git combinations: B2C store retains visitor export/import/durable
deletion plus exact-read yoga replay; ProgramEditor stable identity/return blocked
until ACK; Invitation existing-identity consent/fragment refresh-cleanup; progress/
QR brand-branch-account context. Atomic slug 409/published media-contact coexist.

Incorporated product corrections with original regressions/new integration coverage:

| Role | Corrections |
| --- | --- |
| Self-service | Yoga retry after lost commit response: complete snapshot/account confirmation before accepting 409; genuine conflicts retained |
| B2C administration | Capacity up to 10000; synchronous ref prevents duplicate issuance; collapse/close hides late links |
| Visitor | Preference export without activity, durable deletion, explicit corrupt-copy recovery/backup, semantics/accessibility/narrow WebKit selector |
| Trainer | Idempotent routine/assignment creation after lost response; compare payload/target/versions |
| Member | Branch progress, explicit global history, authorized-context QR, existing-identity acceptance without overwrite |
| Anonymous | Published branch contact/reference-based media, branch-independent landing, contextual QR/login/return/retry |
| B2B administrator | Brand roster/branch coaching, slug 409, theme-branch draft/revision, invitation refresh/mobile selectors/ACK guard |

No new confirmed integration product defect. Setup/test failures retained/corrected:

- HTTP proxy: Playwright `route.fetch` uses CONNECT for HTTP too. Only allowed
  fictional hosts/port 80 forwarded to loopback gateway; HTTPS/external hosts/other
  ports rejected. Eight actual controls and remote-DB guard passed.
- UUID: HTTP `.b2b.test` is not secure context; `crypto.randomUUID` absent. Opt-in
  fixture uses `crypto.getRandomValues`, without origin-trust elevation/TLS-cookie
  changes. Neither product fix nor proof of secure context.
- Yoga timing: `clock.install` permits real time. Loaded WebKit recorded four seconds
  when script expected three. Pause only after dialog renders/resume after completion;
  exact three-second/single-record assertions retained. Six profiles rerun passed.
  Premature UI-load pause attempt/later port collisions retained.
- WebKit video: missing H.264 decoder. `gstreamer1.0-libav`/tools downloaded/extracted
  in `/workspace/.cache/qa-codecs`, no system install. Local plugin/registry/cache
  wrapper; advancing `currentTime` playback 3/3, then 126 anonymous WebKit cases repeated.
- DB: Kysely catalog introspection coincided with unit-test DROP SCHEMA, failing
  fixture startup. Separate disposable DB for anonymous rerun. Introspection filters
  destination schema; failure proves no cross-data access. Concurrent roles need
  separate DBs as well as UUID schemas.
- Build: global build over served `dist` caused PeoplePage chunk 404 in open browser.
  Development gateway accepts `builtDirectory`; fixture copies build to fixed
  temporary directory. Real regression confirms replacing shared build preserves
  copied chunk. Defaults/proxy boundaries remain checked.
- Async navigation: fixed run107/108 retains canceled-import WebKit error during
  document download (HAR `Load request cancelled`, same files later200, no404).
  Test read generic shell h1 before section render. Now waits specific titles/content
  after back-forward/reload; no JS error filtering/suppression. Atlas/Sur inventory
  rerun8/8, 176 screens in four profiles.
- Async options: assertion read recipients before loading ended. Wait exact option
  before checking all recipients/other-brand exclusion. No larger timeouts/skipped assertions.

Shared integration concerns: `apps/b2c-web/src/lib/store.ts`, B2C config/tsconfig/
specs; ProgramEditor/Invitation/Workspace/MemberWorkspace/B2B styles; service/
white-label-service/API tests; local gateway/new HTTP fixture. Integration diff
changes no models/manifests/canonical captures/preview scripts/lockfile.

<a id="matrices-actuales-y-alcance-real"></a>
## Current matrices and actual scope

| Role | Cases/profile | Profiles | Latest status |
| --- | --- | --- | --- |
| B2C self-service | 41 core + 7 extra | 6 | PASS 288/288 consolidated; initial extras39/42, Yoga rerun6/6 |
| B2C administration | 14 | 6 | PASS 84/84 one run |
| B2C visitor | 18 demo + 18 instance | 6/mode | PASS 216/216 two runs of108 |
| B2B member | 16 | 6 | PASS 96/96 one run |
| B2B trainer | 20 | 6 | PASS 120/120 one run |
| B2B anonymous | 42 | 6 | PASS 252/252 consolidated: Chromium126/new WebKit126; previous attempts retained |
| B2B administrator | 27 | 4 | PASS 108/108 consolidated: fixed107/108 + strengthened inventory8/8; previous106/108 and earlier retained |

All 1164 matrix combinations completed with consolidated results, not absolute
coverage. Self-service: **168 actual API/PostgreSQL cases**, **120 simulated-transport
UI contract cases** (`health`, `yoga-account`, `account-access`, `forgot-password`).
Real journeys supplement these screens with persistence/session/errors/import-export/
replay. Visitor uses local storage by design. B2B/B2C administration use isolated
real backend; errors/lost responses deliberately injected. Persisted effects
checked where applicable, not HTTP alone.

Prior route/action inventory: each role's primary sources in [seven intake notes](fichas/),
`apps/b2b-web/src/routes.ts`, Workspaces/features, B2C App/navigation/store.
[Complete table](flows.md) includes happy paths/empty/boundary-validation/failure-retry/
double-click/cancel/reload-back-forward/pre-post-commit loss/expiry-revocation/isolation.
Original inventories retain unexecuted legacy routes/maxima; integration never
converts those to PASS.

<a id="motores-viewports-y-protocolo"></a>
### Engines, viewports and protocol

System Chromium **154.0.8037.57**; Playwright WebKit **26.6, WPE Linux build2359**;
Playwright1.63.0/Node24.19.0. Viewport/touch emulation, not physical iPhone/Android/Safari-iOS.

| Role | Narrow mobile | Wide mobile | Desktop | Engines |
| --- | --- | --- | --- | --- |
| Self-service | 360×800, DPR2 | 430×932, DPR2 | 1440×1000 | Chromium/WebKit |
| B2C administration | 360×780, DPR1 | 430×932, DPR1 | 1440×1000 | Chromium/WebKit |
| Visitor | 320×740 | 430×932 | 1440×1000 | Chromium/WebKit, demo/instance |
| Member | 320×740 | 430×932 | 1440×1000 | Chromium/WebKit |
| Trainer/anonymous | 360×800 | 430×932 | 1440×1000 | Chromium/WebKit |
| B2B administrator | Chromium320×740/WebKit390×844 | Chromium412×915 | Chromium1440×1000 | Requested four-profile matrix |

Mobile `hasTouch/isMobile`, desktop false. Reduced motion. B2B es-AR/UTC; B2C also
checks timezone changes/distinct-zone contexts. All new matrices use **HTTP
loopback**, B2B through restricted proxies/distinct fictional origins.
`ignoreHTTPSErrors:false`, no added SPKI/trust-CA/`NODE_TLS_REJECT_UNAUTHORIZED`.
Future role configs hardened against inherited historical exceptions. Historical
member/admin certificate-exception evidence is not new TLS validation.

**BLOCKED:** valid-trust HTTPS/production Secure cookies in setup. **NOT RUN:**
hardware/camera/printed QR/real Safari/physical audible voice, actual payment-mail-
OAuth, infrastructure/production, model-Blender-preview acceptance, two additional
B2B admin WebKit profiles. HTTP establishes none of these.

<a id="checks-sobre-revisión-final"></a>
## Checks on final revision

Lint/types/602 global tests finished on `2822dec`; build16/16/gateway5/5 on
`06a13ee`. Later change only E2E inventory section wait, revalidated8/8.
Documentation commits do not change tested code:

| Command | Result |
| --- | --- |
| `pnpm lint` | PASS boundaries + 14/14 tasks + B2B format |
| `pnpm exec turbo run typecheck --concurrency=2` | PASS 14/14, all configs/E2E included |
| `TEST_DATABASE_URL=… B2B_TEST_DATABASE_URL=… pnpm test --concurrency=2` | PASS **602**, zero failures/skips: root26, contracts10, scene46, assets3, geometry33, domain9, catalog2, anatomy4, client17, ui2, react12, B2Bweb56, B2BAPI82, B2CAPI97, B2Cweb203 |
| `VITE_APP_MODE=instance KLISTENI_PUBLIC_PROFILE_FILE=instance-profile.example.json pnpm exec turbo run build --concurrency=1` | PASS16/16, previous large-chunk warning |
| `node --test scripts/b2b-gateway.test.mjs` | PASS5/5, fixed snapshot/existing boundaries |
| Node syntax + `git diff --check` | PASS |
| Actual proxy: five HTTP targets/three CONNECT rejected; remote DB rejected | PASS9/9 |
| `pnpm previews:check` | Exercise74 PASS, anatomy24 PASS; Yoga **PRE-EXISTING FAIL** stale receipt |

Same preview gate ran in separate `main@7172041` worktree: same positives/Yoga
failure, unchanged diff inputs. No regeneration/falsified hashes-snapshots.
Complete `check`, `check:all`, `check:release` not claimed passing; excluded GPU/model
suite not run. Final documentation commit leaves tested code unchanged. Remote CI
recorded in publication receipt; absent workflows/status is not PASS. Remote
checkpoint96cb839: zero check-runs/PRs confirmed after draft-creation rejection.

## GitGuardian

[Evidence-backed triage](gitguardian-triage.md), [JSON contract](gitguardian-triage.json):
incident38163411/occurrence303868615, PR3 bot comment, `cf73bbc…`,
`scripts/b2c-admin-fixtures.ts:11`. Synthetic constant used only by loopback/UUID-schema
QA/excluded from production image-startup: static **not_actionable**, fixture false-
positive candidate superseding unlocated checkpoint. No values published/alert
closed-suppressed. Outside-repo reuse not audited; production incident not assumed.

<a id="evidencia-y-reproducción"></a>
## Evidence and reproduction

[evidence-manifest.json](evidence-manifest.json) identifies captures/traces by path/
size/SHA256; [matrix.json](matrix.json) retains all attempts/latest results. Large
binaries local/outside Git. Delivery `/workspace/shared/klisteni-integration-20261013/`,
seven tar.gz/SHA256 in [archives.json](archives.json), small review ZIP/remote receipt
there. Manifest's 3442 files include manual captures/prior traces. No large binary
upload or confirmed Library upload. Open trace with
`pnpm exec playwright show-trace /ruta/a/trace.zip`. Inspected captures show actual
UI/states, not HTTP only. No real personal data/production activation links.

Other-machine reproduction: Node24+, repo pnpm12.7/lockfile deps/installed
Chromium-WebKit. **Disposable** PostgreSQL17 loopback only, locally chosen fictional
credentials, no real `.env`. Test B2C DB plus B2B b2b/test-named DB per concurrent
role; export `TEST_DATABASE_URL`, `B2B_TEST_DATABASE_URL`. No existing real-data DB.
Recorded owned `klisteni-qa-b2c-20261013`, port54339; fixtures create/clean UUID schemas.

```sh
# Self-service core: one schema/server per profile; extras use other ports.
node scripts/b2c-qa.mjs
B2C_QA_CONFIG=playwright.b2c-qa-extra.config.ts node scripts/b2c-qa.mjs
pnpm --filter @klisteniapp/b2c-web exec playwright test --config=playwright.admin.config.ts
VISITOR_INSTANCE=0 VISITOR_RUN=review-demo pnpm --filter @klisteniapp/b2c-web exec playwright test --config=playwright.visitor.config.ts
VISITOR_INSTANCE=1 VISITOR_RUN=review-instance pnpm --filter @klisteniapp/b2c-web exec playwright test --config=playwright.visitor.config.ts

# B2B: per-profile API/gateway/proxy/schema, fixed temporary build.
# Choose member, trainer, anonymous or brand-admin; no shared DB during migrations.
QA_INTEGRATION_ROLE=member QA_INTEGRATION_PORT_OFFSET=1000 pnpm --filter @klisteniapp/b2c-web exec playwright test --config=playwright.integration-http.config.ts
```

Offsets: admin0/member1000/trainer2000/anonymous3000; control4348+offset,
proxies4342/4344/4346/4350/4352/4354+offset. Gateway4542+offset+2×profile; API next
port. `QA_INTEGRATION_USE_BUILT=1` reuses verified build; default builds/copies fixed
fixture. Linux Cloud: `QA_INTEGRATION_CHROMIUM=/usr/bin/chromium`,
`QA_INTEGRATION_WEBKIT=/tmp/b2c-qa-bin/webkit`; B2C `B2C_QA_*_PATH`, administration
`KLISTENI_*_EXECUTABLE`, visitor `VISITOR_*_PATH`. Local wrapper resolves `.cache`
libs/codecs without system/trust changes. Elsewhere use normal installed Playwright
engines; Cloud paths not portable.

<a id="checklist-manual-breve"></a>
### Brief manual checklist

Use `--debug --project=<perfil> --grep='<flujo>'` with role config: fixture remains
alive during inspection/helper fills only synthetic credentials. Tests prepare
repeatable expiry/lost-response/conflict/quota scenarios; no real tokens/email needed.

1. **Self-service:** activate fixture/login/name-order routine/change plan-zone/reload/
   record strength-cardio/partial yoga. Lost-response yoga retry: one record.
   Health/import preview-cancel/export; expired account reads/exports/write limits.
2. **B2C administration:** filter/empty/fictional invite/double issuance/trial-lifetime/
   limit-revoke; collapse during delayed response, link stays hidden.
3. **Visitor:** separate demo/instance, onboarding-plan-zone/local storage/cancel-record/
   confirmed export-import. Quota/corruption preserve draft/row/original, no API write.
4. **Member:** Norte QR/context login/correct branch/prescription-alternative/draft;
   reload/save after loss. Branch progress vs global history; no foreign copy.
5. **Trainer:** create/publish/assign per branch/lost response/retry: one routine/
   prescription. Switch branch during late ACK/check monitoring-versions/revoked permission.
6. **Anonymous:** two brands/four branches/published contacts-galleries/QR-login-return/
   hidden-archived-unpublished/error-retry. Synthetic video advances; no history/draft leak.
7. **B2B administrator:** brand people/branch coaching/duplicate409/recover-compare
   theme-branch/lost-response two-unit batch/website-media private until published/
   publish-assign routine; Volver blocked until ACK.

Later physical review: touch/keyboard/camera-QR/audio/orientation on real devices;
validate HTTPS/Secure on valid-trust test instance. Those results do not yet exist.

<a id="retorno-para-atlas-pendiente"></a>
## Pending Atlas handoff

Seven [intake notes](fichas/) are draft/pre-documentation with sources/SHAs/facts/
corrections/explicit decisions, history separated from integration/pending work.
Not absorbed entries/new knowledge protocol. Later consolidate through
`atlas/runbooks/intake.md`, source-entry templates, `atlas/catalog/sources.yaml`;
reconcile Klisteniapp wiki/October12 intake/retroactive-documentation preserving
history/existing destinations. No concurrent Atlas writes or treating branch/draft
PR/local tests as merge/deployment.

<a id="publicación-y-bloqueo-restante"></a>
## Publication and remaining blocker

`qa/klisteni-integration-20261013` created remotely without force/reverified after
final commit. One draft-creation attempt rejected by automatic review, considering
original instruction “no publicar un PR todavía” still active. No workaround/retry/
uncertain publication; lookup confirmed zero PRs. Explicit authorization requested,
pending at recorded completion. PRs2–8 remain open/main unchanged.
[Checkpoint receipt](publication-checkpoint.json); exact-SHA final receipt outside
Git in shared folder. This language task must not bypass that separate blocker.
