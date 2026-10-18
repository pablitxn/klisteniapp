# WP07 legacy adoption integration request

Frozen implementation candidate/contract: `efbed2dd1c7ed06092463a3eec4531c2a3e10075`.
Source: `1fb3ab34c95780fb4a1cd8711dcde31820fc623a`.
Branch: `feat/b2b-legacy-adoption-ui-v1`, isolated from that exact candidate.
Parent retains dispatch, monitoring, application merge and final composition.
No root, history, API, DTO, SQL, export or manifest file was edited by this work.

## INTEGRATION: exact root-only entry patch

[integration-root.patch](integration-root.patch) targets the frozen
`apps/b2b-web/src/app/ProductWorkspace.tsx`. It adds a staff navigation entry only
when current access includes `edit-planning`, and mounts the new feature for
`view=legacy-review`. It passes current account, branch, access, accessKey,
contextSignal, guarded typed client factory and an actual back-navigation callback.

Apply-check passed, without applying the patch:

```sh
git apply --unidiff-zero --check docs/validation/b2b-product-20261017/WP07/v3/integration-root.patch
```

The patch has zero context to avoid trailing-space context lines in the immutable
receipt. Reconcile against the current owner tree, format and validate after
application. The shared integration branch moved after the pinned candidate; no
moving head was silently merged into the feature. This request transfers no lease.
The earlier WP07/v1-v2 root patch is historical; use this v3 request for adoption.

## Actual selected assignment and source binding

Entry component:
`apps/b2b-web/src/features/programs/legacy-adoption/LegacyAdoptionAssignments.tsx`.
It calls `historySubjects` for the current branch, checks the returned scope,
then calls `legacyAssignments` for the selected actual member. Every assignment
must match organization/branch/member; only its authoritative v1 routine reference
can enter adoption. It never constructs an assignment from a routine ID. Inactive
historical targets remain selectable under current server history authorization.
There is one selected assignment and one create-only mutation; no bulk conversion.

`LegacyAdoption` can also be mounted directly with `LegacyAdoptionProps` and an
actual selected `ProductOutput<'legacyAssignments'>[number]`. Its mandatory
`onAdopted` callback must refresh version data. The supplied picker already binds
that callback to real `routineVersion` and `routineSupplement` reads and checks
that the original stays schema1 and the supplement matches the accepted response.
Do not replace it with a no-op. `onClose` is mandatory and wired by the root patch.
No WP08 history callback or source file was changed.

The feature uses frozen `legacySupplementPreview`/`adoptLegacySupplement` and the
existing read seams only. It validates actual assignment identity, source draft
projection, accepted member/branch/version/hash binding and current staff access.
Unknown load/laterality and reviewed/blocked policy start unconfirmed. Known zero
load, other original scalars, identities and order remain fixed. Manual allowlists
are displayed as historical unreviewed provenance and never become reviewed links.
Every eligible directed proposal for a reviewed source is displayed with independent
target dose, requirements/conditions and exact proposal/catalog/source/target hashes.
Submitted confirmations carry the exact displayed proposal hashes; targets and
snapshots remain server-owned. Source-dose and shared-version acknowledgements
are separate, explicit requirements. The shared acknowledgement explains that the
same immutable version can be assigned to other people.

On conflict/not-found the old review is cleared, the preview is fetched again,
and all source/target/shared confirmations reset. A changed source decision also
clears those confirmations. Retryable server/network failures retain current
choices and reuse an exact immutable operation if payload is unchanged. Accepted
adoption is shown once; failed version refresh retries only reads. Current 401/403
or context lifetime abort hides protected source and target content. AccessKey,
account, access revision, branch and assignment changes remount the review.

`sessionBinding` is owner-only actual-record correction and remains WP09's seam.
This staff UI does not call it for another member, edit actuals, fabricate an
accepted v2 revision, replace retained source segments or relabel manual variants.
The full frozen API regression separately covers amendment007 adoption/correction
compatibility; new UI composition must preserve WP09's authoritative binding.

## QA / parent final acceptance

The isolated component smoke passes Chromium/WebKit at 320x740, 430x932 touch and
1440x1000, 72 groups with zero failures/skips. It uses the actual feature, shared
styles and frozen client against synthetic fetch responses. It is not a substitute
for final product browser specs, database authorization or trusted HTTPS.
QA still owns new cross-feature browser specs/fixtures; none was written here.

After root application on the parent's immutable composed head, exercise:

1. Current coach/admin/superadmin selects an authorized historical member and actual
   v1 assignment. Cross-branch/member IDs, inactive actor and revoked branch fail.
2. Original scalars, raw source hash and old manual allowlist are visible; no missing
   load/laterality/policy is guessed. Known zero and all other scalars stay exact.
3. Each reviewed source requires every directed target's own dose/conditions/hash;
   blocking a step suppresses its targets. Repeat the same exercise in two steps
   with different policies, retaining eligibility from the reviewed one.
4. Source-dose and shared-version acknowledgements are both mandatory. Save once;
   original schema1 version/executions remain unchanged, other assigned members
   receive the explicit immutable supplement without mass conversion.
5. Change catalog proposal/source hash between preview and save. Conflict causes
   refreshed preview and renewed confirmations. Test server failure/response loss
   replay, existing supplement display and revocation during version refresh.
6. Close/reopen, member switch and account/branch/host-generation changes never
   render an old selection under new authority. Verify keyboard/focus/status,
   320px overflow and touch controls in the composed layout.
7. WP09 uses sessionBinding for revision-zero and retained corrections after adoption;
   no staff adoption page selects the member's accepted prescription interpretation.

No application main merge, product activation, production/provider/paid call,
credential/security/trust change, force push or new Cloud dispatch occurred.
