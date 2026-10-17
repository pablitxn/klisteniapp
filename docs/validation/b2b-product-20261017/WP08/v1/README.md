# WP08 v1: routine continuity, actual history and weekly calendar

Date: 2026-10-17. Status: owned modules ready for composition; **full package
acceptance pending**. Parent retains dispatch, monitoring and merge decisions.
No new Cloud task was dispatched. This directory is frozen at publication;
corrections require an additive v2 receipt, never edits to this evidence.

## Immutable inputs and owned source

| Input | Exact revision |
| --- | --- |
| Application implementation base / PR15 | `0b611064a91b87b3a17274cabca5415bcf1d7d55` |
| Plan | `447d77ebb5587e319018e7b56003f0ef7299bb6c` |
| Atlas | `ce45d206a2ed4035f8003a3303abd1fff98e09b8` |
| WP02 receipt/interface inspected | `c6825101d6ac798437599062481adf2a79ac5f69` |
| WP03 receipt/interface inspected | `d12b56b92304764f988b051350b6211b7f1e38ba` |
| WP12 matching-runtime instructions inspected | `e71c5c4273a9e18b7422a0250626729417de8a95` |
| Final owned source/test head | `29468c667db12ff887f938a51871df04573c6340` |
| Source implementation commit | `30949bba3ce14f13a34d460fe49a67769cebb585` |
| Branch/worktree | `feat/b2b-routine-history-ui-v1` / `/workspace/wp08` |
| Remote main observed at handoff | `d65261d18de4522fb9a66104aabb5750104fb8b8` |

Draft PR targets `feat/b2b-contract-foundation-v1` at the frozen base to show only
this UI/test/evidence diff. No producer commit was merged/cherry-picked into it.
The final PR head includes evidence-only commits after the source/test SHA above;
use the PR/ref receipt for that exact final head. [source-files.sha256](source-files.sha256)
binds every owned source/test byte; [files.txt](files.txt) lists the exact 18 files.
Shared manifests/lockfile, packages, API, contracts, migration, root navigation,
Session/controller/draft/outbox and QA browser files have zero diff from BASE_SHA.

Read application/Atlas AGENTS, the actual `.agents/skills/atlas-navigate/SKILL.md`,
Atlas source-of-truth/privacy/language/identity/integration guidance, October17
source/minutes/A00-A08, all three plan companions, adopted ADR, product-v2
schemas, endpoint inventory, actual product SQL and both dependency receipts.
Atlas main matches its requested SHA and remains untouched; this worker is not
WP15. The original app AGENTS warning about pending language adoption is stale;
the pinned adopted Atlas policy governs new content. Spanish UI is product
localization consistent with the existing app; comments/tests/reports/commits are
English. No API identifiers, snapshot or legacy log ID was rewritten.

## Implemented behavior

- `ProductHistoryPage` uses the existing public product client supplied by the
  integrator. Continuity and actuals are separate sections, with stable original
  routine/version-to-session and session-to-routine anchors that survive current
  stage removal. No route/provider/API is invented.
- Every enrollment displays its own timezone's today, inclusive current/past/future
  stages, explicit stage gaps, current objective, issued/current revision numbers
  and ended status. Original schedule slots are distinguished from accepted moves.
  Concurrent plans and same-day slots retain separate identities.
- Dated session detail retains performed and accepted timestamps, status, original
  links, correction actor/reason, target ranges/units, scalar actuals, variant
  snapshots/conditions and deselected additional segments. Revisions load lazily
  via the frozen `sessionRevisions` endpoint. Legacy revision0 uses its original
  embedded routine, notes, values and log/assignment IDs and stays unplanned.
- Weekly summary counts come from the authoritative server DTO, with separate
  prescribed/completed/partial/missed/pending labels. Partial remains outstanding
  and, after close, is explicitly included among missed work. No activity chart,
  inferred completion, substitution count or incremented local adherence counter.
- Native labelled select/button forms offer exactly the same seven local week
  dates; no dragging is required. Moves submit only stable occurrence ID, CAS
  revision, operation ID and chosen date. Mounted-form exact retries retain their
  operation/payload identity; there is no new schedule-outbox persistence claim.
  No optimistic content/count/date mutation. Completed/cancelled/ended work has no
  move form. Known accepted stage-boundary overrides remain visible.
- Closed summaries display current revision/asOf and recalculable-close wording.
  A late-correction label requires a linked accepted correction after local week
  close, not merely WP03's general revision watermark. Period-excluded actuals
  remain visible and never fill another obligation.
- Staff can select authorized inactive targets in `ProductReportsPage`; historical
  training stays read-only and no health endpoint is called. UI data is scoped by
  tenant/branch/member; owner/access changes remount view state and cancel reads
  and pending moves. The caller must supply current identity/access lifetime and
  enforce the restricted WP11 route.

## Actual checks and their limits

Node **24.19.0**, pnpm **12.7.0**, frozen lockfile/store. PostgreSQL **17.11** ran
in a new task-owned ephemeral container with loopback-only ephemeral host port,
synthetic `b2b_wp08_test` DB and random disposable test schemas. No pre-existing
container, credential, volume, user/health data or production database was read.
The container was removed after testing. No dependencies were upgraded.

| Check | Actual result | Evidence |
| --- | --- | --- |
| Frozen dependency install | passed; resolution skipped, lockfile unchanged | `install.log` |
| Contracts U | 22 passed / 0 failed / 0 skipped | `contracts.log` |
| Frozen-base domain U | 9 passed / 0 failed / 0 skipped | `domain.log` |
| Entire B2B web U, including 21 new cases | 77 passed / 0 failed / 0 skipped | `web-tests.log` |
| Frozen-base B2B API with real disposable PostgreSQL | 92 passed / 0 failed / 0 skipped | `api.log` |
| Root typecheck | 14/14 tasks passed; final affected app rechecked after test-only change | `typecheck.log`, `web-typecheck.log` |
| Root lint, B2B boundary and formatting | 14/14 lint tasks passed, boundaries/format passed; final app lint passed | `lint.log`, `boundaries.log`, `web-lint.log` |
| B2B frontend build | passed; existing >500kB chunk warning retained | `build.log` |
| Diff whitespace, effective Git identity | passed | `identity.log`, source/PR receipt |
| Official Atlas content check | 176 Atlas instruction files checked; not a language proof for app | `engineering.log` |
| Official `commits(root,base)` function with app root | 2 scoped English app commits passed | `commits.log` |
| Product browser specs / existing member browsers | **0 executed; blocked on accepted composed app/routes and QA-owned specs** | `browser-scenarios.md` |
| Trusted HTTPS, physical devices, deployment | unexecuted / outside this worker | this receipt |

Commands: `pnpm --filter @klisteniapp/b2b-contracts test`,
`pnpm --filter @klisteniapp/b2b-domain test`,
`pnpm --filter @klisteniapp/b2b-web test`,
`pnpm --filter @klisteniapp/b2b-api test` with the disposable local
`B2B_TEST_DATABASE_URL`, `pnpm typecheck`, `pnpm lint`,
`pnpm check:b2b:boundaries`, `pnpm build:b2b`, and affected web typecheck/lint.
See results.json for commands and exact counts. There are **zero unreported
skips**, and no blocked browser, real composed API, UI focus/touch or privacy case
is counted as passed. Unit rendering compiles actual JSX using the declared Vite
toolchain and React server rendering; it is not a browser run or HTTP authorization
acceptance. The build confirms the retained shell; shared route composition is not
installed in this branch.

The API/domain here remain the frozen foundation: WP02/WP03 implementations were
read at the exact supplied pins, not imported/copied. The 92 API passes prove this
UI patch preserves that baseline, **not** the future composed ledger/planning
handlers. WP02's end effectiveAt amendment, the known production-adapter/shared
assertion issues in producer receipts and full composed API/browser results remain
with their existing owners. No recoverable dependency source was edited here.

An initial test-render helper imported undeclared TypeScript directly and failed
the boundary checker. It was replaced by the app's already-declared Vite SSR
compiler; the final full boundary/lint run passes with unchanged manifests. An
initial direct Atlas commit-check CLI call resolved Atlas rather than the app
and rejected the app base SHA (`commits-cli-limit.log`). The unchanged official
helper's `commits(Path('/workspace/wp08'), BASE_SHA)` API checked the correct app
repository; no parser substitute or altered checker was called a pass. Logs are
normalized only for terminal escapes/trailing whitespace; results.json records
raw and normalized SHA-256 values.

## Remaining acceptance gates and owner handoff

[owner-requests.md](owner-requests.md) specifies the exact imports, component props,
client factory and current-account/access lifetime required in the existing
member/staff routes. It also requests approved immutable routine/enrollment revision
readers and occurrence-by-ID/inclusion metadata. Frozen `routine` returns a current
draft, `continuity` lacks older content and `occurrences` filters current week only.
The UI does not substitute those mutable/incomplete responses for issued history.

Consequently full original v2 routine/period content and automatic classification
of an unloaded cross-week moved occurrence are **pending**, not accepted. Known
excluded work is labelled; unknown inclusion is explicitly unknown. In-page
original reference links and all accepted actuals remain available. Parent/CONTRACT
must approve the missing reader interface before that final acceptance. Shared
API wiring/composed head remains pending by the parent's assignment.

[browser-scenarios.md](browser-scenarios.md) supplies exact mobile/desktop,
keyboard/touch, four/three/one, same-day, DST, late correction, period/log linkage,
two-brand isolation and inactive-report cases to QA. Chromium/WebKit matching
runtime is documented and is not claimed unavailable; the blocker is the accepted
feature composition and required readers. CI status is reported separately in the
PR; no local result claims CI success. No main merge, production activation,
deployment, provider/paid call, credential/security change or history rewrite.
