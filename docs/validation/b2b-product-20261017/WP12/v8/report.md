# WP12 v8: continuing R16 diagnostics and separate QA corrections

Application: `00b9f855746a7dd8c8ddfc97991e3a2163fa5ac8`.
Executed QA: `127440fa30ca7b0e54048a2ce2003a04edd7725d`.
Parent input/evidence: `5865824f8baefeb38cd97951f6a4b43d7c5506d2`,
INTEGRATION/v8. R16 continues unchanged under its original failure cap. This
checkpoint does not attest a completed matrix or execution of later QA edits.
Prior v1-v7 evidence remains immutable.

## Additional application failures requiring owner review

SYNC-008 performs native offline, edits a real owner workout, deactivates the
membership through the authorized synthetic staff fixture, then returns online.
Within the existing five-second assertion the inactive heading never appears.
The actual screen retains the training form and shows connection validation
pending, suspended sends, a failed synchronization notice and owner local export.
The assertion is unchanged. The retained form is not proof of an unauthorized
accepted write. The test fails before checking denied receipts and downloading
the recovery file, so those later actions are unexecuted in this cell.

Root should reproduce reconnect and inspect the outer stream's readiness and
membership refresh. The [sanitized network projection](inactive-reconnect-network.json)
contains path/method/status only. This checkpoint does not infer an arbitrary
reconnect service-level guarantee, bypass authority checks, or claim that the
new ordinary-Close amendment fixes this separate observation.

SYNC-009 successfully reaches the injected native IndexedDB quota failure,
shows the storage warning, retains the actual quantity, verifies no new accepted
server actuals, and reads the exact opaque historical bytes after migration.
Its final unchanged 320px assertion fails: actual inner/document/body width is
345px. See [native measurements](quota-viewport-measurements.json).
The quota state includes a long local recovery button; `workout.css` constrains
button width while the shared `.button` style uses `white-space: nowrap`.
That is an inspection lead, not an independently measured attribution to one
element. Preserve the storage and viewport assertions. The app/UI owner should
repair the actual error/recovery layout and rerun 320px in both engines.

The separate ALTERNATIVES-009 lost completion feedback, HEALTH-005 explicit
revalidation failure and missing reviewed duration-target direction remain
documented in [v7](../v7/report.md). No application feature code is changed by QA.

## Diagnosed QA assumptions, preserved in the original run

The following failures are retained as failures in R16. The later source changes
are prospective corrections, not retroactive passes:

| Scenario        | Executed failure                                                                                               | Prospective correction                                                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PROGRAMMING-004 | Expected saving a fully reversed/overlapping date interval as an incomplete draft to succeed                   | Assert actual 400 `INVALID_INPUT` with precise stage/field issues; an incomplete draft remains saveable, invalid assignment remains blocked, and member continuity must remain unchanged |
| ROLES-003       | Read native options before the invitation form mounted                                                         | Await the actual role control before collecting options for superadmin/admin; preserve actual creation, activation and fresh acceptance actions                                          |
| ROLES-006       | Expected a foreign resource identifier filtered within the current organization to return an error             | Require a successful empty result and `no-store`, then independently require denied cross-organization scope; preserve keyboard, focus, Escape and payload-omission assertions           |
| SYNC-001        | Broad status locator matched both root connection and workout offline status                                   | Scope the actual offline status to `.workout-session`; preserve values, reload and server partial assertions                                                                             |
| SYNC-011        | Injected three failed attempts and expected a fourth automatic send beyond the configured three-attempt budget | Inject two transient failures, then require the third real acknowledgement, unchanged operation/payload, nonzero bounded backoff and one accepted revision                               |

The contract requires bounded retry/backoff, not unlimited automatic attempts or
a specific minimum number. At the executed application source,
`useProductTrainingSession.ts` stops automatic scheduling when `retryCount >= 3`.
The SYNC-011 failure therefore does not independently prove broken retry behavior.
Its unchanged failed result remains in R16; the corrected scenario must execute
again before receiving a pass.

`a05638470e767a5c1f93e13bd567ef39eb082244` contains the first four corrections
and a same-origin assertion before following an actual invitation URL.
Scoped B2C typecheck, three-file ESLint, formatting, whitespace and Pablo Coronel
Git identity checks passed. An initial typecheck found an incorrect endpoint key
in the unpublished edit; it was replaced with the frozen `continuity` endpoint
before commit. No contract endpoint was invented or changed.

`5b692449dbc17a8d30f7684906427b0097d8d1c9` contains the two retry-budget literal
changes. Its scoped ESLint, formatting, whitespace and identity checks passed;
the preceding broad typecheck was on a056384. Preparation inventory validation
and repository boundary checks also pass. The inventory's original blocked
metadata describes preparation intent, not a new Playwright outcome.

## Remaining work

The accepted composed ordinary-Close fix has not been provided to this QA wave.
After that exact input arrives, extend the existing real-route scenarios with
pending captured edits and normal Close, native durable selection, visible
storage failure/retry/export and immediate revocation cancellation. These actions
must preserve actual IndexedDB transactions and real UI behavior. Owner native
component results do not substitute for those browser journeys.

R16 must finish or reach its configured cap with raw results and artifacts
preserved. Its runtime still uses the matching pinned Playwright1.63 container,
nonroot user, Chromium sandbox, seccomp and synthetic PostgreSQL. No runtime or
application files are replaced during the run. Trusted HTTPS remains separately
blocked by absent trusted certificate inputs. Full unified/WL coverage, remaining
UI variants and final combined-head acceptance are pending; no main merge,
production/provider/real-user action or security relaxation occurs.

[Failure snapshot](failure-snapshot.json) binds exact source and retained artifact
hashes. Encoded error contexts preserve bytes; full traces remain task-local
because they contain transport/session state. Parent retains orchestration and
feature/shared-file ownership.
