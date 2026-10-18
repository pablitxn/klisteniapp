# WP04 owner integration requests

All requests target frozen base `0b611064a91b87b3a17274cabca5415bcf1d7d55` and source `e4680efd476be513329e6733cf1267fabd473dee`. Apply producer source before wiring. Reconcile shared-file movement with its current owner; these requests do not transfer a lease.

## CONTRACT: installed-catalog enrichment

[contract-migration.patch](contract-migration.patch) applies cleanly to frozen `apps/b2b-api/src/migrate.ts`. It adds proposed migration `007-reviewed-catalog-v1` after 006, using the same advisory lock/transaction and `enrichReviewedCatalog(client)`. No new DDL is required; 006 already owns `b2b_reviewed_relation`. Keep 001-006 unchanged. CONTRACT chooses final migration numbering and updates readiness through ACCESS/INTEGRATION's current HTTP lease. Require the chosen migration in product readiness before activation.

The patch pins catalog revision `fd0b7e52f7678c08c96d70fd71e40a11d87974cde87cca672f3b4e4c65f7a673`. New installs and already-seeded installations must each get 42 relations for untouched canonical rows; edited base rows/local adaptations get no inherited review. Repeated migration must preserve all historical snapshots/IDs and row content. Future catalog changes require an explicit owner amendment with preserved v1 migration inputs. This patch is apply-checked, but its registration/readiness is unexecuted on the composed head. The helper itself passed real database acceptance.

## INTEGRATION: domain exports

[integration-exports.patch](integration-exports.patch) adds `@klisteniapp/b2b-domain/alternatives` and named root exports. It applies cleanly to the frozen manifest/barrel. No dependency additions or lockfile changes are needed. Reformat the barrel with the repository formatter after application. Keep existing legacy `training.ts` behavior for legacy DTOs; new v2 record handlers must call the helpers below instead of the old source-dose completion rule.

## ACCESS / parent: endpoint registration

```ts
import { alternatives } from './catalog/reviewed-alternatives.ts';
// Register this member in the existing ProductServices dispatch map:
// alternatives: (context, input) => alternatives(context, input)
```

The function signature is `(AuthorizedProductContext, ProductInput<'alternatives'>) => Promise<ProductOutput<'alternatives'>>`. The frozen route is GET `/api/b2b/orgs/:organizationId/product/v2/routines/:id/alternatives/:stepId`, with numeric `version`, contract header 2 and explicit branch context. ACCESS authenticates/rechecks host, current grants, entitlement and active access inside the locked transaction before calling it. No new connection is acquired. Inactive access is denied. Existing DTO/client endpoint registration already exists in frozen v2 contracts; do not add a parallel route or relax strict v1 readers.

## WP02: publication and explicit legacy adoption

```ts
import { freezeReviewedRelations, legacySupplement, saveLegacySupplement }
  from '../catalog/reviewed-projection.ts';
// routine: AssignableRoutine; available: branch-authorized Exercise[]
const relations = freezeReviewedRelations(routine, available);
// Freeze relation targets in RoutineVersionV2.exercises as well as source steps.
// Never replace the old source prescription with the target prescription.
```

`freezeReviewedRelations` suppresses a blocked step and deduplicates identical directed relations shared across reviewed steps. It returns detached snapshots. Read/visibility filtering of `available` remains WP02's scoped repository responsibility. Preserve target exercises/machines in the published snapshot; use `relations` from this helper rather than trainer manual IDs.

For legacy adoption, construct a fully validated `RoutineVersionV2` preserving original identity/scalars/publishedAt/name/description, explicitly confirming formerly missing load/laterality. Add reviewed relations from original canonical source snapshots and eligible target snapshots. Call `legacySupplement(originalV1, confirmedV2, memberId)`, then `saveLegacySupplement(context, supplement, operationId)` inside the existing authorized operation transaction. The helper writes the immutable supplement and exactly one bounded audit entry with actor/branch/server time/operation and supplement before/after 0/1. The owning operation must include it in its normal request-hash/receipt handling; do not create a new endpoint or acquire another connection. Reconstruct member export envelopes separately; DB storage deliberately contains no member ID. No implicit adoption on GET, no rewriting old JSON, no automatic conversion of manual allowlists.

## WP03: effective target and actual-record rules

Consume the new domain subpath after INTEGRATION exports it:

- `reviewedAlternatives(step, frozenRelations)` returns `blocked`, `empty` or `reviewed` and directed options.
- `createOriginalSegment(step, segmentId, createdAt)` freezes the issued source dose.
- `createReviewedSegment(step, frozenRelations, relationId, confirmedConditions, environment, segmentId, createdAt)` validates policy, every condition and target equipment, then freezes independent target dose.
- `selectEffectiveSegment(content, segment)` retains all actuals/segments and clears completion intent. New actuals use `emptyPerformedSet`, which carries no measurement/load/RPE.
- `restoreEffectiveSegment(content, expectedFrozenSegment)` requires exact retained identity/prescription/provenance.
- `checkEffectiveSegments(routine, content)` validates issued-step/segment linkage, exact frozen relation, target units/sides/set bounds and completed coverage. It validates structural/actual semantics; it does not grant access.
- `checkNewSegmentSelections(routine, content, previous, environment)` additionally rejects changed/dropped retained segments and checks equipment for newly introduced segments. `environment = {activeMachineIds, confirmedEquipment}` must come from current authorized branch inventory and explicit target-equipment confirmation, not caller-claimed authorization. Existing prescribed segments/actual history survive subsequent equipment loss.

After session schema parsing and current authorization, call the checks before accepting/receipting a write. Retain selected segment identity across retries. Own-log corrections still append server revisions. Source additional work never fills target coverage. For alternating/per-side dose, ordinals 1..minimum sets each need left and right; bilateral needs `both`. Ranged maxima bound permitted additional ordinals. Positive truthful below-target actuals satisfy measurement presence. External load requires independent actual load (zero is permitted); bodyweight has null external load. Completion also requires explicit user intent via the frozen SessionContent schema.

## WP07 / WP09: composition

Import `ReviewedAlternatives` from the new feature folder. Props: `{step, relations, unavailableIds: ReadonlySet<string>, onSelect(relation, confirmedConditions)}`. `unavailableIds` contains relation IDs, computed from current branch availability; errors/revocation still require revalidation. On selection call the domain helper and create a fresh segment; do not reuse previous source rows or loads. Use `restoreEffectiveSegment` only for explicit restoration of an exact retained segment. Render prior segments/sets as additional work in detail/export.

`alternativePresentation`, `doseLabel`, `requirementLabel`, `conditionLabels` and `legacyAuthorizationLabel` are pure view helpers. Block is an explicit policy in the routine step, with accessible notice. Empty reviewed list is a different state. A legacy manual allowlist has its own label and confers no canonical review. WP07 supplies the per-step policy edit; WP09 owns existing Session/controller/draft files. No new route/navigation is required by this component.

## QA: browser acceptance

[acceptance.json](acceptance.json) supplies the package's exact scenario map. QA owns `b2b-product-alternatives.spec.ts` and fixtures; WP09 integrates the workout flow. Run Chromium/WebKit at 320x740, 430x932 touch and 1440x1000 after composition. Verify keyboard labels/status, no overflow, target dose/conditions/equipment gating, source-to-target mode/laterality switch, preserved actuals, explicit restore, no auto-completion, reload/replay, per-step block versus empty, legacy labels and brand/branch switch/revocation. No browser case has been claimed passed by WP04.
