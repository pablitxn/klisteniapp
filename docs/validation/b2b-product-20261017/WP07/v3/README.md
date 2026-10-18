# WP07 v3: explicit legacy reviewed-adoption UI

Frozen candidate and amendment007 binding:
`efbed2dd1c7ed06092463a3eec4531c2a3e10075` (PR21).
Source `1fb3ab34c95780fb4a1cd8711dcde31820fc623a`, isolated branch
`feat/b2b-legacy-adoption-ui-v1`. Plan `447d77ebb5587e319018e7b56003f0ef7299bb6c`,
Atlas `ce45d206a2ed4035f8003a3303abd1fff98e09b8`. This receipt adds adoption
completion; previously published WP07/v1-v2 remain unchanged. Freeze v3 on first
publication; corrections require a successor. Parent retains final composition,
monitoring and application merge authority.

## Delivered behavior and boundaries

Five new feature modules/CSS implement a deliberately explicit review for one
actual selected v1 assignment. The picker reads current authorized history subjects
and assignments rather than manufacturing IDs from routines. It checks scope and
includes authorized historical inactive targets. The review displays the original
scalars, manual-variant provenance and raw source hash. It confirms unknown load,
laterality and reviewed/blocked policy without inferring defaults. Known load,
including zero, all other scalar doses, step identities and order stay fixed.

Every currently eligible directed target for reviewed sources displays its own
dose, requirements/conditions and exact relation/catalog/source/target hashes.
Each target is explicitly acknowledged. Source-dose and shared-version confirmations
are separate; the latter explains the effect on every assignment of this same
version. The POST carries only frozen typed source steps and exact displayed hashes;
server-owned snapshots/target doses are never submitted by the client. No manual
allowlist is reclassified as reviewed and no actual record is changed.

Conflicts clear the stale review, refresh the preview and require every confirmation
again. Network/server retry preserves an unchanged operation ID; changing payload
creates another operation. Acceptance replaces the form with the saved result and
refreshes actual immutable version/supplement reads. Existing supplements are not
readopted. Failure of post-acceptance refresh retries reads only. Revocation or
scope changes hide old data. No automatic or bulk conversion is offered.

New production files live only under `features/programs/legacy-adoption/**`.
Dedicated tests/harness live under `apps/b2b-web/tests/legacyAdoption*` plus a harness
build script; the isolated browser runtime driver lives in this evidence directory.
No root/navigation, history/WP08, session/WP09, API, contracts, SQL, manifests,
lockfile or export barrel changed. `sessionBinding` remains the owner-only correction
seam for WP09; staff adoption does not replace that retained prescription binding.
[Owner requests](owner-requests.md) supplies the exact apply-checked root-only patch
and final-composed QA scenarios.

## Actual validation

Node 24.19.0 / pnpm 12.7.0 with frozen dependencies; disposable task-owned loopback
PostgreSQL 17.11. Browser runtime uses the documented official Playwright 1.63.0
image by immutable digest, Node 24.20.0, Chromium 153.0.8010.12 and WebKit 26.6.
No installed 1.62 helper was substituted or modified. Package/runtime hashes,
source files and raw/published log hashes are in [evidence.json](evidence.json).

| Check | Final result | Evidence |
| --- | --- | --- |
| Contracts | 22 pass, 0 fail/skip | [log](contracts.log) |
| Domain | 34 pass, 0 fail/skip | [log](domain.log) |
| B2B web | 200 pass, 0 fail/skip, including 15 new dedicated cases | [log](web-final.log) |
| Full B2B API | 236 pass, 0 fail/skip on disposable synthetic PostgreSQL | [log](api.log) |
| Root typecheck | 14/14 pass | [log](typecheck-final.log) |
| Root lint, boundaries and full B2B format | 14/14 plus boundary/format pass | [log](lint-final.log) |
| B2B build | pass, existing large-chunk warning | [log](build-final.log) |
| Isolated component browser | 6 profiles, 72 groups pass, 0 fail/skip | [results](browser-final.json) |
| Effective Git identity | author/committer Pablo Coronel `<git@pablocoronel.com>` | [guard](identity.log) |
| Atlas engineering content check | 176 reviewed files pass; human English/provenance review still required | [log](atlas-content.log) |
| Source/staged diff whitespace, root patch check, runner syntax | pass | explicit prepublication checks |

**492 final suite tests passed with zero failures/skips**, plus **72 component
browser groups** across six profiles. Iteration runs are not added to those totals.
The source layout/driver correction after the first commit changes no API, contract
or domain source/tests; their completed results remain applicable. Final web and
static checks run on final source; Turbo reuses unchanged validated tasks as shown
in the logs. Fifteen new unit/component cases cover immutable scalar/provenance
preservation, zero/unknown load, all required confirmations/hashes, operation retry,
conflict reset, actual assignment/scope checks, saved/revoked states and accessible
rendered labels/IDs. Six-profile browser smoke exercises the actual component,
shared styles and frozen typed client with synthetic fetch responses.

| Engine | Touch/mobile | Desktop | Result |
| --- | --- | --- | --- |
| Chromium 153 | 320x740, 430x932 | 1440x1000 | 36 groups pass |
| WebKit 26.6 | 320x740, 430x932 | 1440x1000 | 36 groups pass |

The browser groups cover labels, keyboard number entry/focus/Tab, 44px controls,
expanded hashes/no overflow, actual assignment selection, confirmation gating,
shared-version acceptance, original preservation, refreshed version reads, changed
proposal conflict/new hash, server failure and exact lost-response retry, revoked
POST/refresh/lifetime, pre-existing supplement, foreign preview and explicit block.
All profiles assert zero unhandled component page errors. Screenshots for all six
profiles are under [screenshots](screenshots); mobile images were visually reviewed.

Browser and static component server run together as UID 1001 in a network-none,
read-only-harness container. The process has zero effective capabilities and
no-new-privileges. Chromium sandbox is explicitly enabled; TLS verification is
not bypassed. This is local HTTP component testing with mock transport, not a
full-product browser/DB/auth/host assertion or physical Safari/iOS validation.
Root composition and final application QA remain pending the owning integrator.

## Failures, recoverable fixes and limits

The initial six-profile run had 71 passed groups/1 failed/0 skipped: WebKit 320's
native select leaked the long policy option beyond its bounds. DOM diagnosis
measured 341px document width for a 320px viewport while element rectangles stayed
bounded. Grid constraints alone did not repair it. Shortening the redundant option
to the existing policy meaning, while preserving the complete all-target explanation,
fixed the overflow without weakening the assertion. The focused WebKit 320 rerun
passed 12/12 and the final complete matrix passed 72/72. Initial/diagnosis/focused
JSON and a before screenshot are retained beside final evidence.

The first full API run used a task-owned database name accepted by general guards
but rejected by WP05's exact `klisteni_b2b_test` requirement: 206 passed/30 failed/
0 skipped. Its [failed run](api-initial-database-name.log) is retained. A new database
with the exact required name inside the same disposable container produced 236/236;
no guard or product/test code was relaxed. The initial lint run rejected the browser
runtime driver's `/harness` imports when it lived under app tests. Moving that
standalone artifact into this task-owned evidence runtime fixed the declaration
scope; manifests/boundary policy stayed unchanged. The [initial lint log](lint.log)
and passing final log are both preserved.

Terminal whitespace and blank EOF lines were normalized before first evidence
publication; evidence.json records both raw and published hashes. No substantive
failure/output was rewritten. Browser screenshots/JSON retain exact output bytes.
The additive evidence commit contains no implementation change.

No final moving-parent-head, integrated root-navigation/browser, trusted HTTPS/
Secure-cookie, screen-reader certification, physical device, provider, Yoga/content,
full-build or deployment acceptance is claimed. The full API suite validates the
frozen candidate's server binding/authorization separately from this mock-transport
component evidence. Parent will compose the root patch and run shared QA specs.
No production activation/migration, real user/health data, paid/provider call,
credential/security/trust change, application main merge, force push or new Cloud
dispatch occurred. Task PostgreSQL/browser containers were removed after validation;
only public task caches/artifacts remain.
