# WP09 owner-local export amendment v2

Date: 2026-10-17. Parent requested the exact WP11 local export adapter after the
[v1 receipt](../v1/README.md). V1 bytes remain unchanged. Source head:
`0037e97d7524e2b8ae6bc7a4f11ed1cca12f6316`; base remains
`0b611064a91b87b3a17274cabca5415bcf1d7d55`. Parent-supplied WP06 readiness is PR24
`fd138190e18ba84dcf47c1fc81ad535d051d8ff4`; WP09 did not compose or activate it.
Frozen `ProductAccess` still applies. WP11 owns `features/membership/**` in thread
`01a14a50-75d6-74c5-904b-ff2a244fd0f6`; no WP11 file was changed.

## Exact WP11 interface

Import directly from the app-local module, without a package/barrel edit:

```ts
import { exportOwnerLocalWorkout } from '../training/storage/ownerRecoveryExport'

const json = await exportOwnerLocalWorkout(
  store,
  { scope, access: currentProductAccess, signal: currentAccountContextSignal },
  sessionId,
)
```

Signature:

```ts
exportOwnerLocalWorkout(
  store: WorkoutStore,
  context: { scope: WorkoutScope; access: ProductAccess; signal: AbortSignal },
  sessionId: string,
): Promise<string | null>
```

`scope` is `{ origin, accountId, organizationId, branchId, actorId }`. Use the actual
current browser origin and authenticated account/member. The adapter strictly
parses the frozen access DTO, requires `export-own-records`, matches owner and
organization, reads only the exact scoped key and checks the returned document's
identity. It accepts export-only access without requiring operational branch
grants. The current account context signal is mandatory; cancellation is checked
before and after the asynchronous local read. It performs no network calls,
auth/session mutation, queue mutation or replay.

Return `null` means no matching local recovery work. The JSON envelope has
`format: klisteniapp.local-workout-recovery`, `version: 2`, `serverConfirmed: false`,
owner/session/original linkage, accepted revision number, changed local content,
unaccepted immutable operations, superseded IDs, recovery copies, preserved legacy
draft and any local recovery problem. It omits accepted server content, health
and accepted operation payloads. The separate server export remains unchanged.
Download this file separately with an explicit local/unsynchronized label; never
append its bytes to a server-confirmed export or manifest. The browser store is
not cryptographic isolation from other people sharing the same browser profile.

## Validation and remaining gates

Same pinned WP03/WP04 validation composition as v1, Node 24.19.0/pnpm 12.7.0 and
unchanged dependencies. Actual reruns: **82 UI tests pass, 0 failures/skips**,
including restricted owner export, foreign identity/organization/capability
rejection, origin/branch isolation, unchanged local store, omission of accepted
server records and cancellation during read. Web typecheck, web lint and boundary
checks pass; see [results.json](results.json) and corresponding logs.

[Source hashes](source-files.json) cover the two additional files and byte-match
the validation worktree. V1's core source, API suites, native storage/component
smoke and both-consumer build evidence remain unchanged; they were not relabelled
as new WP06 or composed acceptance. No extra browser matrix is claimed.
Astra protocol review, integrator wiring, actual WP06 access binding/acceptance,
QA's composed matrix and parent's merge decision remain pending. Replay still
requires explicit `integrationAccepted`; default remains false.
