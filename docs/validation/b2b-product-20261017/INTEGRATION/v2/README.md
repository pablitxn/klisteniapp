# Integration v2: composed API and consumer checkpoint

Source: `7f348b21d861ee53149a77617bd2e99d38179408`; source tree:
`1c494a5be3fc1c45f0ff1f07fc33424da3482576`. Branch:
`integrate/b2b-product-v1`, draft PR21. Main remains
`d65261d18de4522fb9a66104aabb5750104fb8b8`; Atlas remains
`ce45d206a2ed4035f8003a3303abd1fff98e09b8`. An evidence-only commit follows this
tested source. Input heads and raw-log hashes are in `evidence.json`.

## Delivered composition

Accepted WP01 authorization, WP02 planning, WP03 records/schedule, WP04 reviewed
alternatives and WP05 private health are composed through the real ACCESS
transactions. Production planning uses the real deterministic schedule adapter.
Public domain exports are registered; no resolution hook, DTO substitute or
synthetic scheduler is used for ordinary checks.

Amendments 001–003 in `docs/contracts/b2b-product-v2/amendments/` describe the
bindings. Migration 007 installs canonical reviewed relations. Additive 008 fixes
branch-scoped consent audit uniqueness, preflights nullable collisions and
preserves historical rows. It is required by readiness. Actual ACCESS
deactivation tests prove atomic two-branch revocation, rollback, exact retry and
reactivation without restored consent. Migration 006 and the lockfile are
byte-identical to the accepted foundation.

Additive `catalogExercises`, `routinePublications` and `routineVersion` endpoints
use the existing generic v2 client and strict existing schemas. Actual v1/v2
publication discriminators, scoped own historical linkage, current assignment
eligibility, archived history, positive HTTP reads and member/foreign denials are
tested. Real HTTP health checks cover selected roles, private headers, category
disclosure, revoke and rejected unsupported import without writes.

WP02 v3 `b861e29b` is incorporated. Its server end instant and stable period bucket
resolve the missing effective-time seam and avoid preview hash drift. Original
end/replay/history and advancing-clock period tests pass. Amendment 003's
forthcoming-WP02 paragraph describes its earlier checkpoint; this receipt records
the accepted successor.

## Actual validation and limits

Node 24.19.0 / pnpm 12.7.0, task-owned loopback PostgreSQL 17.11, synthetic data
only. No production migration, activation, external health access or deployment.

| Check | Result |
| --- | --- |
| Full latest composed API | **198 passed, 1 failed, 0 skipped** (199 tests). |
| Remaining API failure | WP03 `production-schedule.test.ts:84` still expects end to reject missing effective time. WP02 now supplies it; the parent has requested its owner amendment. This is not waived or reported green. |
| Contracts / domain / final client | **22 / 34 / 27 passed**, zero failures/skips. |
| Audit008 focused API | **29 passed**, zero failures/skips. |
| New read/access/health focused API | **10 passed**; expanded positive v1/v2 member HTTP reads subsequently **2 passed**. Latest full run contains the expanded tests. |
| Six-project harness and baseline probes | **4 passed**, zero failures/skips, isolated database. Preserves legacy bytes/IDs across migration 008 and twice-applied registry. |
| Workspace typecheck / build / lint | Passed. Build retains large-chunk warnings. |
| Code whitespace, unchanged006/lockfile, local merge-tree against main | Passed. Immutable historical logs/patches retain their existing whitespace exceptions. |
| Product browser, valid-trust HTTPS, physical device, hosted CI | Not accepted or claimed. |

`api-latest.txt` is the authoritative full-suite result at this source. Earlier
diagnostics are retained: the intermediate producer composition passed194; its
later read-test expansion briefly removed a branch before the test's remaining
branch assertion, corrected by moving the HTTP topology setup to the end. The
latest full run proves that fixture correction. An initial compile-only fixture
helper UUID inference was corrected without changing production behavior.

Harness attempts exposed two setup-order problems, retained verbatim: running
while build replaced output, and sharing a database with concurrently dropped API
schemas during auth introspection. After completed build and a distinct
disposable database, all four checks passed. No readiness/TLS/auth guard was
disabled to obtain that result. The harness guide now documents this isolation.

## Handoff and outstanding work

WP06 may use the published API checkpoint; it owns new membership/export modules
and tests. INTEGRATION **retains shared ACCESS files and final bindings** until
explicit lease transfer. Preserve the same-transaction inactivity hook and
identity-only export. Parent retains dispatch/orchestration.

API/owner blockers still requiring amendments or shared implementation:

1. Accept WP03's stale end-test amendment, then rerun the complete API suite.
2. WP04 member alternatives must recognize exact own v2 issued occurrences;
   its current legacy-assignment-only check returns404 for a v2-only member.
3. Verify/fix WP03 fresh-session acceptance for retired legacy assignments.
   Current writer selects routine archival but not assignment activity. Preserve
   historical correction/replay while denying fresh activity.
4. WP08 needs scoped legacy assignment descriptors, immutable enrollment
   revisions, occurrence-by-ID/inclusion detail and historical report subjects.
   Existing `sessionRevisions` already handles legacy and corrected history;
   do not duplicate it. `routineVersion` now resolves its immutable routine seam.
5. Compose WP07/WP08/WP09/WP10 and WP11 against effective selected role, host/
   access generations and abort lifetimes. No feature UI head is merged in this
   API checkpoint. Narrow planning selectors to selected-branch active members;
   retain inactive history subjects. Reconcile WP08's completed-session move UI
   rule with the server's eligible-completion rule.
6. Add explicit unified session realm/branch bootstrap, preserving existing
   white-label guards. Activated branchless accounts must not fall into rejected
   legacy operational routes; use the accepted restricted export boundary.
7. Add authenticated committed remote health invalidation and fail-closed channel
   loss. WP10 polling/no-store alone is not cross-device privacy acceptance;
   its identity export affordance must support no selected branch.

The feature browser matrix, HTTPS trust gate and final combined build/acceptance
remain outstanding. This is a recoverable development dependency checkpoint,
not a main merge or release recommendation.
