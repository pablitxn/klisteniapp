# WP01 owner requests

These requests do not transfer reserved ownership. WP01 has not changed producer modules, contracts, migrations, export barrels, manifests, navigation or browser fixtures.

## PLANNING / parent: blocking legacy trainer coverage

Apply [planning-owner.patch](planning-owner.patch) to the unchanged frozen `apps/b2b-api/src/training/{repository,index}.ts`, or implement its equivalent in WP02. `git apply --check` succeeds at the WP01 code head.

- Replace both assignment-only coach predicates with a mandatory non-null selected branch matching the row. The organization transaction has already checked the actor's current branch grant; do not grant access with a null branch or the highest role from another branch.
- Add the optional `planning | history` purpose to the training dependency and pass `history` for named assignment/history reads. New assignment creation already checks active `planning` access first.
- WP01's service callback already forwards that optional purpose to `memberAccess`. Do not acquire another database connection.
- Rerun the full API suite. The deliberately updated `integration.test.ts` case currently fails on its first assignment visibility assertion; assignment creation and unassigned historical row visibility consequently remain **unaccepted**, even though the shared authorization policy permits them. Do not restore the superseded assigned-only expectation.

Patch SHA-256: `d3d2acb0005a5766f33328d46f78cdd75a4bd55167d2f44215f0dab31518e4a4`.

## CONTRACT: invitation grants are not fully representable

`InviteProductMemberSchema.branchGrants` accepts an array, but frozen `b2b_invitation` stores only one nullable `branch_id`. WP01 supports a single active coach/member grant in the selected branch, or no branch grants for an organization admin/superadmin. Multiple grants, mismatched roles, another selected branch, inactive-only grants or staff grants on privileged invitations fail atomically with `INVALID_INPUT`. No accepted grant is silently dropped.

If all schema-valid combinations must be supported, CONTRACT must reserve a successor migration for an invitation-grant relation, for example `(organization_id, invitation_id, branch_id, role, active)` with composite tenant invitation/branch FKs and unique invitation/branch/role. It must define privileged-role grant semantics and update migration/readiness/fixtures. Then ACCESS can persist/reload every explicit grant during invitation acceptance. Do not edit migration 006. Full arbitrary-array invitation acceptance is blocked on that amendment, and is not claimed here.

## INTEGRATION / producers: context and registration

`B2BService.productOrganization(actorId, organizationId, sessionId, write, contractHeader, operation, work)` constructs `AuthorizedProductContext` inside the locked transaction. The context contains the current selected role/branch, membership access revision, capabilities and `authorizeMember(id, 'planning' | 'history')`. It reuses `context.db`. `productDiscovery` permits authenticated capability discovery before activation; feature contexts require activation and contract header `2`.

The `productProducers` property reserves typed producer methods only; it does not register HTTP handlers. Current HTTP registration contains exactly capabilities, access, people, updateMember, inviteMember and audit. All unfinished producer routes return 404. Submit exact complete producer bindings to the sequential ACCESS/INTEGRATION owner. Preserve path/body identity matching, strict input/output parsing before commit, explicit numeric-query conversion, current authorization before receipt lookup, module-specific capability/ownership/consent checks and the legacy version gate. Do not flip `product_active` as wiring.

Producer mutations can use `audit/product-audit.ts`:

- `productOperation(context, action, input, resourceId, mutate)` binds a canonical recursively sorted request hash to tenant/actor/operation/branch/resource and retains exact responses after successors. The caller must first authorize the current actor, capability and target. Use the existing organization **write** transaction; do not open a second one.
- `writeProductAudit(context, {action, resourceId, operationId, beforeRevision, afterRevision, changedFields})` writes bounded field names and revision references in the same transaction. Store actual content in immutable producer revisions. Include no raw health/log values in general audit. The operation ID is the durable request identifier in the frozen schema.
- `revokeMembershipConsents` appends revoked consent snapshots on membership deactivation; reactivation restores none. WP05/WP06 must coordinate their revocation hooks to avoid duplicate revisions.

## INTEGRATION / UI

PeoplePage discovers activation and preserves the legacy UI until activated. ProductPeople consumes the versioned client directly and hides previous account/branch data through keyed resources and cancellation. An explicit selected branch must be supplied by both application shells before product activation. The invitation form requires that branch; there is no guessed or newly synthesized grant. Root scope types/navigation remain owned by INTEGRATION.

`ProductAudit` is exported from the People feature module and accepts `client`, a planning `resourceId`, and `close`. Planning views should open it with the routine/goal/enrollment resource ID; the People view opens member IDs for permission history. Register that planning affordance in the appropriate producer UI lease. Audit reads are scoped to tenant/selected branch; trainers see planning action prefixes, administrators also see permission history and unknown legacy metadata.

WP06 must be applied sequentially after parent acceptance of this WP01 head. It owns the later identity-only/export context and purpose-limited inactive routes; WP01 retains active-membership enforcement.
