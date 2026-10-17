# Amendment 009: invitation metadata and recovery composition

CONTRACT/ACCESS and root integration own this additive composition. Producer
inputs are WP07 PR29 `59d195de`, WP09 PR26 `5a727d67`, WP01 PR30 `a4636288`, and
WP08 PR25 `f96db71d`. No database migration, historical snapshot, original
execution, canonical catalog or previous evidence is rewritten.

## Authorized invitation branch metadata

`invitationBranches` is GET
`/api/b2b/orgs/:organizationId/product/v2/invitation-branches`, with strict `{}`
input and a strict unique array of
`{organizationId, branchId, name, status: 'active' | 'archived'}`.

The ordinary product transaction requires current session/realm, selected branch,
active membership, contract header 2 and readiness. The handler additionally
requires effective admin/superadmin role and `manage-people`. It reads only the
selected organization's branch rows under shared locks. No identity, membership,
health, token or permission enumeration is added. The People editor uses this
guarded typed read, preserves archived metadata and permits only explicit inactive
grants on archived branches. Invitation creation and acceptance still revalidate
branch status; metadata is never authority. There is no active-only fallback or
Principal inference.

## Actual adoption and workout entry

The staff navigation opens WP07's actual history-subject/issued-assignment picker.
Its required post-adoption callback reloads the exact immutable version and saved
supplement. Original source, independent target-dose confirmations and the
shared-version acknowledgement retain amendment 007 semantics.

Root now binds every selected existing session through `sessionBinding`, passing
the explicit retained prescription and separate revision-zero evidence into WP09.
Conflict recovery reloads the matching binding. It never replaces an accepted
session with current global alternatives or a newly adopted supplement.

The member's legacy start action retains the actual assignment DTO and opens the
explicit resume/new chooser. The chooser commits one durable document ID. Root
checks its binding before entry: only an actual 404 for a genuinely unaccepted
new identity may use its verified immutable issued routine. Denials, incompatible
responses, known accepted identities and original execution IDs never fall back.
Existing operation bytes survive uncertain-send checks and retries.

Current authenticated bootstrap, access, native origin and realm derive the local
recovery owner. Every new document has that exact realm. The editor awaits durable
selection before sync; inactive branchless discovery can recover/export its own
selected work without operational reads. Pre-realm work requires an explicit
copy choice and retains its original bytes. An unaccepted original-only correction
can take that path; a new legacy execution still requires the assignment chooser.

Offline reopening requires a previously persisted authoritative binding and the
matching current active member context. It enables no fresh work or replay.
Explicit revalidation is required before an offline-restored form can send. The
ordinary live editor keeps a stable lifetime during transient stream loss; the
existing request guard suspends network work and fresh access checks precede sends.

## HTTP-compatible operation identities

WP09's deterministic SHA-256 now registers the already locked `@noble/hashes`
2.4.0 as a direct B2B-web dependency. Only that importer's manifest/lock entry
changes; package versions, resolution and integrity remain unchanged.

`createClientId` in the shared client generates UUIDv4 identities with native
`crypto.getRandomValues`, including on synthetic HTTP origins where
`crypto.randomUUID` is unavailable. Product planning, adoption, People, health,
week moves and same-tab/cross-tab session-change notification use it. Missing
native randomness throws; there is no clock/Math.random fallback. Authentication,
credential handling, TLS and browser security properties are unchanged.

## Remaining acceptance

Combined product browser journeys remain QA-owned, including real adoption,
revision-zero/manual correction, exact retry, scoped invitations and 320px history.
Owner component evidence does not establish full application acceptance.

A separate read-only reproduction found that normal workout Close can unmount
before its final queued local edit reaches IndexedDB. WP09 needs an awaitable
local flush that surfaces storage/CAS failure before root navigation. Context
revocation must still invalidate promptly. This is an open producer follow-up,
not a passing acceptance result. See the integration receipt for exact evidence.

No application main merge, production activation/migration or deployment occurs.
