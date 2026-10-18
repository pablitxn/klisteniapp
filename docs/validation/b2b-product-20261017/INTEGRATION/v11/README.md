# Integration v11: health readiness and explicit duration fixture

Executable QA candidate: `bd30eab5b2a33c3f3e8a7692649632ec85103431` on
`integrate/b2b-product-v1`, draft [PR21](https://github.com/pablitxn/klisteniapp/pull/21).
This receipt is additive; earlier failed and successful evidence remains unchanged.

## Inputs and changes

- Prior executable `a1ade61267506442bea99dd5110d73ed5e503283`, evidence
  `2f7e4bd5f8519a85891b76c8c6dca10240c235d6`.
- QA PR32 read at `7e6242c3b5d3d6e2f69d27eead2db0083c6f6286`, including
  WP12/v9 and the detailed v7/v8 HEALTH-005 and ALTERNATIVES-011 observations.
- WP09 PR26 exact head `d781a3b03eafd4efb531771f5e69271a8365813a`
  (code `86d87e77754c82772543502b9711f25afe161fb8`) merged normally at
  `0fd9dddae87443acf5da57253ad3df8da7f16d97`. Completion-validation feedback
  survives unrelated synchronization; recovery buttons wrap at 320px.
  Its original producer evidence remains in [WP09/v8](../../WP09/v8/README.md).
- Health commit `a454761` threads actual outer stream readiness to the trainer
  gate. A private health controller mounts only when workspace and target consent
  streams are both ready. The people loader refreshes on readiness changes,
  recovering when the section was entered offline. Context/editor identity,
  request guards, consent invalidation and stream admission limits are preserved.
- Fixture commit `bd30eab` adds an independently synthetic timed prescription only
  to fresh activated test seeds. Primary-branch manifests are separate from the
  existing secondary-branch `resources.v2` records. Production catalog, projector,
  schemas, migrations, API eligibility, dependencies and lockfiles are unchanged.

The root resume-button wrapping and durable Close/navigation work are retained.
No QA-owned scenario was edited. Atlas remains
`ce45d206a2ed4035f8003a3303abd1fff98e09b8`; app main remains
`d65261d18de4522fb9a66104aabb5750104fb8b8`.

## HEALTH-005 reproduction and repair

[Chromium](health/chromium-4.log) and [WebKit](health/webkit-3.log) each execute
five cases at 320px: one frozen baseline reproduction and four patched cases.
Both use a real progressing clock, actual ProductViews/useProductStream, health
controller/client, native offline transitions, and loopback HTTP/SSE fixtures.

The frozen a1ade612 baseline renews target consent before held outer workspace
revalidation finishes. The controller displays a generic error without sending a
new health GET. Releasing outer authority leaves that failed controller mounted.
This reproduces the reported readiness race without freezing the calendar clock.

With the patch, the target stream may become ready first, but neither health data
nor its read action appears until outer admission succeeds. Release triggers a
fresh health GET and displays the new projection. A delayed pre-offline response
and the prior projection remain hidden. Separate outer-authority refusal and
target-stream403 cases produce no new health GET and keep private data hidden.
Entering shared health while offline also recovers its selector after admission.
All ten case records pass with zero browser page errors; these are two baseline
records plus eight patched records, not ten full authenticated QA journeys.

Harness source is in [health](health/), with the exact frozen ProductWorkspace
source and before/after bundle hashes in [source-proof.json](source-proof.json).
To reproduce, copy the harness to `/tmp/b2b-health-readiness-v11`, adjust the
explicit repository/runtime paths if needed, build the frozen a1ade612 checkout
first and retain its dist as dist-before, then build the candidate and run
`bash run.sh chromium` and `bash run.sh webkit`. The same actual components are
used; the harness supplies synthetic authority/health responses, not a provider
or backend-authentication bypass.

Playwright1.63 uses Chromium153.0.8010.12 and WebKit26.6/revision2359 with matching
Ubuntu24 libraries. Nonroot pwuser, seccomp and no-new-privileges are retained;
Chromium's command line is checked for absence of --no-sandbox. The cached1.62
image provides OS libraries/Node only, with exact1.63 driver/binaries mounted.
Loopback is natively a secure context. No TLS, online-state, crypto or sandbox
property is overridden. Docker bridge networking permits native online state;
application requests target the local synthetic server only.

Initial attempts are retained: network-none made the native browser offline
before any request; a later harness locator incorrectly required an exact label
whose wrapped option text extended its accessible name. The final unique actual
combobox locator selects the same real control. These setup failures are not
counted as application passes. No browser assertion about privacy or readiness
was removed.

## ALTERNATIVES-011 provenance and QA handoff

Canonical data still contains **37 exercises and42 directed relationships**, with
no reviewed duration target. The new fixture reuses the real
`calf-raise → single-leg-calf-raise` pair and exact exercise hashes/revision, but its
2sets ×20–30seconds per side,90seconds rest,bodyweight dose is an independent
synthetic test prescription. It is not inferred from source repetitions or load,
and has no editorial/clinical dose-review claim. The routine, relation and dose
carry the explicit synthetic disclaimer; copied source/review-date claims are
removed. No synthetic relation is inserted into the canonical relation table.

[QA handoff](duration/qa-handoff.md) specifies the manifest and normal API flow.
For ALTERNATIVES-011 only, select `resources.reviewedDuration` by actual
organization **and primary branch**, read the issued `routineVersion`, verify its
hash/provenance, then prescribe through normal enrollment. Preserve the original
unit/set/rest/side, partial/explicit-completion, immutable routine/goal and viewport
assertions. Do not republish this fixture through the canonical catalog helper:
normal catalog publication correctly still has no reviewed timed prescription.

[Six focused tests](duration/test.log) pass using unchanged schemas/domain and
catalog eligibility code. [Three composed tests](duration/composed.log) pass:
actual unified HTTP, white-label HTTP, and inactive foundation. They verify
scoped frozen reads/listing, secondary-branch404/unlisted behavior, normal trainer
goal/enrollment/occurrence issuance and member timed partial/explicit-completed
saves preserving original actuals. Missing-side, forged-dose and unconfirmed
requests return400; routine and goal remain immutable. Historical preservation
hashes match and original secondary routines retain six occurrences each.
Inactive seeds create no duration fixtures. The initial Monday-only test-stage
setup failure is retained separately; its corrected full-week setup is explicit.

The fixture resolves synthetic contract/UI coverage. Real reviewed timed catalog
recommendations remain absent and would require editorial/product review before
any production catalog change. That future decision does not block this test.

## Combined checks and remaining acceptance

- **299 web tests pass, zero skipped/failed**, on the composed code
  ([log](health/web-final.log)).
- **21 composed native Chromium departure cases pass**, zero page errors, after
  rebuilding the unchanged v9/v10 runner against this candidate
  ([log](health/departure-21-final.log), [source](departure/)). They cover actual
  section/brand/public/Back/Forward/same-view departures, slow/failing local writes
  and selection, conflict, revocation, offline revalidation and invitation routes.
  The initial attempt to execute its non-executable shell file directly returned126;
  invoking it with bash succeeds. No application fix was needed for that attempt.
- Root typecheck14/14, lint14/14 plus repository formatting/boundary checks, and
  build16/16 pass. Cached unaffected tasks are identified in the raw logs; both
  consumer builds execute. Existing chunk-size warnings remain.
- Owned formatting/whitespace and four-script ESLint pass. No package installation
  or lockfile change is needed. Source proof inventories1243 tracked source files;
  this is byte provenance, not a claim that every file has a new runtime test.

Counts across prior receipts and producer runs overlap and are not additive.
These checks do not replace QA's authenticated final-candidate HEALTH-005,
ALTERNATIVES-011, completion-feedback and viewport journeys. Full browser/mode
coverage, trusted HTTPS and physical acceptance remain pending. Earlier QA failed
cells retain their actual statuses. Supported JSON health import and the adapter
boundary are unchanged. Prior Yoga/model/Blender limitations remain qualified.

All new data is synthetic in disposable local/dev schemas. No main merge,
production activation/migration/deployment, real-user or external health access,
paid service, credential/trust change or history rewrite occurred. Parent retains
Cloud orchestration and final acceptance. There is no new implementation blocker;
QA must adopt the explicit fixture manifest and run the exact combined candidate.
