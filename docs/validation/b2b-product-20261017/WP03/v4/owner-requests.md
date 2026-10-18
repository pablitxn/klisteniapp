# WP03 v4 final producer handoff

Source `9199f3f04aeaf2f5007a82ffe1439b182b3aa863` uses accepted WP02 `b861e29b41ba15c2d38fc52eeda513507dacc4da` and WP04 `04b2e036e6d9b5d8987c6d228ab92bf1a48827d1`. The disposable full-validation composition also includes the WP02 receipt's exact accepted WP01 pin `af1fef78f912d746f79a00c52c261f03b58b4fe9`. No moving branch was substituted. Earlier WP03 v1-v3 receipts remain byte-preserved.

## Closed owner dependencies

WP02 now supplies immutable effectiveAt and defaults its test fixture to the actual createPlanningSchedule callback. Its period timestamp is anchored to the preview bucket so elapsed milliseconds do not invalidate a live preview, while end captures one precise operation instant. The earlier WP03 effective-time and production-fixture proposals are superseded by the accepted WP02 implementation and are no longer pending.

The old WP03 negative endpoint expectation is replaced by a real positive handler test. At 2026-10-08T01:00Z (October 7 in New York), past/today obligations remain required and the October 8/future obligations cancel. Accepted actuals, issued IDs/routine/stage/slot/date/week links, old occurrence snapshots and published routine bytes remain unchanged. Its current week still derives the past completion once. A later exact replay returns the original response with one operation receipt, one end audit and no new occurrence revision or recalculated cancellation. A separate direct adapter negative test deliberately omits effectiveAt and still rejects it. The existing explicit-time pure plan/apply test retains deterministic clone equality.

## Existing production registration request

```ts
import { createPlanningSchedule } from './schedule/planning.ts';
import { createRecordsServices } from './schedule/index.ts';
import { createPlanningServices } from './planning/index.ts';
import { createPlanningResources } from './planning/resources.ts';
import { freezeReviewedRelations } from './catalog/reviewed-projection.ts';
const planning = createPlanningServices({
  ...createPlanningResources(async (_context, routine, available) =>
    freezeReviewedRelations(routine, available)),
  schedule: createPlanningSchedule(),
});
const records = createRecordsServices();
// ACCESS/INTEGRATION composes ...planning and ...records into its registry.
```

INTEGRATION owns public domain sessions/schedule/alternatives exports and final shared service/route registration. The validation-only wp03-production-exports.mjs resolves just those paths to actual source, with no load hooks or rewriting. Current authorized transaction/session/host/tenant/branch context still comes from WP01. No synthetic authorization context is production code.

WP04 current canonical eligibility and raw stored-snapshot hashing remain wired. The parent-requested withdrawn target mapping stays 409 INVALID_INPUT with an unavailable ProductIssue at content.selectedSegments, parsed by the frozen contract and real client. No wire enum was added; do not apply the historical v2 enum proposal. Previously accepted unchanged segments/history and exact accepted replay remain preserved after later catalog withdrawal.

## Shared test and remaining owner gates

WP03 did not edit shared white-label-training.test.ts or its North-assignment assertion in either the feature tree or disposable composition; its SHA-256 is recorded in composition.json. The exact North assignment expectation belongs to INTEGRATION. Its authorized-branch identity semantics were reviewed earlier; no blanket assertion removal/weakening was applied.

Final ordinary export resolution, registry/new HTTP acceptance, Astra review, the shared owner expectation, full composed build and QA browser/mobile/HTTPS/device acceptance remain with their existing owners. No new Cloud dispatch, main merge, activation, deployment, provider/paid call, credential change or history rewrite occurred. This feature branch still contains only owned source/tests/evidence, based on the frozen base.
