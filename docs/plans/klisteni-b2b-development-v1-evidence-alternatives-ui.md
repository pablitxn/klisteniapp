# Klisteni d07 alternatives and shared frontend planning audit

Publication context: this captures a read-only baseline audit. The main plan C01-C08 and work-package ownership supersede tentative recommendations below; they do not change the recorded baseline observations or test results.


Read-only audit on 2026-10-17. No feature edits, branches, commits, PRs, dispatch, runtime changes, or browser runs.

## Identity, authority and scope

- App: `/workspace/klisteniapp`, clean `docs/b2b-development-plan-v1`, HEAD `d65261d18de4522fb9a66104aabb5750104fb8b8`.
- Atlas: `/workspace/sysadmin-workspace`, clean `work`, HEAD `ce45d206a2ed4035f8003a3303abd1fff98e09b8`.
- Read both repositories' AGENTS.md, Atlas atlas/AGENTS.md, `.agents/skills/atlas-navigate/SKILL.md`, `atlas/policies/source-of-truth.md`, relevant topic/repository/relation/roadmap records, and the authoritative October 17 entry and source.
- Product authority: `atlas/entries/2026-10-17-klisteni-b2b-product-definition.md` d07 and `atlas/sources/src-20261017-klisteni-b2b-product-definition.md` item 7; owner roadmap `KLI-B2B-20261017-A06` in `atlas/roadmap.md:36`. A06 depends on A02/A03, Q02 prescription requirements and Q03 snapshot/revision rules. These are confirmed product choices, not delivery evidence.
- Confirmed behavior: offer reviewed alternatives during workouts unless the trainer blocks this exercise in this routine; briefly explain a block; no per-change approval; retain routine identity/objective; honor direction, conditions, target requirements/dose. No equivalent-load/effect inference.
- Code is implementation evidence; executed tests below are local validation only. No fresh CI, deployment or physical-device acceptance is claimed.

## Verified catalog baseline

Executed from app root using Node v24.19.0:

```sh
node --input-type=module -e "import {exercises} from './packages/catalog-base/src/index.ts'; import {validateExercisePlanningCatalog} from './packages/scene-schema/src/index.ts'; const links=exercises.flatMap(e=>e.planning.relations.map(r=>({source:e.id,...r}))); console.log(JSON.stringify({exercises:exercises.length,directedRelations:links.length,types:Object.fromEntries(['alternative','progression','regression'].map(t=>[t,links.filter(r=>r.type===t).length])),empty:exercises.filter(e=>!e.planning.relations.length).map(e=>e.id),everyRelationRequiresTarget:links.every(r=>['target-requirements-confirmed','use-target-dose'].every(c=>r.conditions.includes(c))),issues:validateExercisePlanningCatalog(exercises)},null,2));"
```

Result: **37 exercises, 42 directed relations: 8 alternatives, 17 progressions, 17 regressions.** All 42 contain target-requirements-confirmed and use-target-dose; catalog validator returned `[]`.

Nine empty relation lists: pike-pushup, reverse-lunge, lateral-lunge, mountain-climber, crunch, split-squat, forward-lunge, prone-hip-extension, plank-shoulder-tap. Empty means no reviewed relation, not prohibition of every conceivable alternative.

Sources:

- `packages/catalog-base/src/exercises.ts` actual catalog; `src/exercise-planning.ts:209` relation factory, `:220` explicit additional relations, `:285` final parsed merge. Catalog schema requires all planning data.
- `packages/scene-schema/src/exercise-planning.ts:81` relation shape; `:94` required target conditions; `:97` progression/regression demand; `:131` catalog-wide validation; `:159` supports/balance/laterality conditions.
- `docs/exercise-planning.md:31` explains reviewed direction/no transitivity or reciprocity/no effect equivalence; conditions are declared, not user confirmations or changes applied in the baseline.
- `apps/b2c-web/src/components/ExercisePlanningDetails.tsx:13` displays position, supports, balance, laterality, requirements, rationale and conditions; `:46` relation button calls onExplore(target.id). `apps/b2c-web/src/App.tsx:537` supplies card-selection callback. This opens the destination card; it is not workout substitution.
- `apps/b2c-web/e2e/exercise-planning.spec.ts:7` checks destination exploration without routine editing; `:25` checks 320px layout; `:34` tests unilateral dose and reviewed regression.

## Implemented, partial and missing for d07

| Area | Status at pinned HEAD | Exact evidence / implication |
| --- | --- | --- |
| Reviewed directed catalog and validation | Implemented | Verified code counts above. Preserve this source; do not curate a duplicate catalog or infer new links from muscles/family/animation. |
| B2B import of reviewed relationship metadata/dose | Missing | `apps/b2b-api/src/catalog/seed.ts:6-29` copies name/description/instructions/equipment/muscles/pattern/animation/assets into B2B. `packages/b2b-contracts/src/catalog.ts:77` strict ExerciseInputSchema has no planning/relations, reviewed requirements, laterality, level, or base dose fields. B2B source lineage/animation identifiers do not establish relation equivalence for local adaptations. |
| Routine-specific alternatives | Partial, different rule | `packages/b2b-contracts/src/training.ts:5-19` ProgramStep has alternatives ID[] default []; `apps/b2b-web/src/features/programs/programDraft.ts:76` new step starts empty. `ProgramStepEditor.tsx:160-180` trainer manually checks any other published exercise, up to 10. No reviewed-relation filter or relation conditions. `b2b-domain/src/training.ts:17` only checks duplicate/self alternatives. |
| Offer reviewed options by default | Missing | `SessionStep.tsx:158` renders selector only when step.alternatives.length > 0, using snapshot IDs. A reviewed relation in catalog-base is never automatically an option. Empty trainer list means no selector, despite reviewed relations. |
| Explicit per-exercise-in-routine block + brief notice | Missing | No block field in strict ProgramStepSchema. No separate blocked versus no-reviewed-relations state. SessionStep silently omits selector for empty list; existing unavailable-equipment notice is a different state. Empty allowlist is an implicit denial but does not implement requested explicit block/default semantics. |
| User choice without per-change approval | Implemented for current allowlist | Per-set selector at `SessionStep.tsx:163-180`; no approval request/workflow. User must give nonblank reason in current implementation (`:183`, domain `training.ts:66`). d07 does not itself decide to remove this existing reason contract. |
| Conditional target requirements and target dose | Missing in execution | B2B card `ExerciseDetails.tsx:17` has instructions/animation/media/voice but no reviewed planning data. `sessionDraft.ts:193` changes exercise ID and clears load/RPE/done/reason; preserves original reps/duration. Unit test explicitly asserts retaining prescription reps. `SessionStep.tsx:78` and domain `training.ts:55` choose repetitions/time from source step; target card dose is unavailable. Current load-clearing warning is useful but not target-dose compliance. |
| Save actual variant and original prescription linkage | Implemented foundation | ExecutionSet (`b2b-contracts/src/training.ts:127`) records stepId/set/exerciseId/reps/duration/RPE/load/reason. Execution (`:161`) retains assignmentId and ProgramVersion. Publish (`b2b-api/src/training/index.ts:108-130`) snapshots steps/exercises/machines; execution history query (`repository.ts:169-207`) joins original assignment to immutable version. Same routine remains assigned when a per-set variant changes. |
| History shows prescribed versus actual | Implemented foundation | `ExecutionHistory.tsx:4-75` displays dated partial/completed session, program name/version, performed exercise name, original prescribed dose, actual dose and change reason. No substitution-count routine history introduced. |
| d03/d07 routine objective and bidirectional routine/session navigation | Partial/missing | Existing program name/description and stable programId/version/assignment linkage exist. ExecutionHistory renders text/table, no routine link; AssignedRoutines renders assigned routine/start but no linked actual-session list. Dedicated goal/stage/period contracts do not exist in the inspected Program schemas. A02/A03 owners should define identity/goal/history navigation; A06 must consume them. |
| Independent survival of future period edits | Not established by this slice | Immutable versions already protect prescription content and actual variants against later live catalog/program changes. Current contracts have no new program stages/periods. Tests of future period moves and snapshot/revision behavior belong A03; do not mark all snapshots missing or infer new date semantics from existing versioning. |

## Shared frontend architecture and ownership

One B2B application already serves unified and white-label modes:

1. `apps/b2b-web/src/main.tsx:7` creates the sole React root under ApplicationProvider.
2. `app/ApplicationProvider.tsx:15-23` owns location, brand context and one session controller; protected navigation does not create another session.
3. `App.tsx:106` conditionally wraps the same route tree in BrandThemeProvider.
4. `app/Workspace.tsx:149` computes user/organization/role or WL workContextKey; `:269` and `:334` mount the same ManagementWorkspace and MemberWorkspace; `:348` supplies shared AccountProvider.
5. `MemberWorkspace.tsx:1-15` composes AssignedRoutines, Session, ExecutionHistory, MovementCatalog for both modes. The whiteLabel flag adjusts capabilities/context, not a duplicated training screen.
6. `packages/b2b-react/src/account.tsx:6` scopes client by user/branch/role/context and aborts departed requests; `use-load`, `use-session`, `use-brand-context` own resource/session lifecycle.
7. `packages/b2b-client/src/client.ts` owns typed HTTP/input/response validation; transport owns same-origin requests/cancellation. No UI or React belongs here.
8. `packages/b2b-ui/src/index.tsx` exports presentational controls/login/themes/prescription labels. `content` entry exports optional viewers/media, separated to avoid eager viewer loading. Domain screens belong in app features, not shared session hooks/UI package.
9. `scripts/b2b-gateway.mjs:83` serves the same apps/b2b-web/dist; WL domain context changes access/theme, not build ownership. B2C is a separate app/API/identity store, not the B2B consumer screen owner.

Owner docs: `docs/architecture.md:17-28`, `docs/b2b.md:14-23` and responsibility table `:52-69`, `docs/b2b-white-label.md:231-238`. They specify app-owned navigation/domain features; shared contracts/domain/client/react/UI layers; no B2C app imports. Current boundary checker `scripts/check-b2b-boundaries.mjs:11-41` permits catalog-base only to B2B API, not domain/web/UI/client/react. Therefore do not import catalog-base/B2C planning UI directly into the B2B frontend to shortcut missing contracts. An API-projected immutable reviewed metadata contract fits existing ownership; any new shared planning-contract extraction requires an explicit coordinated dependency/boundary decision. Do not create new unified/WL screens or another session/client controller.

No named implementer is supplied by Atlas. The following are proposed ownership scopes, not assignments or dispatched work.

## Candidate narrow work/test packages under existing A06

| Candidate package | Sole writer scope and dependency | Acceptance/tests |
| --- | --- | --- |
| A06 contract/spec delta | Shared-contract writer: owner repo spec/ADR + b2b-contracts catalog/training response/request schemas. Coordinate with A02/A03 first on per-routine-step identity, goal linkage, target dose/requirements and immutable relation evidence. Resolve how existing arbitrary trainer allowlists and local adaptations are represented; never confer reviewed equivalence through baseExerciseId/animationId. Own compatibility/migration policy. | Schema tests for default allow versus explicit routine step block, declared directed conditions, target dose/units/laterality, older immutable snapshots and legacy drafts. Do not silently reinterpret old allowlists or overwrite historical snapshots. |
| A06 API/catalog projection | API catalog/training writer: project canonical reviewed metadata into authorized B2B catalog/snapshots and preserve destination source/version/review provenance. Reuse live inventory checks and immutable assignment/version persistence. Depends on contract delta. | API/unit/DB cases for reviewed/empty/blocked links, only actual direction, no inferred transitivity, unavailable targets, changed local adaptations, later catalog edits, original routine/variant history and retry idempotence. Preserve tenant/branch authorization. |
| A06 pure substitution rules | b2b-domain writer after shared contract freeze: eligible relation/conditions and actual target-dose validation independent of React/HTTP/DB. Coordinate API and draft consumer; never invent clinical suitability or load conversion. | Table-driven cases for progression/regression demand, support/balance/laterality/emphasis, own target reps/time/sets/rest, blocking, missing evidence and actual variant linkage. Extend existing training tests instead of a parallel rules engine. |
| A06 trainer editor | `apps/b2b-web/src/features/programs/*` writer: replace/extend allowlist UI with explicit per-exercise-in-routine blocking and reviewed destination summaries through the existing common editor. Depends A02 routine editor and API contract. | Editor model recovery/reorder/copy/version tests; block only that step/routine; draft/account/branch isolation; concurrency/rejected save preserve edits; trainer browser T02/T03/T04/T18 extensions. |
| A06 member workflow + history presentation | `features/training/*` writer: conditional options/blocked notice, requirements/demand explanation, selected target dose, actual recording/history. Coordinate one writer for sessionDraft/useTrainingSession with A05 and one for history with A03. Reuse MemberWorkspace for unified/WL. | Draft substitution clears incompatible values, adopts target dose/count mode per agreed contract, reload/pending replay unchanged, blocked notice accessible, empty reviewed list honest, no routine identity loss, partial/completed semantics preserved; extend member QA. A03 owns goal/period/bidirectional navigation semantics. |
| Cross-app regression/QA integration | One integration writer for shared manifests/Playwright configs/boundary rules. Shared catalog/schema/model changes require B2C regression; new B2B behavior tested in common app across unified/WL context. | Existing catalog/planning tests + B2C exercise-planning browser tests; B2B contract/domain/client/react/app/API tests; unified flow + WL two brands/four branches; source/target conditions, old snapshots and exports; report exact local/HTTPS/physical limits. |

Shared-file coordination: b2b-contracts/training.ts (A02/A03/A05/A06), catalog.ts (catalog/A06), b2b-domain/training.ts (A02/A05/A06), training API/repository (A03/A05/A06), sessionDraft/useTrainingSession (A05/A06), ExecutionHistory (A03/A06), package manifests/check-b2b-boundaries/fixtures/configs (single integration writer). Freeze contracts before independent dependent branches; avoid assigning the same files concurrently.

## Tests executed and existing browser patterns

Executed successfully (44 tests, 0 failures):

```sh
node --test packages/catalog-base/tests/catalog.test.ts packages/scene-schema/tests/exercise-planning.test.ts packages/b2b-domain/tests/training.test.ts apps/b2b-web/tests/sessionDraft.test.ts apps/b2b-api/tests/training.test.ts
node scripts/check-b2b-boundaries.mjs
```

Boundary result: B2B package boundaries, public exports and dependency graphs valid.

Existing tests are valuable regression foundations but assert the existing allowlist/source-dose behavior; passing them does not satisfy new d07.

- Node test/assert pattern across packages and apps. Planning tests reject skipped target/demand conditions, inconsistent support/balance/laterality and dose per-side errors. Domain/API tests validate per-set authorization/reason/completion/equipment without mutating snapshots. Draft tests cover malformed recovery, account/org/assignment/branch keys, lost response/pending retry identity, partials, duration/RPE, current inventory, old drafts and confirmation clearing.
- `apps/b2b-api/tests/integration.test.ts:486` DB integration describes immutable histories and idempotent replay; later content changes/disappearing alternatives covered in existing integration/browser tests. Not executed in this audit.
- `apps/b2c-web/e2e/member-qa.spec.ts:418` actual substitution/draft/reload/history, `:546` lost response, `:581` offline editing, `:273` branch history/export.
- `apps/b2c-web/e2e/b2b-trainer.spec.ts:200` T02 full reps/time/RPE/alternatives/version/snapshot/follow-up, plus concurrency, withdrawn content, revoked access, two-brand/four-branch tests.
- `apps/b2c-web/e2e/white-label-workflow.spec.ts:201` branch draft isolation, `:234` trainer/member/follow-up across four branches. Tests reside under b2c-web for harness/tooling; they build and drive b2b-web, not a duplicated B2C-owned B2B screen.
- `playwright.member-qa.config.ts` runs Chromium and WebKit at 320x740, 430x932 touch/mobile and 1440x1000 desktop with valid HTTPS required (`ignoreHTTPSErrors:false`, no certificate bypass args in member projects). `playwright.trainer.config.ts` has Chromium 360/430/1440 and WebKit 390 widths; separate optional isolated HTTP harness cannot attest HTTPS trust. `playwright.white-label.config.ts` has desktop Chromium, Pixel 7, iPhone 13; historical Chromium harness config has SPKI fixture behavior, so preserve trust distinctions. No trust settings changed or browser suite started here.
- B2C exercise planning browser tests include 320px overflow, source card unchanged while exploring destination and unilateral own-dose copy. For A06 extend keyboard/screen reader labels, notice semantics, touch targets, 320px selector/conditions/target dose layout, reduced motion and optional viewer fallback; do not make 3D availability a prerequisite to substitution.

## Remaining decisions and limits

- Q02: applicable target dose, fixed/range values/units and required-field matrix; do not assume every exercise uses the same fields.
- Q03: exact snapshot/revision semantics for selected target dose/condition confirmations, later program edits, deleted/reused routines and period moves. Existing immutable program versions are reusable groundwork.
- Define migration of historical/manual allowlists and local adapted exercises without implying reviewed equivalence. This is contract design, not an invitation to reopen d07.
- A05 coordinates autosave/retry/multi-device edits and owns shared draft mechanics; A01/Q01 coordinates current gym/brand/branch authorization, including broad trainer access decisions. Preserve isolation while implementing them.
- Existing CI/Yoga/preview/archive/provider/backup/release/device gates retain owners; this read-only slice does not resolve them.
- No runtime, remote state, browser suite, DB integration suite, CI or physical mobile test was run. Both repository worktrees remained clean after this audit; only this optional report was written outside repositories.


## Publication note

This is the captured read-only audit appendix at the pinned application baseline. Its original temporary path is provenance, not a required checkout location. The main plan supersedes tentative implementation proposals in this appendix; baseline observations and executed-test statements remain unchanged. Root owns the versioned planning artifact; no feature implementation was performed.
