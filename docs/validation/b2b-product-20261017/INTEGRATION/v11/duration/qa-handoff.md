# ALTERNATIVES-011 QA consumption handoff

Root-owned synthetic fixture integration is now present in scripts only. No QA-owned test or fixture types were edited.

When the existing harness is started with B2B_PRODUCT_TEST_ACTIVATE=1 against a fresh task-owned schema, `product.resources.reviewedDuration` contains one manifest per synthetic organization, in that organization's primary branch. It is a separate array: `resources.v2` still describes the original secondary-branch range routines and their six issued occurrences each. Inactive foundation returns `reviewedDuration: []`.

Typed manifest shape (JSON output also exists in fixture-example.json):

```ts
{
  fixtureKey: 'b2bp-alternatives-011-duration-v1',
  kind: 'synthetic-contract-fixture',
  scenarioId: 'B2BP-ALTERNATIVES-011',
  organizationId: string,
  branchId: string,
  programId: string,
  version: 1,
  schemaVersion: 2,
  stepId: string,
  relationId: string,
  canonicalDirectedPair: {
    relationId: string,
    relationHash: string,
    catalogRevision: string,
    sourceExerciseId: 'calf-raise',
    targetExerciseId: 'single-leg-calf-raise',
    sourceContentHash: string,
    targetContentHash: string,
  },
  syntheticTargetDose: {
    provenance: 'independent-synthetic-test-prescription',
    reviewScope: 'contract-and-ui-test-only',
    disclaimer: string,
    hash: string,
  },
  routineHash: string,
}
```

For ALTERNATIVES-011 only, the QA owner should select this manifest by BOTH actual staff organizationId and branchId, fetch it using the normal `routineVersion` endpoint, require schemaVersion2 and use `stored.snapshot`, then find its exact manifest.relationId. The actual fixture is initially unassigned. Prescribe/enroll through the normal QA helper and normal public API for the actual member, then retain all original target seconds/set/rest/laterality, partial/explicit completion, routine/goal immutability, and viewport assertions.

Conceptual handoff (owned QA adaptation, not applied here):

```ts
const fixture = product.resources.reviewedDuration.find(
  (item) =>
    item.organizationId === staff.who.organization.id && item.branchId === staff.who.branchId,
)
const stored = await api(staff.page, staff.who, 'routineVersion', {
  id: fixture.programId,
  version: fixture.version,
})
// Assert stored.schemaVersion === 2 before narrowing.
const routine = stored.snapshot
const relation = routine.relations.find((item) => item.id === fixture.relationId)
const plan = await prescribe(staff.page, staff.who, member, { routine, weekdays: [1] })
```

Do not call the ordinary reviewedRoutine publication helper for this timed-direction fixture: normal canonical publication correctly still produces repetitions targets. Do not republish the fixture, insert its relation into b2b_reviewed_relation, edit canonical dose/content/review data, use an adapted local target, forge catalogRevision, or weaken any eligibility/confirmation/completion rule.

The canonical directed pair and exact exercise identity/hash/revision are real. The duration dose (2fixed sets,20-30seconds per side,90seconds rest,bodyweight) is independently synthetic. The routine/relation/dose display an explicit disclaimer; copied source: and reviewed-on: dose-review assertions are absent. This tests model/UI directional behavior and does not claim a real-world catalog-reviewed timed prescription or equivalence.

Actual root composed HTTP/service evidence now passes in unified and white-label modes: scoped published/listed reads; secondary branch404/unlisted; normal trainer goal/enrollment and occurrence issuance; normal member partial then explicit completed timed saves preserving source actuals; missing-side, forged-dose and missing-condition requests400; immutable routine snapshot and enrollment goal preserved. Browser ALTERNATIVES-011 still requires QA's actual run on the final composed candidate.
