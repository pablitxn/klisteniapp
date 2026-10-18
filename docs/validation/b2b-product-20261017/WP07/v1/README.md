# WP07 trainer programming: immutable v1 receipt

Source `c008dd883870d69026851e0945b825c583f8dd0e`, branch
`feat/b2b-trainer-programming-ui-v1`. Frozen implementation base
`0b611064a91b87b3a17274cabca5415bcf1d7d55`; plan
`447d77ebb5587e319018e7b56003f0ef7299bb6c`; Atlas
`ce45d206a2ed4035f8003a3303abd1fff98e09b8`. The evidence commit changes only
this directory. [evidence.json](evidence.json) pins exact files/source hashes,
producer heads, tested composition, runtimes, counts and log hashes. Freeze this
receipt after first publication; corrections require v2/amendment.

## Delivered modules

New modules under `features/programs/product` extend the existing editor
infrastructure with v2 server drafts and explicit publication/assignment. Empty
routine/name/step/dose values save through frozen DTOs; local finite invalid range
edits remain recoverable but cannot pass transport validation. Fixed/range sets,
reps/time, rest and kg have explicit units/bounds. Load is explicitly bodyweight,
external or unconfirmed; laterality is confirmed rather than inferred. Rest starts
with the persisted 60s default. No balance score or suitability judgment is added.

The goal editor supports objective, explicit IANA timezone, stable stages/weekly
slots, two sessions on one day, ordered inclusive periods/gaps and immutable
routine-version reuse. The view labels past/current/future using the program's
calendar day. The period editor displays the server's occurrence revision/date/
eligibility/reason and all linked session IDs, binds the exact fingerprint and
requires explicit confirmation. Proposal edits and rejected/stale previews clear
confirmation. It never edits actual records or reconstructs historical content.

Existing account/organization/branch/role-scoped session draft storage carries the
resource ID, base revision, content and exact last mutation operation identity.
Rejected saves retain work; conflict resolution reads current content and requires
explicit review before rebase/discard. A synchronous in-flight guard stops duplicate
click dispatch. Response-loss retry replays only the persisted frozen request,
then queries current head so an old receipt cannot overwrite another trainer's
newer edit. Server replay authorization remains authoritative. Local copies are
session-local; no durable cross-browser/offline-start promise is made.

Per-step reviewed/block policy is explicit. The producer's reviewed-alternatives
component exposes target dose/requirements in a disabled publication preview;
workout choice/actuals are untouched. The audit drawer reads bounded actor/time/
changed-field/revision references. The capability-gated page clears selected
member data before switching, remounts for account/brand/branch/role and aborts
departed requests. No DTO, SQL, producer, legacy history, shared root route,
manifest/lockfile/export, session controller, browser fixture or Atlas file changed.

## Validation

The UI source is merged only into local dependency validation head
`e813f65d1872278e40ef7456b56e544a2600873c`, containing exactly accepted producer
WP02 `c6825101d6ac798437599062481adf2a79ac5f69` and WP04
`c91fbcbaf3dc228630cda66dd2229f2524cb46c9` plus frozen base and this feature.
The feature branch contains neither producer implementation. Checks below prove
that isolated source/dependency composition, not final integrated handlers or
current moving producer branches. Remote main was refreshed at
`d65261d18de4522fb9a66104aabb5750104fb8b8`; the intended draft PR base is the
unchanged foundation branch at frozen BASE_SHA, preserving a UI-only diff.

Node 24.19.0, declared pnpm 12.7.0 via existing onboarding activation, frozen
lockfile/dependencies. Disposable task-owned loopback PostgreSQL 17.11 with
synthetic schemas only; container removed after tests. Initial unqualified `pnpm`
resolved to 11.25.0 and was not used for dependency/test work. A first Corepack
lookup failed in its unavailable default cache, then succeeded with a task-local
cache. No manifest/lockfile/dependency upgrade was made.

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm --filter @klisteniapp/b2b-contracts test` | 22 pass, 0 fail/skip | [contracts](contracts.log) |
| `pnpm --filter @klisteniapp/b2b-domain test` | 22 pass, 0 fail/skip | [domain](domain.log) |
| `pnpm --filter @klisteniapp/b2b-web test` | 80 pass, 0 fail/skip | [web](web-final.log) |
| `B2B_TEST_DATABASE_URL=<task-local> pnpm --filter @klisteniapp/b2b-api test` | **114 pass, 7 fail, 0 skip** on amended dependency | [API](api-amended-wp02.log) |
| `pnpm check:b2b:boundaries` | pass | [boundaries](boundaries.log) |
| `pnpm typecheck` | 14/14 pass; 13 unchanged cached | [types](typecheck-final.log) |
| `pnpm lint` | 14/14 plus formatting pass; 13 unchanged cached | [lint](lint-final.log) |
| `pnpm build:b2b` | pass, existing large-chunk warning | [build](build-final.log) |
| `git diff --check`, composition patch apply-check | pass | local check |
| Effective author/committer guard | Pablo Coronel `<git@pablocoronel.com>` | before each commit |
| Atlas engineering check | 176 reviewed files pass; human English/provenance review still needed | [check](atlas-content.log) |

**UI tests pass; final API acceptance is incomplete.** New web tests contribute
20 cases: prescription/goal models, frozen-client request/rejection/retry and draft
scope, plus six Vite/React server-rendered component checks for labels, IDs,
applicability, range/block announcements, blank-save controls and foreign-account
capability refusal. They are component/structural accessibility evidence, not
interactive/browser acceptance. Existing `editorModels.test.ts` ran unchanged;
a uniquely named file avoids its shared lease. API tests include new-install,
001-005 upgrade/repeat, immutable JSON/IDs/FKs, real transaction races and both
producer suites. They retain legacy authorization expectations; they do not prove
WP01's not-yet-composed all-trainer policy.

The parent supplied amended WP02 head `c6825101d6ac798437599062481adf2a79ac5f69`
before publication. Its UI transport interfaces are unchanged. Full API validation
at `ce459d2a48d090653daae89c31bd75bfe1612e19` reports **114 passed, 7 failed,
0 skipped**. Six legacy HTTP cases fail without the WP01 context/branch composition;
one is the known outdated shared expectation in `white-label-training.test.ts:371`.
The exact WP02/v2 integration-owner patch was read, not applied. These cases are
not passes, and their post-failure assertions remain unexecuted. The later
UI-only response-loss correction changes no API source/test bytes, so this API
result applies to the final dependency tree. Parent's final composed head, WP01
registration and shared assertion reconciliation remain blockers.

Historical initial source `2056aad15e7d6bc772c26af6767fe74a9410d913` with WP02
`3b045cbe431d1995d75f9e88eeac1d79a08607bb` at dependency head
`1aad18838d8e8689686294eab9b4c479591634cb` had 239 passes, zero failures/skips,
including 116 API and 79 web tests. Those original logs remain unchanged. They do
not turn amended-head failures green. Contracts/domain source/tests are unchanged
by the amendment and their 22/22 passing results remain applicable; no duplicate
counts from repeated runs are claimed.

Final web 80/80, root types/lint 14/14 and build passed on
`e813f65d1872278e40ef7456b56e544a2600873c`; 13 unchanged type/lint tasks reused
valid caches. The B2B boundary/format stages ran again. A final UI recovery fix
reads the current head after ordinary save replay too, so repeating the save
button cannot mistake an old accepted receipt for another trainer's latest head.

The first API invocation used a disposable database named `wp07`; safety guards
require a B2B test name. It failed before feature DB cases could execute. Its
unaltered failure log is retained separately in
[api-initial-invalid-db-name.log](api-initial-invalid-db-name.log); creating the
new task-local `b2b_wp07_test` database fixed that harness error. No product file
or test guard was relaxed. Intermediate TypeScript checks caught a temporary
unused import, missing unmerged producer component and inferred UUID-only test
parameters; all were corrected before the final source/checks.

## Remaining integration/acceptance

[Owner requests](owner-requests.md) includes the exact optional root-composition
patch, typed loaders and QA scenarios. Frozen product APIs lack an authorized
catalog read and a read of the publication format discriminator; v2 tenants cannot
use fenced legacy reads. Loaders deliberately require owner-approved resources
rather than guessing a v2 reference from a legacy draft projection. Root wiring,
those read seams, WP01 access/audit registration and WP03 schedule/WP04 publication
composition remain integration-owner work. No arbitrary grants or synthetic
production adapter were introduced. Source is ready to compose; live feature
acceptance remains blocked on those seams and the parent-supplied composed head.

**Zero product browser scenarios executed.** QA owns the new specs/fixtures and
320/430/1440 Chromium/WebKit matrix. Matching-runtime documentation remains the
parent's PR13/WP12 v2 evidence. No HTML layout/interactive keyboard/overflow,
HTTPS/Secure-cookie, physical-device, full build, release-green, content/Yoga,
provider, CI-green or deployment acceptance is claimed. The B2B build exercises
the existing routed application; Vite component tests separately transform the
new unregistered page/editors. Historical milestones/gates remain unchanged.

No production migration/deployment, real user/health data, paid/provider call,
credential/security/trust change, force push, application main merge or new Cloud
dispatch occurred. Parent retains final integration/merge authority; Atlas single
writer retains canonical evidence intake. Local GitHub CLI GraphQL reads returned
Forbidden, so authorized PR publication uses the connected GitHub tool.
