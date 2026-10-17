# WP10 integration requests

Implementation: `7c223969cfecff8549d20462e8770bf4c332517b`.
Base: `0b611064a91b87b3a17274cabca5415bcf1d7d55`.
Producer: WP05 `b5715612f989b66327a2f89d7df94813bbebf98a`, inspected and
tested separately, not merged into this branch.

These are concrete requests for the named owners. No shared wiring patch has
been applied by WP10, and no composed acceptance is claimed.

## INTEGRATION: routes and props

Import directly from owned modules; any shared export barrel is yours:

```tsx
import { HealthSettings } from './features/health/HealthSettings'
import { TrainerHealthView } from './features/health/TrainerHealthView'
import type { HealthAccess } from './features/health/healthAccess'
import { HEALTH_INVALIDATION_EVENT } from './features/health/healthLifecycle'
```

Compose the owner health/settings destination and a trainer's selected-member
health destination inside the existing B2B shell. Route paths/navigation labels
belong to INTEGRATION. Proposed destinations are `health` and the selected
member's `health` detail, following your final router conventions.

```tsx
// Populate from the current authenticated shell, never URL/body claims.
const context: HealthAccess = {
  accountId: currentAccess.userId,
  organizationId: currentAccess.organizationId,
  branchId: selectedAuthorizedBranch.id,
  hostBinding: currentVerifiedHostAndDomainGeneration,
  generation: currentSessionAccessAndConsentViewGeneration,
  access: currentAccess, // frozen ProductAccess DTO or null while unresolved
  signal: currentAuthorityAbortController.signal,
}

<HealthSettings
  context={context}
  organizationName={currentOrganizationName}
  branchName={selectedAuthorizedBranch.name}
  onExportOwnRecords={openExistingPersonalExportDestination}
/>

<TrainerHealthView
  context={context}
  memberId={selectedAuthorizedMember.userId}
  memberName={selectedAuthorizedMember.name}
  branchName={selectedAuthorizedBranch.name}
/>
```

Both components import their owned CSS directly. No new dependency, manifest,
tsconfig, client method or DTO is needed. `healthClient.ts` consumes the frozen
`createProductV2Client` and its existing abort/no-store transport.

`ProductAccess` must be the **current** v2 response for this identity and tenant.
Capabilities are hints, not authorization. Trainer presentation additionally
requires `role: coach`, a selected branch coach grant and read-consented-health;
admin/superadmin scope alone does not pass that gate. The backend remains the
authority for target identity/membership and category consent.

The host binding is an opaque current verified host/domain generation string;
do not infer one from stale persisted tenant/role claims. The view generation
must change on logout/login, account/host/tenant/branch/role/access revision,
consent invalidation and inactive/reactivation transitions. Replace the old
signal after abort; do not reuse an aborted signal. Components select a blank
store synchronously for changed context/target, before their effects run.

Owner export-only access calls no operational health API. Keep a reachable
WP11 personal-export destination on the correct brand host and connect the
provided export callback. The health page explains that inactive memberships'
brand grants are revoked, and reactivation requires new explicit consent.
Offer authorized branch selection for other active branch grants visible in
settings. If a prior branch is unavailable, resolve its grant lifecycle with
ACCESS rather than inventing a cross-branch request or hiding that grant.

## INTEGRATION/ACCESS: immediate invalidation

Abort the current authority signal before publishing changed access and
generation. This clears owner/trainer state and cancels requests. A late fetch
that ignores abort cannot mount under the old local epoch. For a consent-only
notification where the shell remains authorized, the exact local event is:

```ts
window.dispatchEvent(new Event(HEALTH_INVALIDATION_EVENT))
```

The event is conservative: all mounted trainer health views on that page clear.
WP10 also sends only the literal `invalidate` on same-origin BroadcastChannel
`klisteni-b2b-health-invalidation-v1` before/after consent mutations. No health,
identity, category, consent ID or token is sent or persisted. Session watcher
notifications also clear state. Immediate cross-device/server-side revocation
requires your current authority/consent notification path to dispatch the event
or abort/replace the context; a same-origin channel cannot supply that path.

While foreground/focused/online, trainer reads repeat every 15 seconds and
clear the previous projection **before** issuing the next request. Blur,
background, pagehide, disconnect and unmount clear immediately; reconnect and
focus read again. This is a fallback with browser-scheduling limits, not proof
of instantaneous remote revocation. Never introduce a persistent/query/offline
trainer cache while composing these modules.

## ACCESS/INTEGRATION and WP06: producer requests remain required

Apply the eight handlers, per-route body limit and `HEALTH_RESPONSE_HEADERS`
from [WP05/v1/integration-request.md](../../WP05/v1/integration-request.md).
Revalidate delayed disclosures at the producer's final guard, lock through
serialization, and test real HTTP success and error headers. This UI verifies
request no-store only; it cannot enforce server/intermediary headers.

Hook inactivity revocation in the same membership transaction and include
`ownerHealthExport` only in the authenticated personal export. Preserve the
correct host, export-only session and denied operational writes. Do not add
health to gym/staff/audit exports. Reactivation must not reconstruct consent.

WP05 previews are process-local hash tickets with a five-minute lifetime; use
the producer's single-process/request-affinity arrangement or seek a
CONTRACT-owned amendment. No UI retry can make an unaccepted ticket valid on
another process. An uncertain accepted import retry intentionally keeps the
exact operation/raw/revision so the durable receipt can resolve response loss.

## QA handoff

Apply [browser-scenarios.md](browser-scenarios.md) to the parent's composed head
with the existing QA-owned health spec/fixtures. The 38 new unit tests cover
state and mocked browser lifecycle; they do not replace browser/HTTP acceptance.
