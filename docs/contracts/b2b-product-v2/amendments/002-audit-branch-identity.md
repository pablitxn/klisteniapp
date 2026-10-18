# Amendment 002: branch-scoped audit identity

Owner: CONTRACT / INTEGRATION. Additive successor to amendment 001. Migration
006, previously published evidence, DTOs, operation receipts and stored audit rows
remain unchanged.

## Migration and compatibility

`008-product-audit-branch-identity` follows 007 in the existing migration
transaction. It replaces the audit-operation index with the identity
`(organization_id, actor_id, operation_id, action, branch_id, resource_id)` for
non-null operation IDs. `NULLS NOT DISTINCT` gives system actors, organization
events and branchless events the same retry uniqueness as non-null identities.
Rows without operation IDs retain their existing unrestricted legacy semantics.

Consent IDs are branch-scoped. One membership deactivation can revoke two
same-ID consents in different branches; each must retain its own audit reference.
The 006 index incorrectly treated those references as duplicates and rolled back
the transition. The new index permits both while rejecting duplicates within a
branch. No health values enter general audit metadata.

The migration takes a `SHARE ROW EXCLUSIVE` table lock before checking existing
non-null-operation identities. If nullable historical keys collide under the new
identity, it raises SQLSTATE `23514` before replacing the index. The transaction
retains every original row, the old index and the absence of the 008 receipt.
There is no automatic deletion, deduplication or invented audit identity. Such a
database requires a reviewed preservation strategy before migration can proceed.
PostgreSQL 15 or later is required by `NULLS NOT DISTINCT`; local validation uses
the project's disposable PostgreSQL 17 database.

HTTP readiness and product authorization now require receipts for 006, 007 and
008. The frozen capabilities `migration` literal still identifies the foundation
and is unchanged. Migration does not activate any organization.

## ACCESS / WP06 contract

Keep `revokeHealthForInactiveMembership` in the same authorized transaction as
membership deactivation, with the same request operation ID. Its per-branch
immutable consent revisions and bounded audit references commit together with the
membership revision and operation receipt. Exact retries append nothing twice;
reactivation does not restore consent. A failed audit insert must roll back all
of those changes. Identity-only owner export remains separate from active-branch
authorization.

`product-audit-migration.test.ts` exercises fresh/old-index migration and repeat
preservation, branch-distinct and nullable uniqueness, historical collision
rollback, and actual ACCESS deactivation with two same-ID branch consents. A
synthetic audit failure proves transaction rollback before successful retry and
reactivation checks. `product-audit.test.ts` now selects the membership action
explicitly and separately verifies the consent audit; both records are required.

All fixtures use isolated synthetic local schemas. No production migration,
real-user inspection, automatic activation or main-branch merge is authorized.
