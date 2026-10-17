# WP08 v2 integration handoff

Dependency: published PR21 candidate `591feb1fd6a29306b5dc08a70ae5335a0ce01422`
(source `9c9f1929fcc1fe203bdae86f7dfbd14f7e406614`), amendments005/006.
WP08 source `346efab0c08ed28b19d2ea030e04f424641241b7` is pushed to PR25.

## Compose the owned amendment

[candidate-owned.patch](candidate-owned.patch) is the exact incremental owned
source/test patch against that candidate. It preserves existing original-version,
workout start, legacy-entry and session-edit callbacks and the eligibility-aware
move guard. It applies to the pinned candidate; source hashes and composition
identity are in composition.json. Only WP08 files differ in the validated tree.
No candidate package, DTO, migration, shared route or root source is copied into
PR25. The branch remains additive from its original frozen base. INTEGRATION may
use the incremental patch to avoid reapplying already integrated owned deltas.

The historical reader gaps in v1 are now resolved by the approved candidate:

- `legacyAssignments` renders retired, archived and unexecuted issued assignments
  in member **and staff** history, independent of whether a start callback exists.
- `occurrence(id)` responses remain intact as `OccurrenceContext` pairs. Actual
  inclusion never searches a flattened mix of weekly/continuity enrollment
  snapshots. Every latest actual uses its linked pair for eligibility, original
  linkage, current schedule/revision and its frozen local-date timezone.
- `enrollmentRevision` is requested using the occurrence's `enrollmentId` and
  `issuedEnrollmentRevision`, never `issuedGoalRevision` or the current period.
  Actual and calendar cards expose the issued-period details; continuity exposes
  the current revision as explicitly current. The immutable view includes the
  saved objective, stages/dates, exact routine references, actor and recorded time.
- `historySubjects` supplies the staff roster, including retained inactive targets.
  No `people` or health call is substituted for historical-subject access.

No new root props are required for existing ProductHistoryPage/ProductWorkoutHistory
bindings. Preserve the existing guarded `createClient`, current `accessKey`,
`onOpenRoutine`, `onStartOccurrence`, `onStartLegacy` and `onEditSession` callbacks.
The optional readonly callbacks remain absent in staff history. Amendment006's
request suspension/context lifetime must continue to apply to all lazy reads.

## Exact optional root roster binding

The existing root Reports wrapper already calls `historySubjects`; it remains
source-compatible. WP08 also supplies an owning-feature `ProductHistoryReportsPage`
loader with explicit response-scope validation, retry and immediate owner-key
isolation. [root-binding-request.patch](root-binding-request.patch) replaces the
root wrapper's duplicated roster load with that component and preserves the
current original-routine callback. It passed apply-check against the candidate
in an isolated index, **was not applied or tested**, and remains INTEGRATION's
exclusive root edit. No package/contract/export/navigation registration change
is requested. The wrapper is also exported by the existing owned ReportsPage.

If consumers directly instantiate ProductExecutionHistory/SessionHistory, replace
`occurrences` plus `enrollments` with `occurrenceContexts: ProductOutput<'occurrence'>[]`.
Do not reconstruct these contexts by combining independent lists. ProductHistoryPage
already handles this internally. WeekCalendar receives the same paired contexts
for linked actual status and keeps the authoritative weekly summary counts.

## QA-owned follow-up scenarios

On the combined head, exercise the issued-period native button with keyboard and
touch at320/430/1440 in Chromium/WebKit, including close/reopen/retry. Confirm exact
request `enrollmentRevision(id,issuedEnrollmentRevision)` and original objective,
stage dates, actor/time after a period move or cancellation; the issued goal
revision is a different displayed number. The immutable routine callback must
open the exact reference from that historical period, including removed slots.

Delay continuity/weekly responses at revisionN, return the linked atomic pair at
N+1, and reverse the relative freshness. Inclusion must follow the pair in both
cases. Load a completely unrelated week while moved/cancelled actuals remain in
history; no unknown lookup, vanished actual, duplicate completion or invented
absence. Check paired original timezone with device/selected timezone different.

Staff selects an inactive history subject, sees archived/unexecuted assignments
without a start button, and opens original period details. Revoke/switch context
while those reads are pending: abort/hide old data, no health read and no inferred
permission. Retain the existing four/three/one, partial/void, original-link and
same-week move cases. QA owns cross-feature browser specs/fixtures; none changed
here and no browser acceptance is claimed by unit/SSR results.
