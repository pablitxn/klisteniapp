# WP12 v28: focused WebKit320 reproduction, three passed and two failed

R39 completes all five selected unified HTTP WebKit320 cases on application
`bd30eab5b2a33c3f3e8a7692649632ec85103431`, QA
`5442ab4c3caf9580e309eb9eecb7bec99914f4cf`: three pass, two fail, zero
skipped/never-run/retries, no run-level errors, exit 1. This is a failed focused
wave, not a green acceptance result. It does not relabel original failures.
R34/R35 continue unchanged on original QA1374b94.

HISTORY-005, INACTIVE-001 and PROGRAMMING-007 complete their full assertions with
bounded positive readiness waits. Their original failures remain failed. This
attests corrected cases in unified WebKit320 only; White Label counterpart R40
is separately running and has no result claimed here.

PROGRAMMING-008 and PROGRAMMING-004 reproduce their viewport failures on fresh
isolated fixtures, after preceding functional assertions pass. The existing
viewport predicate is unchanged. Document/body scroll widths are 371px and 359px
at a 320px inner/client viewport. Native visual viewport width is 320, scale 1,
offsetLeft/pageLeft 0 and scrollX 0 in both observations. Root and form/fieldset
containers propagate excess internal scroll widths despite fitting bounding
rectangles. Input/selection-related internal widths also exceed client widths.
The old right-edge-only diagnostic list remains empty.

[Actual native measurements](r39-viewport-observations.json) identify contributing
container/control chains without exposing authentication material. The failures
are reproducible layout acceptance violations; the exact responsible control and
application containment fix remain for PROGRAMMING/INTEGRATION to diagnose. QA
applies no feature fix, clipping workaround or assertion relaxation. The v27 owner
request remains the starting handoff; these measurements strengthen it beyond
the original accumulated full-run fixture.

All 1,218 application files match bd30eab5 and all 26 diagnostic QA files match
5442ab4. Active full-run QA files remain byte-identical to 1374b94. All six exact
R39 schemas were captured and are absent afterward. The global twelve schemas
belong to still-running original full matrices and are recorded truthfully.

Reports/log/error text are sanitized copies. Private-original and published
decoded hashes are recorded; full original traces/screenshots remain task-local.
Cookies, auth headers, private URL tokens, authentication payload fields and the
fixed fixture password literal are excluded from promoted evidence. Statuses and
counts come from untouched original results. Scoped static/identity checks and
readiness/layout source changes are retained in v27.

The White Label public unknown-route defect remains independently confirmed in
v21 and the INTEGRATION PR21 handoff. Trusted HTTPS inputs and canonical Atlas
completion remain outside this receipt. Parent retains orchestration and supplies
an exact accepted application fix head for affected revalidation. No main merge,
provider or real-user action occurs.
