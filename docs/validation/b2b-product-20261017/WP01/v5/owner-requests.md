# Explicit invitation grant UI owner handoff

UI dependency: `2d0df2797d7876070372bc7808d582604ca3bbf0` (PR21, implementation source `b9ae8d8dcd61ad62ee9285ad86ee0c829c224679`). Follow amendment008. No ACCESS/root/contracts/schema edits are included.

## Current composition

No root patch is needed for the implemented flow: root already imports PeopleWorkspace, and the new invitation controls are inside that feature. Its guarded stateless `productBootstrap` call verifies the current account, opaque realm, selected organization/role and membership access revision before exposing choices. The existing root guarded client still performs every mutation. Neither another session controller nor an implicit grant was added.

The actual amendment008 API accepts full unique arrays. The UI now preserves explicit array order, mixed branch roles, active/inactive flags and explicit empty arrays, including branch grants on administrative organization roles. It no longer derives grants from the organization role or selected/Principal branch. The old WP01/v1 and v3 limitations are superseded by this source; their immutable evidence remains unchanged.

## CONTRACT/ACCESS: archived-branch discovery limit

Current bootstrap returns only active branch choices. It therefore supplies every active same-org branch available to an organization administrator and supports arbitrary mixed active/inactive role selections on those branches. It cannot enumerate a branch already archived before the page loads. The UI must not guess IDs, infer archived branches from roster grants, fabricate status or silently substitute another branch.

For complete **already-archived branch selection**, supply an authorized branch metadata read. Proposed exact additive owner seam:

- Endpoint name `invitationBranches`; GET `/api/b2b/orgs/:organizationId/product/v2/invitation-branches`, input strict `{}`.
- Response strict array of `{organizationId, branchId, name, status: 'active'|'archived'}`; IDs use existing IdSchema. No membership, health, token or implicit permission data.
- ACCESS requires current active selected admin/superadmin plus manage-people, current session/realm/tenant/branch, header2 and product readiness. Same-transaction query selects only this context's organization, including archived metadata. No schema/table mutation is necessary.
- Require tests for wrong organization, selected coach/member downgrade, revoked access and concurrent archive. Add only the owner-controlled endpoint/client registry and reviewed binding; preserve all existing strict DTOs.
- Return the frozen seam to the UI owner. Its InvitationBranch model/editor already supports explicit inactive grants on an owner-provided archived option and blocks active grants there; wire the new read through the same scoped/cancellable catalog path, replacing active-only bootstrap discovery. Do not synthesize a production fallback.

This is a metadata/coverage dependency, not a request to reopen role/grant policy or relax authorization. Current multi-branch active/inactive arrays and no-grants creation are implemented; initial archived enumeration remains unaccepted until the owner provides a real source.

## QA/admission ownership

QA retains real invitation navigation, fresh credential consent, same-tab identity replacement and two-brand/four-branch browser specs. The People feature displays new admission reasons and explicitly explains that existing membership must be managed rather than promoted/reactivated through an invitation. Root's actual acceptance callback stays unchanged.

Use qa-scenarios.md after composing the source. No real invitations were sent and no production accounts were created. The UI-only owner returns its lease at the final published head; Astra retains ACCESS/root. The later integration head `6a479f00f6941e0ec7fb89cc399a7569e3b08e04` was inspected: intervening changes are QA/spec/fixture/evidence only, with no overlap in People, bootstrap contracts/API or product client. Parent owns final composition/reruns.
