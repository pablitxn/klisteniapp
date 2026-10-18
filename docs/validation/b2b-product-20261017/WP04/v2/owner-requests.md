# WP04 v2 handoff to WP02 / WP03 / INTEGRATION

Consume source `31a1deb278f5fed777ee8314d51097a615a9f695` from the existing PR16 branch. Apply its amendment after the previously consumed WP04 source; do not edit or regenerate v1 evidence. Parent should relay this seam to WP03; no cross-thread messaging tool is available in this worker environment and no duplicate task was dispatched.

## WP02: preserve raw adoption identity

Pass the exact `snapshot` JSON value returned by the database to:

```ts
const adoption = legacySupplement(rawStoredSnapshot, confirmedV2, memberId);
await saveLegacySupplement(context, adoption, operationId);
```

Do not pass `ProgramVersionSchema.parse(rawStoredSnapshot)` as the first argument: that projection may add supported historical defaults. `legacySupplement` now parses its own separate projection for dose/identity validation while hashing only `rawStoredSnapshot`. Existing storage/read callers in WP04 use the same raw hashing rule. Never rewrite historical snapshots to make a digest match, and never accept the normalized digest as an alternate identity.

## WP03: current catalog checks for new or restored alternatives

Import the API-only helper from the owned catalog module:

```ts
import { assertNewReviewedCatalogEligibility }
  from '../catalog/reviewed-alternatives.ts';

// Inside the already authorized, branch-scoped write transaction:
// 1. Parse/validate current request and issued frozen routine/segments.
// 2. Preserve normal operation-receipt replay behavior after current authorization.
// 3. Validate frozen segment identity and equipment using WP04 domain helpers.
await assertNewReviewedCatalogEligibility(context, nextContent, previousContent);
// 4. Persist revision/receipt/audit atomically in the existing transaction.
```

`context` is `AuthorizedProductContext`; `nextContent` and `previousContent` need `{segments, selectedSegments}` from the frozen SessionContent type. For a first write, use `{segments: [], selectedSegments: []}` as previous. Do not compare just segment existence: explicit restoration of an earlier retained segment also requires current catalog eligibility. The helper detects new segments and selected-segment changes. It locks current target exercise rows for sharing and uses the current organization/branch to exclude hidden catalog rows. Its authorization safety relies on the existing context/organization transaction; no second connection or payload tenant is used.

The helper fails new selections if the target is missing, edited, non-published, local/unproven, branch-excluded or based on another catalog revision. Error: `409 REVIEWED_TARGET_UNAVAILABLE`. Map this as a recoverable selection conflict; retain local actuals and require a currently eligible option. It does not alter the frozen snapshot or invent a replacement.

Continue calling `checkEffectiveSegments` / `checkNewSegmentSelections` to validate exact frozen provenance, required conditions, set units/sides, retained identities, completion and equipment. Current catalog authorization is separate from equipment availability. Never pass user-claimed catalog eligibility or machine availability as authorization. Unchanged retained historical selections and their corrections must preserve history after later catalog withdrawal. Exact accepted operation replay is not a newly selected exercise; preserve WP03's receipt semantics after current access checks.

WP09 should refresh available selections after this conflict without discarding earlier work. QA should test branch withdrawal between viewing an option and submitting it, restore of a withdrawn prior segment, and unchanged historical log correction after withdrawal. The existing browser ownership remains with WP12; no browser spec or WP03 file changed here.
