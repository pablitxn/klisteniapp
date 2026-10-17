# WP08 integration and contract requests

These are requests to the existing owners, not a lease or an implemented route.
WP08 edits no DTO, migration, registration, provider, navigation, session controller,
draft/outbox, shared manifest, dependency implementation or browser-spec file.

## INTEGRATION: existing client and route composition

The following named entrypoints exist in the owned feature modules:

- `features/training/HistoryPage.tsx`: `ProductHistoryPage` (complete workspace).
- `features/training/AssignedRoutines.tsx`: `ProductAssignedRoutines` (pure continuity).
- `features/training/ExecutionHistory.tsx`: `ProductExecutionHistory` (pure actuals).
- `features/reports/ReportsPage.tsx`: `ProductReportsPage` (staff selector/workspace).

Use the complete workspace once in the member's My routine/history route, rather
than rendering duplicate continuity/original/session anchors on one page. Keep the
existing v1 route for compatible unactivated tenants. Export-only members must go
to WP11, including stale/deep links; this workspace is an operational history view.
No new account provider or session controller is required.

Concrete props for the existing frozen client factory:

```tsx
import { createProductV2Client } from '@klisteniapp/b2b-client'
import { ProductHistoryPage } from '../features/training/HistoryPage'

// These identifiers must come from the integrator's CURRENT authenticated context.
// actorId is the signed-in actor; targetMemberId is the history subject.
const createClient = (signal?: AbortSignal) =>
  createProductV2Client(actorId, organizationId, {
    branchId,
    role: productRole,
    signal,
    contextSignal,
  })

<ProductHistoryPage
  scope={{ organizationId, branchId, memberId: targetMemberId }}
  accessKey={currentAccessKey}
  createClient={createClient}
  canReschedule={activeSelfWithEditOwnSessions}
/>
```

The factory accepts the existing ProductV2Client, not an invented provider API.
`contextSignal` is the integrator's account/host/access lifetime; abort it on
logout, membership revocation, branch/role/domain changes and departure.
`currentAccessKey` must change for authenticated actor, host/domain generation,
organization, branch, product role, access revision and access mode changes. The
workspace remounts on this key plus subject scope, hides previous-owner data,
aborts reads and pending moves, and clears local view state. Do not derive authority
from the subject ID, prop or capability alone; every endpoint still authorizes.

For staff reports import `ProductReportsPage` from the named report entrypoint and
supply `members` from the current authorized `people` response, `organizationId`,
`branchId`, `accessKey`, and the same actor-bound `createClient`. Do not filter out
inactive people. It never enables member rescheduling and never requests health.
The list is contextual input, not a new cross-tenant people API. Retained historical
branch access and inactive-subject authorization remain server decisions.

There are no package/export/lockfile requests for this patch. Existing frozen
exports suffice; no producer code has been copied into this branch.

## CONTRACT: immutable historical readers missing from the frozen endpoint registry

1. `routine({id})` returns **RoutineDraftV2**, not an issued version. It cannot
   supply the original routine snapshot/name/source-step labels for a v2 historical
   session, nor safely implement `onOpenRoutine(ref)`. Please provide an approved
   immutable routine-version reader (tenant/branch scope and exact schemaVersion,
   programId, version) or name an already accepted equivalent. WP08 supplies the
   exact reference through `onOpenRoutine`; INTEGRATION must wire it only to an
   immutable reader. Until then leave the optional callback absent. In-page links
   already navigate both ways between retained original references and actuals;
   legacy detail uses its embedded original snapshot. New segments use their own
   frozen exercise ID/relation target name, dose and actual values, never a mutable
   current routine/catalog name.
2. `continuity` returns the latest Enrollment content and issued/current revision
   numbers; no endpoint reads earlier enrollment/stage snapshots. Please provide
   an approved scoped enrollment-revision reader if full historical period/objective
   content is required. The UI labels current periods as current and never presents
   their objective/dates as the original issued values. Missing earlier data is not
   reconstructed from the latest goal program.
3. `occurrences({memberId,weekStart,timeZone})` filters only by **current week** in
   WP03. There is no occurrence-by-ID/history reader. A session's origin holds only
   occurrenceId/routine. After a cross-week period move, querying the performed
   week cannot discover the moved occurrence's current date/eligibility/timezone.
   Please provide an approved scoped occurrence-by-ID reader, or authoritative
   inclusion metadata/lookup with sessions. The UI marks known cancelled/out-of-
   window work excluded and preserves all actuals; for an unloaded occurrence it
   says inclusion is pending consultation, never counts it as completed/missed or
   guesses an absence. Browsing the destination week resolves known moved records.
   Fully automatic exclusion/original-period presentation remains blocked on this
   approved reader, rather than a fabricated route or unbounded week scan.

These requests do not prescribe new DTO shapes or authorize WP08 to change them.
The original scope/timezone/revision predicates must survive any amendment.

## WP09 and WP11 seams

WP09 owns starting/editing sessions and all drafts/outboxes. Original routine/session
references exposed here can drive its accepted entrypoint once INTEGRATION supplies
it; this patch adds no session mutation or secondary controller. Session detail is
read-only and revisions come from `sessionRevisions({id})`.

WP11 owns product-v2 export. Do not reuse the unchanged legacy HistoryPage JSON
button for product-v2 export or add private health to staff reports. Compose WP11's
approved export component at the operational/restricted boundary as appropriate.

## QA and parent acceptance

See [browser-scenarios.md](browser-scenarios.md). QA owns new cross-feature specs
and fixtures; INTEGRATION owns testMatch/config registration. Parent supplies the
accepted composed head with production planning/records/auth wiring and the WP02
end-enrollment effectiveAt amendment. Run full UI/HTTP/browser acceptance there.
No partial-tree result in this receipt accepts those outstanding gates.
