# Amendment 003: production services and immutable reads

Owner: CONTRACT / INTEGRATION. Additive endpoint inventory; existing request,
response, stored-data and error schemas remain strict and unchanged. Requires
amendments 001 and 002. No organization activation or main merge is performed.

## Production composition

`B2BService` now constructs WP02 through
`createProductPlanning(createPlanningSchedule())`, registers WP03's
`createRecordsServices()`, and retains the reviewed alternatives and private
health producers. These factories execute through ACCESS's current authorized
transaction and the existing route/output parsers. There is no synthetic or
no-op production scheduler. The optional explicit planning constructor argument
remains available for focused tests. Public domain exports `/schedule` and
`/sessions` and named root exports are registered without dependency changes.

Accepted producer inputs for this composition are WP01 `af1fef78`, WP02
`c6825101`, WP03 `d12b56b9`, WP04 `04b2e036` and WP05 `9029ea57` (full SHAs in
the integration receipt). WP03's obsolete error-enum patch is not applied.
Enrollment end still requires WP02's forthcoming captured server-time amendment;
the current adapter deliberately rejects missing effective time atomically.

## Additive reads for WP07, WP08 and WP09

All routes are under `/api/b2b/orgs/:organizationId/product/v2`, require the
explicit contract header and current selected branch/role, and use the existing
`createProductV2Client(...).call(name, input)` transport. No legacy route bypass,
client parser widening or inferred schema discriminator is introduced.

| Client operation | Input | Path | Output and authority |
| --- | --- | --- | --- |
| `catalogExercises` | `{}` | `GET /catalog/exercises` | Existing `Exercise[]`; active planning authority, published catalog only, current tenant/branch publication and hide rules. |
| `routinePublications` | `{}` | `GET /routine-publications` | `{name,reference:{programId,version,schemaVersion}}[]`; active planning authority. Actual immutable publication discriminators and names; archived or currently unassignable choices excluded. |
| `routineVersion` | `{id,version}` | `GET /routines/:id/versions/:version` | Existing `StoredRoutineSchema`: `{schemaVersion:1,snapshot:ProgramVersion}` or `{schemaVersion:2,snapshot:RoutineVersionV2}`. Current training-history authority. |

`version` is a strictly positive integer, including during HTTP path parsing.
Staff reads remain in the currently authorized branch. Members must have the
exact own legacy assignment or issued v2 occurrence for that immutable version
in the same organization and branch. Unknown/unissued/foreign references return
404. A trainer's mutable draft projection is never used for member execution.
Archived or now-unavailable publications remain readable through historical
issued linkage; this does not make them eligible for new assignments.

Publication choices run the same current resource/equipment validation as
assignment. That list is advisory; enrollment revalidates transactionally. A
legacy draft may project as schemaVersion 2 while its actual publication choice
correctly remains schemaVersion 1. All reads preserve stored publication bytes.

WP07 supplies the two loaders through this transport. WP08/WP09 resolve issued
references through `routineVersion`; use the explicit discriminator and existing
legacy projection helper where needed, without inventing omitted doses. These
reads do not broaden reviewed-alternative authorization: the required WP04
own-v2-occurrence amendment remains separate.

## Explicit handoff and remaining integration findings

WP06 owns new membership/export modules and tests from checkpoint `7a046c0`.
INTEGRATION retains shared ACCESS files and final producer/identity-export
bindings until a named lease transfer. WP06 must preserve amendment 002's atomic
revocation hook. WP11's training interchange must consume an explicit accepted
export/import boundary, not infer unrestricted replay from active membership.

Producer amendments required before feature acceptance:

- WP02: capture an immutable server `effectiveAt` for end. Period preview hashes
  include the internal change; adding a fresh unrounded clock to preview and apply
  would invalidate unchanged previews. Omit it for period or pin the existing
  expiry bucket. Prove successful preview/apply with an advancing clock inside
  the expiry window, and still reject actual intervening changes.
  Replace the synthetic scheduler fixture and correct replacement-slot tests to
  preserve cancelled old IDs and newly issued obligations.
- WP04: alternatives currently authorize members only via legacy assignments.
  Accept exact own issued v2 occurrence linkage in the selected tenant/branch,
  with unrelated member/version/branch denial. The integration-owned
  `assertIssuedRoutineAccess` helper specifies the immutable-read rule; the
  alternatives producer still owns its current eligibility and policy checks.
- WP07: narrow new member planning choices to active selected-branch member
  grants, including staff with such a grant. Bind the effective selected role and
  authority abort/generation; remount/clear on host/session/context change.
- WP10: inactive identity-only export must not require a selected branch. The
  shared shell still needs authenticated committed remote invalidation and
  fail-closed notification disconnection. Polling/no-store alone is insufficient.

Full-topology unified mode remains closed pending explicit unified-session realm
and authorized administrative branch bootstrap contracts. Do not remove the
existing legacy white-label guard or fabricate branch grants. Browser tests,
valid-trust HTTPS and cross-device health invalidation remain acceptance gates.
