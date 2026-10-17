# Amendment 007: explicit legacy adoption and correction binding

CONTRACT/ACCESS owns this additive amendment. It reuses WP04's immutable
supplement storage and WP03's revision-zero correction handling. No schema,
lockfile, old snapshot, original execution, or migration006 bytes change.

## Frozen named endpoints

All paths below are relative to `/api/b2b/orgs/:organizationId/product/v2` and
retain current account, contract, branch and selected-role headers.

| Client operation          | Method and path                                  | Output                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `legacySupplementPreview` | GET `/legacy-assignments/:id/supplement-preview` | Exact issued assignment scope, raw source hash, original v1 snapshot, incomplete display draft, eligible proposals with full relation hashes, nullable saved supplement |
| `adoptLegacySupplement`   | POST `/legacy-assignments/:id/supplement`        | Immutable member-scoped `LegacySupplement` envelope                                                                                                                     |
| `sessionBinding`          | GET `/sessions/:id/binding`                      | Original legacy record or null, real accepted v2 revision or null, authoritative prescription binding                                                                   |

Adoption is staff `edit-planning`, with exact assignment-derived member and
routine/version linkage and current history authorization before receipt replay.
The create-only request contains `operationId`, `expectedRevision: 0`, assignment
`id`, raw `sourceSnapshotHash`, complete `sourceSteps`, literal
`sourceDosesConfirmed: true`, literal `sharedVersionConfirmed: true`, and
`targetConfirmations: {relationId, relationHash}[]`. No snapshot or target dose
comes from the client. Every source scalar, identity, order and known load must
remain exact. Unknown source load and laterality require explicit confirmation.
A legacy allowlist is neither reviewed permission nor an explicit block.

For every reviewed source step, confirm the complete currently eligible proposal
set, including each target's independent dose and conditions. A blocked source
step contributes no targets. The server reconstructs snapshots, checks current
catalog under locks, and calls existing WP04 validation. Changed proposals or
source hash conflict. An accepted exact operation replays after current actor
and member authorization; it does not require the catalog still to be selectable.
One supplement, one audit and one operation receipt commit atomically. The
supplement applies to the immutable version for all its assigned members, hence
the separate explicit shared-version confirmation.

## Correction semantics

`sessionBinding` is for the currently authorized owner of actuals. It returns
`accepted: null` for a revision-zero-only record. The client must not invent an
accepted v2 revision. First correction keeps the original execution ID as session
ID and `origin.executionId`, preserves assignment/program/version/schema1, and
requires a nonblank correction reason before initial autosync. Existing
`saveSession` performs the append, retaining original revision zero and raw rows.

The prescription union is either `{kind: 'reviewed', routine}` or
`{kind: 'legacy-compatibility', original, steps, relations: []}`. Compatibility
exposes the existing v1 interpretation and preserves unspecified load; it is not
a trainer-confirmed publication. If trusted immutable accepted source segments
conflict with a later supplement but exactly match that compatibility projection,
all corrections to that session retain compatibility. The submitted payload
cannot choose this mode. New sessions use the adopted prescription. Empty older
drafts without frozen source segments can also use the supplement. Reviewed
sessions keep full provenance/equipment validation. No retained segment is
rewritten or removed to enable a new alternative.

## Ready-to-dispatch UI prompts (parent owns dispatch)

**Legacy adoption UI owner, Sol6.1 high fast:** Add a small explicit staff review
flow using the three typed seams above; own only assigned planning/history UI
files, not CONTRACT/ACCESS/root. Start from an actual legacy assignment selected
for a member. Show original scalar doses and source hash identity; leave unknown
load/laterality unconfirmed until selected. Expose reviewed/blocked choice per
step, every eligible directed relation with its own target dose and requirements,
and explicit source-dose/shared-version confirmations. Submit exact displayed
relation hashes. On conflict refresh the preview and require renewed confirmation.
Never mutate old routines or relabel manual alternatives. After adoption refresh
version data. Validate mobile/desktop controls, incomplete confirmation blocking,
server errors, changed proposals and revoked access.

**WP09 correction owner, Sol6.1 high fast:** Bind edit/resume of every accepted
session through `sessionBinding`; do not load a newly adopted global supplement
in place of its retained prescription. For revision zero, retain `original`
separately, keep `accepted: null`, same original IDs/linkage, and gate autosync on
nonblank correction reason. Use the explicit prescription union; never cast
compatibility with unspecified load to `RoutineVersionV2`, invent laterality
confirmation, or fabricate reviewed provenance for old manual variants. Unsupported
old variants retain original evidence and require explicit correction entries.
Preserve raw browser drafts and original transport handling. Cover first correction,
reload/retry, conflict, old correction after adoption and no implicit completion.

Root must bind any optional callback required for those real navigation paths.
UI/browser acceptance is pending the owners' actual amendments and combined QA.
