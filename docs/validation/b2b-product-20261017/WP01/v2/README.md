# WP01 publication amendment and producer bindings

This additive amendment supersedes the v1 publication packaging/registration status. It does not change the tested implementation at `eb906dd7442aa2c6b79ab6b19fa34c17251f4394`. Original v1 tracked bytes remain unchanged at `37ea95979f9255eabe1754fd86d7f15c0d6ffee1`.

The initial evidence commit omitted ignored `*.log` files. They are now explicitly attached with their original v1 manifest hashes; no result was changed. The standard v1 patch's blank context lines trigger whitespace diagnostics. Its cleaner, apply-checked replacement is [planning-owner.patch](planning-owner.patch). The original remains immutable evidence. Final whole-range `git diff --check` reports preserved v1 patch context and raw tool-output whitespace/EOF diagnostics; code and the new v2 artifacts have no whitespace errors. Raw logs are retained byte-for-byte against their original manifest rather than reformatted. The earlier v1 metadata check covered the then-tracked code diff, not the subsequently added patch artifact. This is a reported evidence-format exception, not a green whole-range check.

## Parent's ready producer handoff

Read on receipt, without merging or editing producer files:

- WP02 PR18 `3b045cbe431d1995d75f9e88eeac1d79a08607bb`, `WP02/v1/owner-requests.md`, planning factory/resources/schedule interfaces.
- WP04 PR16 `c91fbcbaf3dc228630cda66dd2229f2524cb46c9`, `WP04/v1/owner-requests.md`, actual alternatives handler.
- WP05 PR17 `b5715612f989b66327a2f89d7df94813bbebf98a`, `WP05/v1/integration-request.md`, actual health factory/access/disclosure/inactivity hooks.

[producer-registration.patch](producer-registration.patch) is an exact **unapplied** shared-file proposal against WP01's code head. Apply only after the real producer modules are composed and the conditions below are reviewed. It has passed patch application checks only; it has not compiled or executed against a composed application.

The patch creates the real health factory once per service instance, binds the real alternatives handler, accepts an optional complete real `PlanningServices` instance, and routes only populated producer names through frozen input/output schemas. It supplies the numeric alternatives version conversion, 5 MiB health POST transport envelope limit, health success/error no-store headers and serialization/dispatch of health GET results while authorization/consent locks remain held. It preserves path/body IDs and the existing current-authority transaction. Mutations retain commit-before-success delivery. Do not add synthetic services or a fallback scheduler.

Planning cannot be instantiated from the three supplied heads alone: `createPlanningServices` requires a real WP03 `PlanningSchedule.plan/apply`, and publication resources need the reviewed relation callback with branch-authorized source/target availability. The supplied constructor input deliberately leaves all planning endpoints unregistered until a complete real instance is supplied. INTEGRATION composes `createPlanningServices({...createPlanningResources(resolvePublicationRelations), schedule: realPlanningSchedule})` and passes that instance as the fourth `B2BService` argument. WP04's raw freeze helper must not be called on guessed/unscoped targets.

## Required owner reconciliation before health binding

WP01's `context.role` is the **effective selected branch role**, so a user with organization role member and a live branch coach grant has coach context; an administrator selecting a member grant has member context and downgraded capabilities. WP05 currently requires `identity.product_role === context.role`, which rejects these legitimate selected roles. Do not replace WP01's context with the highest organization role, which would undo the authorization boundary.

[health-effective-role.patch](health-effective-role.patch) is an exact proposed WP05-owned adjustment: current identity/access revision still revalidate; administrative contexts must match current organization authority or its explicit superadmin-to-admin downgrade; coach/member contexts require the existing subsequent live selected-role grant check. WP05/CONTRACT must review this amendment and test organization-member/branch-coach, superadmin-selected-member and revoked grants. The patch is not applied here and no composed health acceptance is claimed.

Replace WP01's provisional `revokeMembershipConsents` implementation with delegation to WP05's `revokeHealthForInactiveMembership({db, organizationId, actorId}, ownerId, operationId)` after composition. Pass the v2 permission operation ID, and an explicit server request ID for a legacy transition. Do this **instead of** running both helpers in sequence: WP01 currently revokes first, so a later WP05 call would see no remaining consent and could not append its own bounded revocation audit references. Preserve the same organization write transaction and do not call the hook during reactivation. Its own idempotence protects repeated inactive transitions.

WP05's delayed-projection API must be used if INTEGRATION adds a queue outside the direct registered GET path: reacquire a fresh ACCESS transaction, call `revalidateHealthDisclosure`, and serialize its returned projection under current locks. Never send captured old bytes or treat `healthDisclosureGeneration` as an authorization token. Multi-replica health preview affinity remains WP05's documented limitation; no durable ticket store was invented.

CONTRACT remains responsible for WP04's enrichment migration/readiness, producer export barrels and any invitation schema amendment. No real-environment product activation occurs in this handoff.

## Receipt and remaining gates

Owned implementation is ready at the code SHA above. The ACCESS lease is returned with this final branch head; parent may dispatch sequential WP06 after reviewing it. There are no ongoing WP01 shared-file edits. The precise final evidence head is in the draft PR/publication receipt.

Validation remains v1's truthful results: **13 focused API tests pass; full API 104 pass / 1 fail / 0 skips** because the PLANNING repository patch is unapplied. Contracts/domain/client/web, lint/typecheck, boundaries and both configured builds pass. All browser, composed producer wiring, health role reconciliation, arbitrary-array invitations, valid-trust HTTPS and physical-device acceptance remain unaccepted. No main merge/deployment/credentials/provider changes occurred.
