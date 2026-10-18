# Training architecture/gap audit — A02–A05

Publication context: this captures a read-only baseline audit. The main plan C01-C08 and work-package ownership supersede tentative recommendations below; they do not change the recorded baseline observations or test results.


Read-only audit on 2026-10-17. Application `/workspace/klisteniapp`, branch
`docs/b2b-development-plan-v1`, HEAD
`d65261d18de4522fb9a66104aabb5750104fb8b8`; Atlas
`/workspace/sysadmin-workspace`, branch `work`, HEAD
`ce45d206a2ed4035f8003a3303abd1fff98e09b8`. Both working trees were clean when
read. No application/Atlas feature, branch, PR, runtime or infrastructure changes
were made by this audit. This report is a temporary handoff, not the owning plan.

## Authority and coverage

Read application AGENTS.md, Atlas root and atlas/AGENTS.md, the actual
`.agents/skills/atlas-navigate/SKILL.md`, Atlas source-of-truth policy, relevant
catalog entries, source/entry `2026-10-17-klisteni-b2b-product-definition`, and
roadmap A00–A08. The October 17 entry lines 97–101 establishes d02–d06;
lines 123–127 retain Q01–Q05 as implementation details. Atlas roadmap lines
32–35 owns A02–A05. The October 17 source records product decisions, not executed
application behavior. App code/contracts at the pinned revision govern what is
implemented. Existing dated QA/release evidence is retained and not promoted to
current deployment evidence.

Scope: program/routine authoring, prescription, stages, routine/session history,
period edits, weekly scheduling/adherence, own-log editing, autosave/local
durability and reconnection. A01 authorization, A06 alternatives, A07 consent and
A08 entitlement are examined only at their interfaces. No provider/network or
production verification was performed.

## Implemented / partial / missing matrix

| Decision / capability | Status at pinned application HEAD | Exact implementation/test evidence and remaining gap |
| --- | --- | --- |
| d02: no evaluative balance score | Implemented constraint in examined workflow | `packages/b2b-domain/src/training.ts:17–26` validates duplicate/self alternatives; `apps/b2b-api/src/training/index.ts:52–63` resolves catalog references; `apps/b2b-api/src/training/rules.ts:31–48` checks equipment. No routine balance/quality score is calculated in these programming paths. Preserve this distinction: valid references/configuration/equipment are not an evaluation of trainer judgment. |
| d02: incomplete draft authoring | Partial local support; server behavior contradicts new decision | `apps/b2b-web/src/features/programs/programDraft.ts:22–64` permits unfinished finite numeric values and empty step arrays locally; `ProgramEditor.tsx:39–46` uses recoverable editor drafts. However `programDraft.ts:68–73` parses save through strict `ProgramInputSchema`; `packages/b2b-contracts/src/training.ts:5–22,26–35` requires a valid step, positive sets and exactly one of reps/duration, plus at least one step. `ProgramEditor.tsx:197–200` disables save with no steps. Empty/incomplete local data cannot be saved as a server draft. |
| d02: detect empty/missing required configuration at assignment | Partial, currently enforced too early | Strict create/update input prevents these defects from reaching publication/assignment, but provides no distinct draft versus assignable shape. `apps/b2b-api/src/training/index.ts:108–131` snapshots only after catalog validation; `:188–193` resolves published exercises and equipment at assignment. No per-exercise-type applicability matrix or structured missing-field issue list exists. `packages/b2b-contracts/tests/roadmap.test.ts:24–68` tests timed/repetition shape and historical decode, not incomplete server drafts/assignment-time issues. |
| d03: goal-oriented program | Partial routine objective; missing program aggregate | Existing `Program` means a flat reusable routine: `packages/b2b-contracts/src/training.ts:26–65` has name, description, steps, ID, revision, version. `ProgramEditor.tsx:170–175` labels description as objective/description. There is no goal-bearing multi-stage program/member enrollment aggregate. Do not treat existing `Program` as the new staged program. |
| d03: sequential dated stages and reusable routines | Routine/version reuse implemented; stages missing | Program version published in `apps/b2b-api/src/training/index.ts:108–131`, reusable assignment at `:162–204`; schema `database.ts:26–29` stores program/version/assignment/execution. Assignment input `training.ts:89–91` contains only memberId/programId/version. No stages, start/end dates, stage order, repeat pattern or timeline revision model. `ProgramAssignmentForm.tsx:63–84` selects recipient only, not stage/period. |
| d03: today's routine and past/current/future phases | Missing | `AssignedRoutines.tsx:25–27,44–77` displays assignments and a start button; no date selection, phase state or today highlight. Routine totals and completed-session counts at `:30–41` are lifetime loaded-data counters. |
| d06: fixed prescribed sets/reps/weight/duration/rest/notes | Implemented for present scalar model, with Q02 limits | `packages/b2b-contracts/src/training.ts:5–22`: sets 1–30, reps 1–1000 or seconds 1–86400, optional kg 0–1000/RPE 1–10, rest 0–3600, notes. `packages/b2b-ui/src/training-labels.ts:18–31` distinguishes prescribed/actual labels. Current model requires reps XOR duration universally; applicability must be decided rather than copied as a universal rule. |
| d06: prescribed ranges/applicable units | Missing | Same strict scalar schema has no range discriminator/min/max/unit-bearing quantity. RPE is useful existing scope, not a substitute for requested dose ranges. Actual observed quantities must remain scalar observations and separate from prescribed ranges. |
| d03/d04: immutable original prescription linkage | Implemented reusable foundation | Publish captures steps plus exercise/machine content (`training/index.ts:118–129`); program updates only current data/revision (`training/repository.ts:97–118`). Execution reads join original assignment → program version (`repository.ts:169–205`). SQL FKs at `database.ts:26–29`, reinforced with branch/member composite FKs at `white-label-schema.ts:136–142`, prevent cross-scope lineage and implicit deletion. Preserve these IDs/versioned bytes. |
| d03: dated actual exercises/weight/repetitions/variants | Implemented for saved records | `ExecutionSetSchema`, `ExecutionInputSchema`, `ExecutionSchema` in `training.ts:127–178` store actual exercise, reps/seconds, load, RPE, reason, date, status and original assigned snapshot. `ExecutionHistory.tsx:17–30,36–69` renders date/status and prescribed/actual/variant reason. Tests `training.test.ts:112–178`, `sessionDraft.test.ts:376–446` cover actual-versus-target and timing. |
| d03: routine continuity/history/objective/periods and bidirectional navigation | Partial data linkage; missing dedicated journey | Execution has assignmentId and snapshot with programId/version; history displays program name/version but no navigable routine reference (`ExecutionHistory.tsx:23–35`). No routine → associated dated sessions drilldown or objective/period timeline. Current table's change column is a per-set substitution reason, not routine continuity. Do not replace this actual-history detail with substitution counts. |
| d04: move periods, recompute inclusion, preserve records/link, attribute changes | Missing operation; linkage foundation present | No period entity or date-edit endpoint in `http.ts:702–764`, no such columns in base training DDL or white-label additions. Existing retire endpoint only flips assignment.active (`white-label-service.ts:268–280`); it is not a date move. Current audit helper stores actor/action/resource/time but no before/after data (`organization-context.ts:37–41`, `database.ts:32`), insufficient to explain which dates changed. |
| d05: Monday–Sunday prescribed occurrences and within-week move | Missing in B2B; distinct B2C groundwork exists | B2B assignment has no occurrence/week/date identity. B2C `TrainingPlanSchema` (`scene-schema/src/index.ts:127–138`) and `planWeekStart` (`:252–255`) support Monday weeks, unique weekdays and routine ID; no B2B consumption. B2C model is days/week, not uniquely identified prescribed routine occurrences. |
| d05: week-close 4 required / 3 completed / 1 missed, no double count | Missing in B2B | `training/rules.ts:99–130` aggregates number of assignments/completed/partial executions and latest activity without a week or prescribed denominator. B2C `computePlanProgress` (`scene-schema/src/index.ts:289–327`) caps distinct workout dates to target weekday count; it does not verify routine identity/occurrence, has no partial status, explicit missed count or close ledger. Do not reuse its adherence result for B2B. |
| d05: partial remains partial, save != completion | Implemented and tested for current create-only workflow | `checkExecution` (`b2b-domain/src/training.ts:44–81`) only accepts completed if every prescribed set identity has a positive performed quantity. Partial does not become complete merely because every row exists. Explicit buttons `Session.tsx:129–141`; local draft persist has no server call (`useTrainingSession.ts:49–60`). Browser test `b2b-member-roadmap.spec.ts:72–97` asserts timer/unchecked sets cause no saves. Preserve while adding editing/sync. |
| d05: user edits own saved logs | Missing and explicit contradiction | Only GET/POST executions routes exist (`http.ts:753–764`; client.ts:315–327). On same ID/different payload `recordExecution` rejects 409 (`training/index.ts:221–233`). `Session.tsx:147–149` explicitly says partial closes the session and saved records cannot be edited; `ExecutionHistory.tsx:33–35` directs user to start another session. Architecture docs at `docs/architecture.md:91–96` and `docs/b2b.md:95–96` state confirmed partial/full immutable. New product decision supersedes this behavior, while immutable historical evidence can be retained via appended revisions. |
| d05: autosave/local durability | Implemented for in-progress B2B draft on loaded session; broader scope partial | `useTrainingSession.ts:26–35,49–60` recovers and persists localStorage on edits, exposes storage failures, does not complete a workout. `sessionDraft.ts:36–45` scopes keys by organization/branch/account/member/assignment; `:154–178` retains invalid source bytes in recovery backup. Missing account-wide durable server drafts, per-occurrence keying, multi-tab arbitration and guaranteed offline bootstrap/assignment cache. Local durability must not be advertised as server synchronization. |
| d05: uncertain delivery retry | Implemented for explicit manual create submission | `useTrainingSession.ts:78–99` persists immutable pending payload before sending; `sessionDraft.ts:212–219` reuses ID/date/status, `:256–258` keeps uncertain network/408/429/5xx pending; `:261–275` avoids erasing a later draft. Server exact-replay protection `training/index.ts:221–245`; current inventory changes do not reject accepted exact replay. Tests at `sessionDraft.test.ts:280–374`; browser lost-response/navigation test `b2b-session.spec.ts:13–65`. |
| d05: automatic reconnection sync / pending edit queue / multi-device conflict handling | Missing beyond manual create retry | `Session.tsx:25–34` online listener changes notice only; `:75–79,119–125` asks user to retry. Hook never drains on reconnect. No persisted operation queue, accepted log revision, expectedRevision mutation, multi-device merge/review UI, deletion semantics, synchronization status ledger or tab coordination. Program optimistic concurrency exists and is reusable, but does not cover executions. |

## Critical contradictions and compatibility traps

1. **Incomplete drafts:** confirmed d02 (Atlas entry line 97) versus current
   strict create/update/save as detailed above. Separate draft validity from
   assignment validity; do not merely remove assignment validation globally.
2. **Own-log edits:** d05 (entry line 100) versus explicitly immutable confirmed
   logs in code/UI/docs/tests. Preserve original actual record as a revision,
   add audited edits, and update docs/tests intentionally. Exact create replay
   must remain immutable/idempotent even after an edit; do not reinterpret
   changed POST bodies as updates.
3. **Date moves:** d04 (entry line 99) allows moved periods to change prescribed
   inclusion while retaining actual records. B2C `isPlanHistoryPreserved`
   (`scene-schema/src/index.ts:264–277`) rejects changing begun weeks, enforced
   by `apps/b2c-api/src/state.ts:93–97` with PLAN_HISTORY_CONFLICT. This is a
   separate product's existing contract, not a solution to the B2B date-edit
   requirement. Preserve B2C behavior until its own compatibility change is
   chosen; only reuse lower-level calendar math.
4. **Day counts are not occurrence counts:** B2C function deduplicates by date
   and accepts any workout regardless of routine snapshot. This silently
   collapses two distinct prescribed sessions on one day and can satisfy the
   wrong routine. B2B adherence must use distinct immutable occurrence IDs and
   eligible completed execution revisions. Four required/three completed/one
   missed is invariant; do not subtract partials, repeated saves or moves.
5. **Strict DTO versioning:** current training objects are `.strict()` and old
   clients reject enriched responses. `docs/b2b.md:214–231` already documents
   this coordinated API/web release and rollback hazard. New date/stage/occurrence
   fields cannot be called wire compatible merely because SQL migrations are
   additive. Introduce explicit v2 endpoints/DTOs or a coordinated same-version
   deployment; preserve historical read adapters and replay normalization.
6. **Assignment != occurrence:** one existing assignment may produce arbitrarily
   many saved sessions; per-assignment draft key permits one current local draft.
   Do not backfill one prescribed occurrence per existing execution or infer a
   required weekly target from assignment counts. Retain legacy history as
   unbound/unplanned where no actual prescription evidence exists.
7. **Status/date naming:** every legacy partial record has `completedAt`
   (`training.ts:144–147`); that field alone cannot signify completion. New
   contracts need actual performed/submitted timestamps plus explicit completion
   status/transition. Preserve legacy field/value in historical adapter.
8. **Revocation/inventory vs offline facts:** current new-record submission
   checks live assignment.active and equipment (`training/index.ts:235–244`)
   while exact accepted replay bypasses these checks. Offline work completed
   before later retirement/inventory change has no agreed admission policy.
   Resolve Q04/Q05 with A08/A01, retain rejected local work, and never evade
   current membership/consent/entitlement checks to obtain sync success.

## Existing components to reuse

- `b2b-contracts`: canonical DTO input/response parsers, historical default-only
  decoding, revision and version schemas. Do not couple B2C to B2B auth/session
  contracts merely to reuse dose/week types.
- `b2b-domain/training.ts`: pure identity/set completeness validation and
  prescribed-versus-actual distinction. Extend with occurrence/adherence rules;
  do not introduce balance scoring.
- `TrainingModule` + `TrainingRepository`: owner transaction/authorized Context,
  organization/branch scoping, immutable program versions, creator identity,
  actor-aware creation idempotency and explicit set validation.
- SQL original program/version/assignment/execution FKs, branch/member composite
  constraints, current revision update pattern. Add timelines and execution
  revisions beside them; avoid rewriting published snapshots.
- `programDraft.ts`, shared editor draft/conflict UI and ProgramEditor expected
  revision pattern: reusable local recovery/concurrency concepts. Session edits
  need their own revision-aware state machine rather than blindly importing
  editor behavior.
- `sessionDraft.ts`, `useTrainingSession`, separate partial/complete actions,
  storage-error indicators, exact pending payloads and scoped keys; retain
  late-response guard and invalid-byte backup during migration.
- `ExecutionHistory`, prescribed/actual dose labels, own history JSON export,
  existing historical branch access. Add routine/period navigation instead of
  replacing the history renderer.
- `LocalDateSchema`, `TimeZoneSchema`, Monday calendar math and DST/year-boundary
  test cases in `scene-schema`. Extract only neutral primitives into an allowed
  common boundary if needed; B2C schema/metric semantics are not interchangeable.
- Existing public website activity `schedule` is free text
  (`packages/b2b-contracts/src/website.ts:45,80`), not a member prescription
  calendar; do not build adherence on public activity descriptions.

## Proposed concrete data and API contract (proposal, not settled Q02–Q05)

### Identity and aggregate boundaries

- Retain legacy `Program`/programId/version as the **routine** identity. Avoid
  silently changing `Program` from a flat routine into an enrollment program.
  Add a distinct `TrainingProgram`/`MemberProgramEnrollment` carrying member,
  goal, scope, draft/published state, revision and attribution. Name can be
  selected in owner ADR; this report's names are illustrative contracts.
- `TrainingStage`: stable id, program id, ordinal, goal/notes, startLocalDate,
  endLocalDate, calendar revision, created/updated actor. Proposal: inclusive
  start/exclusive end and nonoverlapping sequential stages validated on
  assignment; specify gaps/overlap/backdating/reuse rules in Q02. Do not present
  this proposal as Pablo's already chosen date policy.
- `StageRoutine`: stable placement id, stage id, retained routineId and pinned
  routineVersion, reusable scheduling template, objective snapshot/ref. Publishing
  a new routine version does not rewrite old placement/snapshot/execution.
- `PrescribedOccurrence`: stable id, scope/member/enrollment/stage/placement,
  original routineId/version, prescribed snapshot/ref, original local date,
  scheduledLocalDate, weekStartLocalDate, trackingTimeZone, scheduleRevision and
  state. Unique generated slot key such as enrollment + stage-placement +
  prescription-week + ordinal prevents generation/retry duplication. Repeated
  instances of the same routine have distinct occurrence IDs. Dates are not IDs.
- Keep original occurrence provenance immutable. A user move edits scheduled
  local date only, with expected schedule revision; same Monday–Sunday owner
  week required, prescribed routine/version/dose and count unchanged. Distinct
  occurrences may legitimately share a day. Period edits create audited calendar
  revisions and an explicit membership/inclusion projection; do not delete actual
  sessions or relink them to a newly generated unrelated occurrence.
- Existing `Execution` identity remains stable, retaining original assignment,
  routine/version and optional occurrence link; new create captures actual
  observed exercise/dose and substitution provenance. Add append-only
  `ExecutionRevision` for allowed user edits: executionId, revision, expected/base
  revision, prior revision, actor, server receive time, client mutation ID,
  changed fields/reason, status and actual values. Latest revision determines
  current view/adherence; old values remain inspectable. Never point an old
  session at current mutable routine contents.
- Audit period edits must include before/after dates or immutable revision IDs,
  actor/time/scope and correlation mutation ID. Existing action/resource rows
  alone cannot prove what changed.

### Prescription versus observations

- Separate `RoutineDraft` from `AssignableRoutine`. Draft allows empty steps,
  incomplete measurement selection and missing applicable required values while
  bounding IDs/string sizes/step count and rejecting impossible finite ranges.
  Assignment returns issues `{stepId, field, code}` such as EMPTY_ROUTINE or
  MISSING_REQUIRED_CONFIGURATION using an explicit exercise/prescription-type
  matrix. No judgment score or blanket requirement for every field.
- Proposed dose primitive: `{kind:'fixed', value, unit}` or
  `{kind:'range', min, max, unit}`, with typed dimensions (count, kg, seconds)
  and bounded min <= max. Notes remain text. Per-type rules choose supported
  fields and duration/repetition combinations. Existing scalar v1 values decode
  to fixed doses without modifying stored snapshots. Do not infer physical
  equivalence or fill target doses automatically from original exercise.
- Actual set observations remain concrete scalar reps/seconds/load/RPE and
  stable step/set/exercise identity; a prescribed range is never stored as work
  the user performed. Keep explicit `partial`/`completed`; draft save, sync
  acknowledgment and elapsed timers cannot transition to completed.

### Weekly adherence

- Query/project against eligible prescribed occurrence IDs for the specific
  member/week and resolved stage calendar revision. Proposed response:
  `{weekStartLocalDate,timeZone,closeAt,state:'open'|'closed',required,completed,
  partial,remaining,missed,calculationRevision}` plus occurrence breakdown.
  `completed = count(distinct eligible occurrenceId with eligible latest
  completed execution)`; partial contributes zero completed. `remaining =
  required - completed`; report `missed` as null while open, and required minus
  completed when closed. Four/three/one required test. This representation of
  open weeks is a recommendation, not an already resolved product detail.
- Extra/unbound sessions remain visible actual history and must not fulfill an
  arbitrary prescription. Multiple execution attempts for one occurrence cannot
  count twice. Do not count another routine, autosave, retry or two revisions
  as another prescribed completion.
- Resolve timezone owner (program/member/gym), close instant, late/offline
  submission, post-close edit/reopen, period-crossing move and repeated/parallel
  sessions in Q04/Q05. Retain both client performed time and server received time;
  never substitute one for the other invisibly. Store calculation revision and
  explain changed inclusion after a trainer period edit.

### API shape and synchronization

- Preserve legacy GET/POST `/programs`, `/assignments`, `/executions` exact replay
  semantics during migration; propose explicit versioned training endpoints for
  staged programs/occurrences/editable executions. New strict response schemas
  and old-client behavior require contract tests. New GET routine history and
  GET execution detail expose stable mutual links, goal, calendar revisions and
  prescribed versus actual snapshots within authorization.
- Typical proposed operations: create/update draft program/stage/routine;
  `validate-assignment` returning structured completeness issues; assign/publish
  with expected revision and idempotency key; `move-occurrence` with occurrenceId,
  targetLocalDate and expectedScheduleRevision; `move-stage-period` with before
  revision/after dates; create execution with occurrenceId, immutable client ID
  and mutation ID; update own execution with expectedRevision plus full actual
  payload/explicit status. Endpoint spelling is an implementation choice.
- Execute all writes through existing locked organization context. Tenant,
  branch, actor and member owner come from authorized context/resource lookup,
  never accepted as trustworthy request-body scope. A01 defines broadened trainer
  read/edit scope; user edit endpoint must verify own log regardless of trainer
  read permissions.
- Every operation uses persisted clientMutationId + scope and canonical body
  fingerprint. Same ID/body returns the original accepted result; changed body
  conflicts. Edit expectedRevision prevents silent concurrent overwrite. Create
  replay after a later edit returns the original create acknowledgment, while
  separate GET returns latest revision; distinguish these contracts explicitly.
- Durable local outbox stores version, exact payload, mutation/operation ID,
  execution/occurrence/base revision, organization/brand/branch/account binding,
  client time and pending/failed/conflict/acknowledged state. Persist before send;
  drain on reconnect/reauthentication only after current entitlement/access
  checks. Retry transient failures with bounded backoff; acknowledge by exact
  mutation ID before cleanup. Conflict retains both local/remote revisions for
  review; no silent last-writer-wins.
- Key draft by member + original occurrence + execution ID, rather than only
  assignment, so repeated prescribed sessions remain independent. Migrate legacy
  local bytes/pending payloads without assigning invented occurrence IDs. If
  using IndexedDB, preserve existing storage error/recovery guarantees; backend
  choice is not itself the accepted conflict/durability policy.
- Multi-tab synchronization/lease or conflict detection prevents clobbering
  one outbox entry. Logout/account switch hides/pause-bound queues; never replay
  one account's draft under another. Revocation/inactive membership prevents
  unauthorized uploads; unresolved local work must be retained for an allowed
  recovery/export path. A07 health consent is a distinct boundary and must not
  accidentally share training queue data with trainers.
- Do not equate loaded-session localStorage support with full offline reload or
  startup support. If offline startup is selected as part of Q05, separately
  cache validated assignment snapshots/application shell with explicit stale
  authorization behavior. No service worker is required solely to claim current
  loaded-form local durability.

## Narrowly owned work packages and integration dependencies

These are proposed slices under existing Atlas A02–A05, not duplicate backlog IDs
or execution authorization. One contract/migration owner must coordinate shared
files; consumers start from frozen schema/DTO fixtures. Parent owns final plan.

| Proposed slice / Atlas owner | Exclusive ownership | Dependencies / acceptance tests |
| --- | --- | --- |
| Contract/compatibility design (A02 with A03/A04/A05) | Training contract ADR/spec, versioned DTOs, fixture vocabulary and one coordinated migration sequence; single writer for `b2b-contracts/src/training.ts`, exports/responses/inputs, client public API and migration registry/database shared files | Q01 boundary with A01; Q02 dose/required-field and stage constraints; Q03 original snapshot/revision; Q04 week policy; Q05 conflict/admission policy. Fixtures cover legacy flat routine/partial/timed snapshot decode, strict old-client behavior and exact replay before/after schema upgrade. Resolve names before parallel consumers; no inferred occurrence backfill. |
| Draft/prescription rules (A02) | Pure draft/assignable/dose validation and server routine create/update/publish/assign implementation; coordinate training module/repository edits with next slice | Contracts + Q02; permit empty/incomplete server draft; assignment rejects empty/missing field and invalid range/unit, returns stable issues; valid exercise-specific prescription passes; equipment/reference failures remain; no balance score. Preserve old versions and idempotent publish/assignment. |
| Program/stage timeline and calendar revision (A02/A03) | New staged aggregate repository/module + migrations delegated through single migration owner; stage/period mutations and audit payload | A01 scope, prior contracts and routine/version baseline; order/overlap/date/DST fixtures; same routine reused across stages retains identity/version; moving start/end dates changes prescribed inclusion while SQL row count/log data/original linkage remain unchanged; actor/before/after/time audited; stale revision rejected. |
| Actual-history and own-log revisions (A03/A05) | Execution revision storage/read/edit API and history projection; one writer for touched `training/index.ts`/`repository.ts`, or split new module with explicit handoff | A01 own-log permissions + Q03; routine edit/version publish/retire after actual session does not change actual values; original and latest revisions accessible under authorization; another user denied; expectedRevision stale => conflict; create/retry unchanged; explicit partial-to-completed and edited-completed recomputation follow Q04, never autosave promotion. |
| Prescribed-occurrence/adherence service (A04) | Occurrence generation/moves/week-close pure rules and server projection; migrations through single owner | A02 stage/routine placements + A03 immutable links; Q04 close/timezone/late policy frozen with A05. Test four required, three distinct completed, one missed; partial zero completion; retry/revision/move no duplicate; two eligible occurrences on one date count twice; repeating one occurrence twice counts once; wrong routine/unbound activity doesn't satisfy; cross-week user move denied; Sunday/Monday, DST/year boundaries; late/offline completion and reopened week; trainer period move reprojects inclusion without deleting actuals. |
| Professional program editor and member routine/history UI (A02/A03/A04) | New stage/timeline/routine history features and assigned-routines/history/assignment form UX; one writer per existing TSX file | Frozen DTOs/mock fixtures permit UI work while API prepared; real integration after services. Incomplete draft saves/reloads, assignment field errors focus correctly, today/past/future phase visible, objective/period continuity, routine ↔ actual history links, date moves leave actual details stable, week counts and statuses accessible. No substitution-count metric as routine history. |
| Local durable outbox/sync controller (A05) | New storage/sync module and its unit tests; own changes to sessionDraft/hook coordinated with UI owner | Execution mutation protocol + Q05 + A01/A08 capability check; sequentially integrate reconnect hooks and UX. Test persist-before-request, offline edit+reload, quota/access failure, invalid legacy bytes preserved, exact retries after lost response, automatic reconnect drain, duplicate delivery, out-of-order ack, account switch, stale session/permission loss, cross-tab/multi-device conflict, trainer calendar revision while member offline, accepted create replay after later edit, pending completion remains pending rather than counted, local autosave remains incomplete. |
| Regression/integration acceptance (existing coordinator) | Shared browser fixtures, current-main receipt and boundary checks after all slices; no runtime deployment implied | Run selected domain/contracts/API DB/UI/browser checks at immutable integrated HEAD. DB tests must not skip; test both upgrade from pinned DB copy and new installation. Keep B2C plan semantics and old backups/read adapters unless explicitly migrated. Preserve current release/Yoga/archive/provider/physical-device gates as independent existing work. |

Work that can proceed independently after contract freeze: pure dose validation,
occurrence/week rule tests, UI against agreed fixtures, and outbox persistence
controller against protocol fixtures. Shared TrainingModule/Repository/contracts/
HTTP/client/migration registries must not receive competing uncoordinated writers.
A03 before A04/A06 remains the Atlas dependency; sync must not invent its own
completion or week policy while A04 is unresolved.

## Validation performed and limits

Executed at application HEAD d65261d (Node v24.19.0):

```text
node --test packages/b2b-domain/tests/training.test.ts \
  apps/b2b-api/tests/training.test.ts \
  apps/b2b-web/tests/sessionDraft.test.ts \
  packages/scene-schema/tests/personal-data.test.ts
49 tests; 49 pass; 0 fail; 0 skipped.
```

These are existing tests, no test code was added. They confirm the current
completeness, actual-vs-target, retry/draft and B2C calendar baseline; they do not
prove staged programs, editable logs, B2B adherence or automatic sync exist.
Inspected DB-backed test `apps/b2b-api/tests/white-label-training.test.ts`:
fixture gated by B2B_TEST_DATABASE_URL at lines 22/104–107 and SQL schemas at
28–36. Did not provision DB, execute its mutating fixture, run browser server,
or claim fresh DB/browser results. Its existing tests at 329–418 provide useful
future regression cases for assignment scope, original snapshot, exact retry,
retirement and historical access; the existing negative assigned-coach test
(`:367–368`) must be deliberately reconciled with A01 scope decisions.

No remaining access blocker for this audit. Product/architecture gates before
implementation are Q01–Q05 policy choices and explicit contract adoption, not
missing authorization for the read-only planning task. No production, full CI,
provider, physical-device or deployment acceptance claim is made.


## Publication note

This is the captured read-only audit appendix at the pinned application baseline. Its original temporary path is provenance, not a required checkout location. The main plan supersedes tentative implementation proposals in this appendix; baseline observations and executed-test statements remain unchanged. Root owns the versioned planning artifact; no feature implementation was performed.
