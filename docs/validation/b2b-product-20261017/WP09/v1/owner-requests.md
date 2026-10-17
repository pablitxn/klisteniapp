# WP09 owner handoff

Feature source: `f123dfb717774b88eba78291af2386fde60dd28b`, frozen base
`0b611064a91b87b3a17274cabca5415bcf1d7d55`. Parent owns composition and merge.
No shared API, contract, manifest, route, history, calendar or health paths were edited.

## INTEGRATION: exports and member workspace

1. Apply the two domain exports in [domain-exports.patch](domain-exports.patch),
   combining the existing WP03/WP04 owner requests once. Supply WP03 sessions at
   `d12b56b92304764f988b051350b6211b7f1e38ba` and WP04 alternatives/domain/UI at
   `04b2e036e6d9b5d8987c6d228ab92bf1a48827d1`. WP09 copies none of their source
   into its branch. Ordinary frozen-base tests are intentionally blocked by these
   missing public exports; the isolated validation worktree adds them only there.
2. In `apps/b2b-web/src/app/MemberWorkspace.tsx`, select the v2 editor only after
   authenticated v2 capability/access discovery. Keep strict legacy `Session`
   behavior and pending v1 POST transport available; never send a v1 payload to v2.
   Existing session/history IDs win over any new identity. For a fresh prescribed
   occurrence, use `occurrenceWorkoutId(scope, occurrence.id)` to keep the same
   session ID across reloads/tabs/devices. Do not generate a fresh session ID on
   every render or reload. A new operation uses a new random UUID.
3. Exported entry points already exist inside WP09's leased files:
   `Session.tsx: ProductTrainingSession`, `SessionStep.tsx: ProductSessionStep`,
   `useTrainingSession.ts: useProductTrainingSession`, and the v2 draft helpers in
   `sessionDraft.ts`. No package barrel change is needed for these app-local paths.
4. Supply stable/memoized `initial`, `routine`, `store`, `transport` and environment
   props. `initial` is built with `createWorkoutDocument(scope, id, origin,
   issuedRoutineOrVerifiedSupplement, createId, timestamp, acceptedRevision)`.
   `scope` is `{ origin: location.origin, accountId, organizationId, branchId,
   actorId }`; account and actor must be the current authenticated member.
   `origin` retains exact server occurrence/legacy linkage and original routine
   schema/version. Never rebuild an accepted routine from current catalog rows.
5. Instantiate `IndexedDBWorkoutStore` once per mounted browser context. Supply
   current authorized active-machine IDs and member-confirmed generic equipment
   through WP04's `AlternativeEnvironment`. Supply `loadRemote()` from authorized
   `sessionRevisions({ id })`, selecting the latest strict v2 revision. Do not
   silently turn a legacy revision-zero projection into a v2 accepted revision;
   preserve its ID/linkage and require a correction reason for its first edit.
6. The transport must use the current selected host/account/branch/role and both
   the app context signal and the per-operation signal. Concrete adapter shape:

   ```ts
   const call = (signal: AbortSignal) => createProductV2Client(accountId, organizationId, {
     branchId,
     role: 'member',
     contextSignal: currentAccountContextSignal,
     signal,
     onAuthChange: refreshCurrentAccess,
   })
   const transport: WorkoutTransport = {
     access: signal => call(signal).call('access', {}),
     save: (payload, signal) => call(signal).call('saveSession', payload),
   }
   ```

   Current-catalog withdrawal is `409 INVALID_INPUT` with an `unavailable` issue;
   it preserves local work and is never a reason to log out. Real 401/403 refresh
   must lead to the appropriate current restricted state, without clearing outbox
   data. The API still authorizes every mutation and exact receipt replay.
7. `integrationAccepted` defaults false in both hook and replay engine. Keep it
   false until parent accepts composed WP06 authorization. Inject actual frozen
   `ProductAccess`; do not fabricate an active capability to unlock replay.
   Current access is refreshed before each request; changed revision blocks until
   the owner explicitly reviews/resumes. Account/host/branch departure cancels the
   runner; same-scope access/capability changes also cancel outstanding work.
8. For localStorage adoption, call `preserveLegacyWorkout` first. It archives exact
   readable or unreadable bytes without deleting/replacing the old key. Pending
   legacy POSTs require their exact original legacy replay. `migrateLegacyWorkoutDraft`
   adopts readable unsent original-exercise actuals only with the same draft ID,
   assignment and schema-1 origin plus a verified issued supplement; it retains the
   whole source draft (including unfinished rows) in `legacyDraft` for owner recovery.
   Manual legacy variants cannot acquire invented reviewed evidence: retain the old
   editor/export and explain the explicit review requirement. For accepted legacy
   logs, preserve `executionId` as the session ID and require a first correction reason.
9. Keep this editor inside the existing account/session controller and workspace.
   WP09 has no new app/session provider, route, service worker or health cache.

## ACCESS / CONTRACT

No API change is requested by WP09. Keep the supplied `ProductAccess`,
`SaveSession`, `SessionReceipt` and `OutboxEntry` contracts. WP03's exact hash
input includes organization, branch, actor, `session.save` and normalized input;
WP09 reproduces it with WebCrypto and the pinned canonical JSON function.

Astra's protocol review should inspect `workoutSync.ts`, `workoutStore.ts` and
`useProductTrainingSession.ts`, including immutable payloads/receipts, successor
revision binding, explicit conflict choices, quota/CAS recovery and cancellation.
Review is pending; WP09 does not claim approval or composed activation.

The root typecheck requires WP02's accepted `planning/schedule-change.ts` through
WP03's planning bridge. WP09 received no WP02 SHA and did not invent one. Its
web/unified typechecks pass independently on the declared composition.

## WP11 owner-local export

`ownerWorkoutExport(document, signedInOwner)` produces the separately labelled
`klisteniapp.local-workout-recovery`, version 2, `serverConfirmed: false` envelope.
It includes pending/conflicting operations, preserved source drafts and recovery
copies, never health data or another member's records. Restricted rendering shows
only local recovery/export controls. Server export remains the authoritative
accepted-history source and must not merge local bytes into its confirmed manifest.

## QA

Implement the browser IDs in [browser-scenarios.md](browser-scenarios.md) on the
accepted composed head. WP09 did not edit QA's browser specifications/fixtures.
