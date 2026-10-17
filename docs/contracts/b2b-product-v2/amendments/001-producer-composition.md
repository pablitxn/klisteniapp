# Amendment 001: reviewed catalog and producer composition

Owner: CONTRACT / INTEGRATION. Applies on `integrate/b2b-product-v1` after frozen
WP00 `0b611064a91b87b3a17274cabca5415bcf1d7d55` and accepted WP01/WP02/WP04/WP05
heads. Parent must forward this additive integration amendment to consuming
workers. DTOs, endpoint paths, migration 006 and existing stored JSON are unchanged.

## Registered catalog successor

Migration `007-reviewed-catalog-v1` applies WP04's enrichment in the normal
migration transaction after 006. It pins catalog hash
`fd0b7e52f7678c08c96d70fd71e40a11d87974cde87cca672f3b4e4c65f7a673` and fails if
migration inputs drift. There is no new DDL. Canonical installed rows receive the
42 directed review records; edited/local rows never inherit review. Repeat runs
do not change original exercise/routine/snapshot/log/media/audit bytes. Future
catalog changes require their own pinned successor migration.

`product-readiness.ts` defines required product migrations 006 and 007. HTTP
readiness and active product authorization call `assertProductMigrations`.
Missing receipts fail closed. The existing capabilities DTO's `migration` literal
continues to identify the v2 foundation; it is not a list of every data successor.
Activation remains a separate integration gate and is not performed by migration.

Integration updates only stale migration-count expectations in foundation/shared
tests and WP04's initial enrichment expectation: after registered migration007,
a repeat `enrichReviewedCatalog` inserts zero rows. Its separate installed-data
and historical replay checks remain intact. Original producer evidence is retained.

## Public imports and publication composition

`@klisteniapp/b2b-domain/prescription` and `/alternatives`, with equivalent named
root exports, are available without a dependency/lockfile change. Existing v1
training exports retain their behavior.

`apps/b2b-api/src/product-composition.ts` exports:

- `resolveReviewedPublicationRelations`: binds WP02's real resource pipeline to
  WP04's canonical relation projection. WP02 v2 supplies the complete current published, branch-authorized catalog;
  the resolver checks migration readiness and freezes canonical review. WP02
  validates and freezes target exercises/machines in the same transaction.
- `createProductPlanning(realPlanningSchedule)`: constructs the 13 planning
  services. WP03's real deterministic/transactional adapter is mandatory. There
  is no production fallback or synthetic scheduler. Pass the returned instance to
  the fourth `B2BService` argument only after accepting WP03's implementation.

`B2BService` owns one health service factory per service/API instance. Its
registered producers use the frozen request/output parsers and current ACCESS
transaction. The alternatives version query is converted only from a positive
integer string. Product activation/header/scope rules apply to every registered
organization producer. Absence of a complete planning instance leaves those
routes unavailable.

## Health and inactivity bindings

Health POST bodies alone receive a 5 MiB transport envelope; parser semantic
limits remain unchanged. Other routes keep 1 MiB. Health and self-export paths
receive private/no-store cache headers before authentication/body parsing, including
errors. Direct health GET output is parsed and serialized while authorization and
consent locks remain held. Mutation success follows commit. A later queued response
must reacquire authority and use WP05's revalidation helper, never captured bytes.

The provisional ACCESS revocation helper delegates exclusively to WP05's
`revokeHealthForInactiveMembership`. Both legacy and product deactivation paths
call it in the same organization write transaction: v2 carries its operation ID;
legacy uses a server-generated request ID. Reactivation does not recreate consent.
WP06 must preserve this hook and the distinct identity-only owner-export boundary.
WP05's selected-branch role amendment is required before composed health acceptance.

## Consumer requests and remaining gates

WP04 v2 fixes raw historical adoption hashing. Pass the exact stored snapshot to
`legacySupplement`, not a decoded/default-enriched projection. WP03 must invoke
`assertNewReviewedCatalogEligibility` for new or restored reviewed segments,
after current authority/receipt handling and frozen-segment/equipment validation.
Unchanged historical selections retain their original data after withdrawal.

The helper's internal `REVIEWED_TARGET_UNAVAILABLE` code is outside the frozen
transport error enum. WP03 must map that condition to existing `INVALID_INPUT`
with this exact response shape, preserving HTTP409 and all local actuals:

```json
{
  "error": "La alternativa revisada ya no está disponible en esta sede.",
  "code": "INVALID_INPUT",
  "issues": [
    {
      "code": "unavailable",
      "path": ["content", "selectedSegments"],
      "stepId": null,
      "message": "La alternativa revisada ya no está disponible en esta sede."
    }
  ]
}
```

The path refers to `SaveSession.content.selectedSegments`; `stepId` is null
because the helper does not return the specific offending step. Map only this
internal condition; propagate unrelated authorization and validation failures. Do not widen strict transport enums in a producer branch. WP09 can
refresh choices from this structured issue without discarding completed work.

Full-topology unified mode still fails closed. A future explicit unified product
mode needs a server opt-in, narrowly allowed bootstrap/auth/v2 paths, explicit
branch choice and session realm isolation while preserving legacy503 behavior and
white-label domain binding. Administrative branch discovery additionally needs
a reviewed bootstrap projection: current `ProductAccess.branches` represents
explicit coach/member grants and must not invent such grants for administrators.
These are separate CONTRACT/ACCESS changes; this amendment does not remove the
existing guard, add a hidden bypass or claim unified functional acceptance.

Final API/UI/browser acceptance remains dependent on accepted WP03, WP02/WP05
amendments, WP06 identity/export integration and the UI waves. Parent retains
orchestration. No main merge, production migration or real-user data use occurs.
