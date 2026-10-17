# WP11 owner requests

Source `35b63a0536242515920aeae80fca8e58bdaab12e`; exact base
`fd138190e18ba84dcf47c1fc81ad535d051d8ff4` (WP06 PR24).
No shared lease is taken. Parent retains acceptance and merge decisions.

## INTEGRATION: gate every selected-organization route

Import `MembershipAccessBoundary` directly from
`apps/b2b-web/src/features/membership/RestrictedMembership.tsx`. Mount above the
entire route switch and workspace, including public, management, history, media,
deep-link, back and unknown-route fallback destinations whenever an authenticated
selected organization exists. A route-local inactive page cannot enforce this.

Supply the actual authenticated `{userId, organizationId}`, strictly decoded
current `ProductAccess | null`, `revalidating`, and the current account/organization
`contextSignal`. Invalidation must synchronously abort that signal and clear
access (or set `revalidating=true`) before rendering old gym children. Revalidate
on authentication/access-change events, focus/reconnect and server authorization
rejections, and clear feature requests/caches/outbox operational state. Existing
old `/me` must not be extended with incompatible v2 fields. WP06's identity-only
bootstrap and early deny-by-default HTTP allowlist are separate prerequisites.

Bind `client` with `createProductV2Client(actualAccountId, selectedOrganizationId,
{contextSignal, onAuthChange: invalidateAndRefreshCurrentAccess})`. Do not supply
another membership's active DTO or a stale client. `currentOrigin` is the current
browser origin. `refreshAccess` must fetch current access, update the owner's
provider, and then reload history from accepted server state. It must never
activate a membership locally, manufacture branch grants, or grant health consent.
The boundary remounts restricted state on owner/organization/access revision
changes. Passing a React child does not authorize prefetching its protected data:
keep operational hooks beneath the gate and abort already-mounted producers.

`null` access and invalid/foreign access hide gym children. Only an exact matching
active DTO delegates to existing active routing, where current branch/capability
checks still apply. Active with no retained grants must not gain a fallback branch.
The boundary is presentation enforcement; every HTTP request remains authorized
by ACCESS, including queued writes and receipt lookups.

## INTEGRATION/client: exact frozen self-route correction

The frozen client and read-only integration checkpoint
`4954accaf0e4a0c88f8179b949886b1fcece8fa7` and refreshed
`31eb421064c215463d2999777520164c52845ddc` omit `/self` for self endpoints.
`ProductEndpoints.personalExport.path` is `/exports`, while the frozen inventory
requires `/api/b2b/self/exports`. Apply this exact owner patch in
`packages/b2b-client/src/product-v2.ts` and retain its strict validation/header:

```diff
-        endpoint.scope === 'self' ? path : `/orgs/${encodeURIComponent(organizationId)}${path}`
+        endpoint.scope === 'self' ? `/self${path}` : `/orgs/${encodeURIComponent(organizationId)}${path}`
```

Add owner-client tests for both `personalExport` and `b2cInvitation`, exact
organizationId query encoding, header 2 and no-store behavior. Do not work around
this in the feature with raw fetch. WP06's service/login/self-route registration
requests remain required before real download acceptance.

## INTEGRATION/WP09: bind the published recovery export

Read WP09 PR26 head `3217cadb9148d0772b3bc68bd0abc0a64bb85140`, v2/v3 receipts.
No WP09 source/store is imported or edited here. The injectable callback consumes
its exact `Promise<string | null>` result and keeps the returned bytes unchanged:

```tsx
import { exportOwnerLocalWorkout } from '../features/training/storage/ownerRecoveryExport'

<MembershipAccessBoundary
  // ...the current identity/access/client/context props described above
  localExport={{
    exportOwnPending: ({ access, signal }) =>
      exportOwnerLocalWorkout(store, { scope, access, signal }, sessionId),
  }}
>
  {activeRoutes}
</MembershipAccessBoundary>
```

The integration owner binds the existing `store`, exact authenticated WP09
`WorkoutScope` and selected recovery `sessionId`. AccountId/actorId both match
the owner; origin is actual current browser origin. The branch may be a historical
owner branch for recovery, without operational grants. Do not enumerate guessed
storage keys or start a runner. No account/branch/local session selection controls
are added to the restricted gym UI. Omit the adapter when no known selected local
copy is available. The UI explicitly discloses that this is one selected copy,
not a complete inventory of sessions/devices. Null shows an empty state; identity,
capability, cancellation or storage failures show a retryable local error.

The helper checks WP09's published envelope identity/format/version and
`serverConfirmed:false`, never reads store fields or combines local bytes with
`serverAcceptedOnly:true` server downloads. An old adapter returning a different
envelope is explicitly rejected. Own unit/component tests use synthetic published
envelopes; actual WP09-store composition remains an owner/QA check.

## CONTRACT/INTEGRATION: optional shared promotion

`features/membership/trainingInterchange.ts` is a pure archive adapter using only
frozen v2 schemas (plus the local identity type). It preserves original JSON data,
all branches/revisions, legacy originals, ranges, units, target segments and
provenance. It rejects unknown versions/fields and mismatched scopes. It does not
claim a B2C store can import the new fields. `trainingInterchange.test.ts` contains
the round-trip fixture coverage.

If a public B2C import/archive entrypoint is needed, CONTRACT must select its pure
shared destination; suggested existing allowed boundary is `b2b-domain`.
INTEGRATION can move the unchanged functions, replace the type-only
`MembershipIdentity` import with `Pick<ProductAccess, 'userId' | 'organizationId'>`,
and register the chosen package subpath exactly once. No package/barrel/manifest
lease is held here, so no speculative shared export or B2C application import was
added. Full paid onboarding, conversion and data transfer remain outside scope.

## QA: exact composed scenarios

QA exclusively owns `b2b-product-inactive.spec.ts` and its fixtures/config requests.
Run 320x740, 430x932 touch and 1440x1000, Chromium and WebKit, unified and correct
white-label host, after bindings above. Do not count component mocks as HTTP auth:

1. **WP11-I01** Correct-host inactive login exposes export/invitation only. Foreign
   membership/copied cookie/domain-generation mismatch stays denied. No inactive
   DTO fields leak through strict legacy me. Test password-login cookie admission.
2. **WP11-I02** From an active workout/history/media screen, deactivate; invalidate
   provider and immediately hide gym UI. Exercise deep link, back, forward, reload,
   public/management/unknown destinations and stale active hooks. API denies gym
   GET/HEAD/Range/mutations despite other active memberships.
3. **WP11-I03** Download JSON from actual server: both historical branches,
   original immutable routine/legacy execution, every enrollment/occurrence/session
   revision, ranged prescriptions, kg/seconds, reviewed provenance and current own
   health. No foreign member/organization/staff-private/media bytes/receipts.
4. **WP11-I04** Before download inspect includes/omits disclosure. Delay/fail export,
   assert announced pending/error, disabled duplicate click and successful retry.
   Abort/logout/organization-change before response; no late file is published.
5. **WP11-I05** With actual WP09 selected owner recovery, queue offline work and
   deactivate. Writes/replay/receipt access stay blocked. Local export is a separate
   `klisteniapp.local-workout-recovery` v2 file, `serverConfirmed:false`; no accepted
   operation payloads or health. Null/quota/corruption/cancellation/foreign identity
   fail or show truthful empty state; no queue mutation/replay.
6. **WP11-I06** Configure/unconfigure the B2C invitation. Confirm separate/paid/user
   choice copy, no automatic conversion/billing/transfer, safe HTTPS destination
   with no credentials/query/fragment; no same-product deep-link destination.
   Rendering and B2B lookup cause no B2C request. A normal external click causes
   only user-selected navigation, no account/auth/payment/import API call or B2B
   cookie mutation; no referrer, opener or transfer token.
7. **WP11-I07** Reactivate through actual authorized API; refresh current access and
   retained history. Explicitly revoked branch grants and health consent remain
   revoked. Another tenant's active membership never unlocks this tenant.
8. **WP11-I08** Keyboard focus/labels, semantic heading/section/status/alert regions,
   touch targets, no horizontal overflow, local empty/error and server retry states.
   Inspect actual branded/global CSS and screenshots; isolated component layout is
   supporting evidence only. Trusted HTTPS/Secure-cookie and physical devices are
   separate gates.
