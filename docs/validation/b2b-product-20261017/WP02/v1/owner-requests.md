# WP02 owner handoff

Validated source: `5476de948722f11e6acf9e93ce87834c9bb58795`.
Frozen base: `0b611064a91b87b3a17274cabca5415bcf1d7d55`.
Parent retains dispatch, monitoring, integration and merge decisions. No new task
was dispatched. No shared file was edited in this work package.

## ACCESS / INTEGRATION: exact service registration request

Compose these already-bound methods into the existing product service registry;
register only the frozen ProductEndpoints methods/paths with version header 2,
product activation and current session/host/tenant/branch authorization:

```ts
import { createPlanningServices } from './planning/index.ts';
import { createPlanningResources } from './planning/resources.ts';

const planning = createPlanningServices({
  ...createPlanningResources(resolvePublicationRelations), // WP04 callback below
  schedule: planningSchedule, // WP03 callbacks below
});

// Merge into the owner-controlled registry once:
// { ...otherProductServices, ...planning }
```

The registry contains exactly `routines`, `routine`, `saveRoutine`, `publishRoutine`,
`archiveRoutine`, `goals`, `saveGoal`, `archiveGoal`, `enroll`, `endEnrollment`,
`continuity`, `periodPreview` and `applyPeriod`. Each accepts the frozen
AuthorizedProductContext and ProductInput for that endpoint. No tenant is accepted
from payload. No callback opens another database connection. ACCESS owns the full
outer transaction and must roll it back on errors. Do not turn the fixture's
context builder into a production authorization implementation.

Resource locks serialize `canonicalJson([organizationId, branchId, family, id])`
with `pg_advisory_xact_lock(hashtextextended(key, 0))`. Enrollment family is
`enrollment`; per-actor operation lock is
`canonicalJson([organizationId, actorId, 'operation', operationId])`. Align RECORDS
locking/receipt races with this convention or serialize them through ACCESS's
common transaction locks. Receipt identity remains the frozen organization/actor/
operation primary key; authorization always precedes replay lookup.

## WP03: deterministic schedule interface

Import `PlanningSchedule`, `ScheduleChange`, `PeriodImpact` and
`PlanningSessionHead` from `apps/b2b-api/src/planning/schedule-change.ts`.

- `plan(change)` is synchronous, deterministic and side-effect free. Its input
  contains `reason: enroll | period | end`, nullable previous enrollment, proposed
  next enrollment, current immutable occurrence snapshots and latest linked session
  heads (`id`, `occurrenceId`, `revision`, full frozen snapshot).
- Return the frozen PeriodImpact records for affected existing occurrences. Each
  occurrence appears at most once, with its exact current revision/date/eligibility
  and every linked session ID. Include removed/out-of-window obligations, accepted
  member date overrides and changes to completion eligibility in the reason.
  New schedule slots remain explicit in `change.after.content`; allocate/persist
  their stable IDs/ordinals only during apply, without renumbering existing work.
- `apply(context, change, impacts)` runs after new enrollment/stage revision rows
  have been inserted, inside the same authorized transaction and enrollment lock.
  Reconcile stable occurrence identities, append occurrence revisions, preserve
  original issued stage/routine/date/week links and all actuals. End cancels future
  operational obligations without deleting history. Enrollment creates revision 1.
- Actual eligibility, affected-week recomputation and no-double-count accounting
  stay in RECORDS. Preserve accepted same-week overrides through stage-boundary
  edits; show/log excluded actual work without moving performed dates.
- The planning preview fingerprint already includes proposed content, actor/scope,
  enrollment, all occurrence snapshots, linked session revisions/snapshots, impacts
  and expiry. A correction or move after preview must cause stale-preview rejection.
  Exact already-accepted operation replay bypasses recomputation only after current
  authorization. There is no no-op production schedule fallback.

The synthetic adapter in `tests/wp02/fixture.ts` is deliberately limited and must
not be registered in production. Parent should forward this seam to WP03 and have
the composed adapter run both WP02 test files plus WP03's own schedule/adherence
suite. No source-level assumption about WP03's unpublished implementation was made.

## WP04: publication resolver

Implement `PublicationRelations` from `planning/resources.ts`:

```ts
(context, assignableRoutine, sourceExercises) => Promise<ReviewedRelation[]>
```

Return explicit reviewed directions/provenance/conditions and independent target
doses for source steps with `substitutionPolicy: reviewed`; blocked steps suppress
their options. Do not reinterpret legacy allowlists as reviewed evidence or null
load as bodyweight. The resolver must validate canonical provenance and current
scoped eligibility. Planning checks target content against current available
published catalog rows and freezes returned relations with exercises/machines.
It checks active branch inventory at publication/new assignment and preserves the
original frozen version on subsequent calendar-only edits.

The contract has no per-step target-dose editing endpoint. If WP04 needs a new
transport/store field, return that concrete amendment to CONTRACT before changing
DTOs; do not discard or invent a target load/dose here.

## INTEGRATION: domain export request

`integration-exports.patch` adds the explicit `b2b-domain/prescription` export and
named root exports for the new pure helpers. It was generated from the frozen
manifest/barrel without applying it. This is an optional consumer convenience;
the planning API compiles against existing public contract/domain exports today.
Only INTEGRATION may apply/reconcile the patch. No new dependency is required.

## WP12 / UI owners: browser scenarios

Feature workers supply these cases; QA exclusively writes new browser specs and
fixtures. Execute on the composed head at 320/430/1440 widths in Chromium/WebKit,
unified and white-label scoped flows:

1. Save/reload an empty routine and unfinished step. Publication shows exact field
   issues; fixing reps/time/load/laterality/rest enables publication with no score.
2. Publish fixed and range targets, assign two same-day slots in two dated stages
   separated by a gap. Verify today's/past/future continuity and frozen version links.
3. Retain simultaneous enrollments. A stale trainer edit shows conflict; an exact
   retry returns the original result and one audit event.
4. Log a session, preview a cross-week period move and inspect inclusion/exclusion
   of linked work. Apply preserves original routine, performed values/date and
   access to older revisions; affected week accounting is WP03's derived output.
5. Move an occurrence or correct its actual after preview; apply must demand a new
   preview. Repeat with expiry, another trainer, changed proposal and an accepted
   member same-week date override across a stage boundary.
6. Archive a routine/goal and end an enrollment. New selection stops while historical
   links survive. Reactivation/inactive history follows WP01/WP06 grants.
7. Switch branch/brand/account, revoke actor/target access and replay pending edits.
   Foreign IDs and unauthorized retries fail. No cross-tenant content is rendered.

UI, browser, HTTPS and final end-to-end authorization results remain unexecuted
here. A successful fixture callback is not a product acceptance result.
