# WP07 owner requests

Source `c008dd883870d69026851e0945b825c583f8dd0e`, frozen base
`0b611064a91b87b3a17274cabca5415bcf1d7d55`. No lease transfer or shared-file edit.
Parent retains dispatch, monitoring, final composition and merge decisions.

## INTEGRATION: exact optional composition patch

[integration-composition.patch](integration-composition.patch) targets the frozen
`apps/b2b-web/src/app/ManagementWorkspace.tsx`. It adds an optional
`productProgramming` prop and lazy page selection inside the existing programs
route; the legacy page remains the default until an authorized v2 composition
supplies its two loaders. Apply-check passed without applying it. Reconcile against
the current owner's tree, format after application, and validate the composed route.
No root navigation, provider, manifests, export barrel, DTO or API route was edited.

The owner supplies stable functions scoped to the current authenticated account,
organization, permitted selected branch, requested role and context generation:

```ts
import type { ComponentProps } from 'react';
import { ProgrammingPage } from '../../../../apps/b2b-web/src/features/programs/product/ProgrammingPage';
type ProgrammingResources = Omit<ComponentProps<typeof ProgrammingPage>, 'membership' | 'dataRefresh'>;
// productProgramming: ProgrammingResources
// loadExercises(signal): Promise<Exercise[]>
// loadRoutineChoices(signal): Promise<{ name: string; reference: RoutineReference }[]>
```

The import above describes repository-relative ownership, not a proposed new cross-app
import in production. In ManagementWorkspace use the relative path in the patch.
Both loaders must use owner-approved, currently authorized reads and honor the
AbortSignal; no stale/cross-branch cached catalog or reference list is acceptable.
Key/remount the page on host/session/context-generation loss as well as selected
account/brand/branch/role changes. The module itself keys those selected fields,
uses abort signals, checks current frozen capability/access DTOs and refuses to
render without `edit-planning`. Capability discovery is not server authorization.
Keep product activation disabled until full composition/acceptance.

## CONTRACT / ACCESS: two missing frozen read seams

These are concrete contract gaps, not permission to alter frozen producer files:

1. `ProgrammingPage.loadExercises` needs the existing published `Exercise` DTOs
   visible in the selected branch. Frozen `ProductEndpoints` has no catalog-read
   method. Calling the legacy catalog client after `product_active` is enabled
   fails the foundation's `assertLegacyProductAccess` guard even with header 2
   (`service.ts` organization transaction). Do not bypass that guard, use an
   unauthenticated endpoint or import catalog-base into web. The owner must expose
   an explicit authorized product read, or return an approved compatible seam.
   Reuse `ExerciseSchema`/the existing catalog response; no new exercise semantics.
2. `loadRoutineChoices` must return exact immutable publication references:
   `{programId, version, schemaVersion}` plus display name. WP02 projects legacy
   mutable drafts through `RoutineDraftV2Schema`; its `schemaVersion:2` describes
   the draft projection, not necessarily `b2b_program_version.schema_version` for
   `publishedVersion`. Therefore it cannot safely construct a publication reference.
   Read the real version discriminator from immutable published rows under current
   tenant/branch eligibility. A version read/list using frozen
   `RoutineReferenceSchema` is sufficient. Do not guess v2, flatten v1, or select a
   mutable draft as an assignment. The UI preserves existing explicit references
   and immediately registers exact v2 references returned by `publishRoutine`.

CONTRACT owns any endpoint/DTO inventory amendment and client registration;
ACCESS owns locked context/service/HTTP registration. Send the exact accepted
amendment/composed SHA to the parent and WP07 for applicability validation.
These seams block live route acceptance, not the implemented editor/model tests.

## WP01 / WP02 / WP03 / WP04

Register frozen planning/access/audit services in the currently authorized outer
transaction. UI methods are capabilities, access, routines, routine, saveRoutine,
publishRoutine, people, goals, saveGoal, enroll, continuity, periodPreview,
applyPeriod and audit. Server roles/branch grants and active membership remain
authoritative; no synthetic grants or fixture contexts are installed here.

WP02 and WP04 exact producer heads were merged only into local validation branch
`test/wp07-dependencies`. Final validation head:
`e813f65d1872278e40ef7456b56e544a2600873c`, amended WP02 head
`c6825101d6ac798437599062481adf2a79ac5f69` after the parent update. Feature source remains UI/tests only.
The amendment does not change UI transport interfaces. Its full API run here
at `ce459d2a48d090653daae89c31bd75bfe1612e19` has 114 pass, 7 fail, 0 skip.
Six legacy HTTP regressions need WP01 context composition; no WP01 implementation
was merged under WP07's two-producer validation allowance. The seventh is the
known `white-label-training.test.ts:371` outdated zero-count expectation. Review
WP02/v2/integration-test-expectation.patch under INTEGRATION's lease; do not
blindly weaken it. Final composed API acceptance is incomplete. The unchanged
WP02/WP04 APIs are unaffected by the later UI-only replay correction.

No producer file, migration, resolver, schedule adapter, export or route patch was
applied. Register WP04 publication freezing and WP03 real schedule adapter through
their existing immutable requests. The reviewed-alternative component is rendered
inside a disabled preview fieldset after publication; it does not change workouts
or assert that equipment is absent. Actual equipment/condition checks remain in
WP04/WP09/server flows.

## WP12: browser scenarios for the composed head

QA exclusively owns new `b2b-product-programming.spec.ts` and browser fixtures.
Run unified and white-label trainer harnesses in Chromium/WebKit at 320x740,
430x932 touch and 1440x1000 desktop:

1. Save/reload blank routine, empty steps and incomplete prescription. No score.
   Publication identifies exact missing step/path; fixed/range reps or seconds,
   external zero/bodyweight, laterality, explicit rest zero/default and notes work.
2. Keyboard-edit range/date controls, block/unblock alternatives, read publication
   target dose/conditions. No 320px horizontal overflow; all controls have labels,
   visible focus and touch size. Blank save bypasses HTML required constraints.
3. Build an objective, explicitly confirm IANA timezone, create ordered stages
   with gaps, two same-day slots and repeated immutable routine versions across
   stages. Preview past/current/future in that timezone; activation rejects overlap,
   missing dates/slots/routines/timezone. Prior versions remain unchanged.
4. Two trainers edit revision N. First accepted save wins; second shows conflict,
   preserves local work, reads latest and requires explicit review before rebase
   or discard. Never auto-merge. Check actor/time/revision/field audit references.
5. Simulate offline request and response loss. Recover session-local working copy,
   including stable new resource and immutable operation ID. Exact retry returns
   original accepted operation before querying current head; never duplicate a
   publication/enrollment. Changed payload gets a new operation identity. Save
   does not activate/assign automatically. Storage denial is visible.
6. Preview period move after recorded work and accepted member override. Inspect
   every changed occurrence/date/eligibility/reason and retained linked session ID;
   confirm before apply. Edit proposal, correct actual, move occurrence, expire
   preview or race another trainer: new preview required, work/history preserved.
   Exact response-loss apply retry retains original fingerprint/operation.
7. Account/brand/branch/role/host-generation changes hide previous drafts/results.
   Member selector never renders previous member's goals under a new member ID.
   Revoke access in flight: current server policy wins, no stale response leaks.
8. Empty/loading/error/retry states, back/reopen/reload and inactive target/actor
   denial. Verify v1 references stay v1 and unavailable/archived historical versions
   remain visible as retained references without becoming newly selectable.

No product browser, interactive keyboard/layout, HTTPS/Secure-cookie, physical-device
or end-to-end v2 authorization case was executed by WP07. Component tests verify
rendered semantics, not the browser matrix. Final parent-composed head is pending.
