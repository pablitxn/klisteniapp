# WP03 v2 owner requests

This amendment follows the parent dependency notice. It supersedes v1's abstract WP02 seam proposal; v1 remains immutable. Source `c569d109572c09ec5e587c5f66548672ba38f8d8`; WP02 `3b045cbe431d1995d75f9e88eeac1d79a08607bb`; WP04 `04b2e036e6d9b5d8987c6d228ab92bf1a48827d1`. No owner file was edited. Proposed patches were apply-checked only.

## Production wiring now available

```ts
import { createPlanningSchedule } from './schedule/planning.ts';
import { createRecordsServices } from './schedule/index.ts';
import { createPlanningServices } from './planning/index.ts';
import { createPlanningResources } from './planning/resources.ts';
const planning = createPlanningServices({
  ...createPlanningResources(resolvePublicationRelations), // WP04/WP02 owner seam
  schedule: createPlanningSchedule(),
});
const records = createRecordsServices();
// Compose ...planning and ...records once through ACCESS/INTEGRATION.
```

`createPlanningSchedule()` is the production PlanningSchedule adapter. Its `plan` consumes the exact ScheduleChange/PlanningSessionHead seam, performs no I/O or clock reads, includes every linked session and accepted override, and identifies changes to actual eligibility. It creates no persisted identity; apply allocates new IDs under the parent's lock. `apply` verifies impacts and current occurrence snapshots, uses the existing transaction and already inserted enrollment/stage revision rows, appends occurrence revisions and never writes actuals.

RECORDS now matches WP02's lock namespace/order: actor operation `[org,actor,'operation',operationId]`, then enrollment `[org,branch,'enrollment',id]`, parent row, child head. Authorization still precedes replay. No synthetic schedule is registered by this feature.

## WP02 internal effective timestamp: required amendment

Apply `wp02-effective-time.patch` to the pinned WP02 source. It adds `effectiveAt: string` to internal ScheduleChange and supplies `new Date(this.now()).toISOString()` in both change construction sites. This is internal callback metadata, not a transport DTO or migration change. The adapter already consumes it.

Reason: end currently supplies unchanged stage dates and the enrollment's original createdAt. A deterministic side-effect-free plan cannot determine which dates are future from that input. Reading wall clock inside plan or cancelling all historical obligations would violate the contract. Missing end metadata fails closed before writes. A real database test proves rollback; another passes explicit metadata through the production adapter and verifies past obligations stay required and only future dates cancel. The pinned WP02 end endpoint itself remains blocked until its owner supplies the timestamp.

Apply `wp02-production-fixture.patch` after composition to switch the WP02 fixture default to this production adapter and correct the slot-replacement assertion. The old synthetic callback cancels old IDs without generating replacement-slot occurrences. The production adapter correctly creates new obligations while retaining the old cancelled rows. The original assertion at period-history.test.ts:400 incorrectly expects every row, including newly prescribed ones, to be cancelled. It must check old impact IDs separately and assert the new slot remains required. Without changing assertions, the production-injected WP02 suite is 18 passed / 1 failed / 0 skipped. That is retained as a blocked owner expectation, not counted green.

Our pinned missing-end-time regression in production-schedule.test.ts documents the old seam. When the owner accepts effectiveAt, update that regression to explicitly omit metadata at the adapter boundary instead of expecting the repaired endpoint to fail. Feature ownership of that test remains WP03.

## WP04 and current catalog acceptance

The records writer now calls `checkEffectiveSegments` and `checkNewSegmentSelections` against the issued RoutineVersionV2/supplement. It uses WP04's `targetEquipmentAvailable` for restoration/new selection checks and `contentHash(rawStoredSnapshot)` for legacy supplement matching. Alternating and per-side coverage, range maxima, bodyweight-null external load and independent external actual loads follow the pinned helpers. Incomplete unselected drafts get validation-only source projections; no generated segment/selection is persisted or marked complete.

Newly introduced alternative segments and changed selections restoring an alternative recheck BOTH source and target current publication and organization/branch visibility. Disabled overrides, unpublished rows, foreign tenants and unshared foreign branches deny acceptance. Branch scope is checked independently; an enabled override cannot manufacture canonical review for a local/edited/foreign target. Existing accepted, unchanged selections/segments remain editable/readable after later disablement; restoring a disabled alternative as a new selection is denied without erasing retained history.

The check runs in the same authorized transaction before revision/receipt acceptance. SHARE on b2b_branch_catalog covers concurrent override insertion as well as updates/deletes; source/target exercise rows and active equipment rows are held FOR SHARE. Catalog inserts/updates are briefly serialized across branches by that table lock; review transaction length/performance during integration. It avoids a phantom disabled-row gap without requiring changes to another owner's writer. Exact PostgreSQL tests verify disable insertion and source unpublication winning first deny with no receipt/revision, and acceptance winning first delays the disable until commit while retaining history afterward.

The parent-supplied WP04 v2 API helper `assertNewReviewedCatalogEligibility(context, content, previous)` is now called after frozen identity/equipment validation and before acceptance. It rejects edited/local/unproven or wrong-revision targets as `409 REVIEWED_TARGET_UNAVAILABLE`; RECORDS keeps its source-and-target scope locks and override phantom protection around that call. Tests use actual unchanged canonical target rows, not a fake target relabelled canonical. Raw legacy hashes use the producer's accepted `contentHash(rawStoredSnapshot)`.

CONTRACT should add `REVIEWED_TARGET_UNAVAILABLE` to ProductErrorSchema's code enum; `contract-selection-error.patch` is the exact proposal. Existing transport preserves the error code string, but the frozen enum currently omits the new producer code. No contract file was edited.

INTEGRATION applies our v1 sessions/schedule export patch and WP04's alternatives export patch together. No new dependencies, manifests or lockfiles were edited by WP03. The parent explicitly accepted WP04 amendment 04b2e036e6d9b5d8987c6d228ab92bf1a48827d1; it supersedes the earlier WP04 pin. No moving head was substituted.

## Acceptance still awaiting the owning combined head

New v2 route/session/host/entitlement/current-grant composition is WP01/INTEGRATION's responsibility; fixture authorization is not a production implementation. Final end endpoint acceptance awaits the internal timestamp amendment. Re-run both WP02 suites with the production adapter and corrected assertion, plus ordinary API/static checks without export hooks. Astra contract-sensitive review, new browser scenarios/full build and UI/mobile/HTTPS/physical acceptance remain unexecuted. Parent owns dispatch and main merge; no new task was launched and no deployment/activation/main merge occurred.
