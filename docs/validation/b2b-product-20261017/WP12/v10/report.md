# WP12 v10: audit/reload classification and advancing-clock reconciliation

The executor remains reachable after the platform's17:39 disconnect notification.
Safe filesystem/Git reads, sandboxed native browser execution, commits and pushes
continued; completed run evidence was not lost. Application source remains
`00b9f855746a7dd8c8ddfc97991e3a2163fa5ac8` throughout these independent runs.

| Run | QA source                                  | Scope                                                            | Pass | Fail | Unrun |
| --- | ------------------------------------------ | ---------------------------------------------------------------- | ---: | ---: | ----: |
| R17 | `13ae7f226fff29871a82170c1763e7382db4975b` | Six corrected cases, unified Chromium320                         |    3 |    3 |     0 |
| R18 | `386e2de020a186d29e53cd2afa66ea35bd8063d6` | Actual invitation and explicit local resume, unified Chromium320 |    2 |    0 |     0 |
| R19 | `63d0b51f6199cee31137d92859d90d2ac91d59dd` | Advancing-clock reconnect, unified Chromium/WebKit320            |    2 |    2 |     0 |

All three runs have zero skipped/interrupted results, no run-level errors and zero
remaining browser schemas. [Separate ledgers](runs.json) preserve their exact
results and source; these counts are not added to R16 or earlier runs.

## Keyboard audit: QA response assumption, corrected browser case passes

R16 ROLES-006 passed the initial actual drawer opening/focus and payload-omission
assertions, then failed because QA expected an error for a foreign resource ID
filtered within the current organization. The actual service deliberately
returns only matching organization/branch audit rows. A200 empty result does not
disclose the foreign resource.

R17's corrected case requires that empty result with `no-store`, independently
requires denied foreign organization/branch scope, then performs actual Escape
and verifies focus returns to the original trigger. It passed in Chromium320.
This was a QA contract expectation failure; it does not establish a keyboard
accessibility or tenant-isolation defect. Broader native matrix execution is
still required on the final combined head.

## Offline reload: actual explicit resume succeeds

After narrowing the ambiguous offline status, R17 SYNC-001 reached a truthful
history page with `Retomar trabajo guardado en este dispositivo`. QA incorrectly
expected automatic reopening of the workout. The accepted root flow provides
an explicit new/resume choice.

R18 clicks that actual resume control after reload, verifies quantity3 and the
original local note, reaches acknowledged synchronization and verifies the
server record remains partial with `explicitCompletion:false`. The case passed.
No direct API write, fabricated selected pointer or browser-store injection
substitutes for the resume action. This failure was an outdated QA flow
assumption; R17 did not show lost local data.

R17's remaining ROLES-003 failure also came from QA readiness. Selecting the
work context publishes the selected value before asynchronous access admission
and persistence finish. Immediate full navigation aborted that request and lost
the optional selection. The helper now observes the actual selected-context
access response and mounted authorized navigation before departing. R18 then
passes the complete actual invitation form, grants, activation and fresh same-tab
acceptance flow, including supported/denied role boundaries. Native account
identities and the actual form/write remain in use.

## Correction to the earlier workout reconnect classification

The original `showWeek` helper used Playwright `clock.setFixedTime`. The locked
1.63 API explicitly keeps `Date.now()` fixed while timers continue. The actual
application's `ProductStreamRetry` stores retry deadlines in `Date.now()` units;
`remaining()` cannot expire while QA freezes that clock. `startWorkout` invokes
`showWeek`, so this affects SYNC-008 and the later R17 WEEK-008 reconnect failure.

The earlier v8/v9 observations remain accurate failed outcomes, but their root
owner-review classification was premature. Corrected R19 execution confirms the
QA clock caused those reconnect stalls. No application guard/backoff relaxation
is needed for that reproduction. The failed results remain immutable.
HEALTH-005 does not invoke this calendar helper and
still needs its separate readiness/lifetime investigation. Layout failures and
missing completion feedback likewise retain their original assertions.

QA correction `63d0b51f6199cee31137d92859d90d2ac91d59dd` uses native
`clock.setSystemTime` to offset the displayed calendar while wall time advances.
A standalone sandboxed native Chromium diagnostic on the actual installed1.63
runtime measured Date.now1755518400004, then1755518400308 after300ms, then
1755518400326 after reload. This establishes the clock primitive only, not a
product pass. The helper's scoped lint, formatting, whitespace and effective Git
identity checks passed. The preceding full B2C typecheck passed on386e2de.

R19 separately executes SYNC-008 and WEEK-008 in Chromium320 and WebKit320 at
63d0b51. Both SYNC-008 cells pass actual inactive transition, stale receipt denial
and owner local recovery export. Both WEEK-008 cells reach accepted late offline
completion, performed/received timestamps, actual date correction, updated closed
week revisions/counts and the retained excluded-work history. They then fail the
unchanged final320px layout assertion. This is two passed cases and two failed
cases, not four passes.

The [native measurements](r19-history-viewport-measurements.json) now identify the
actual root resume button in WebKit: `Retomar trabajo guardado en este dispositivo`
has right354.9375px and width336.9375px at innerWidth320; document/body width355.
Chromium expands inner/document/body width to355. This corroborates the earlier
WEEK-012 history layout failure with a specific measured element. Root/UI should
allow this actual control to wrap and fit the narrow container; QA leaves the
viewport assertion intact. No API completion write replaced the offline action.

## Remaining work and evidence

R17's immutable error contexts and task-local artifact hashes are retained with
raw reports and exact encoded terminal logs. R18's raw report records the two
successful actual journeys. R19 adds both-engine reconnect results and exact
layout diagnostics. All three 24-file ledgers match their executed runtime.
No application file, manifest, seed registration or shared config is changed.

The parent has not supplied the forthcoming composed WP09/root normal-Close
candidate to this wave. Actual route Close with delayed captured edits, durable
selection, storage error/retry/export and immediate revocation cancellation
remains a separate required extension after that exact head. The current
diagnostics do not attest that fix, full matrix/mode coverage, trusted HTTPS or
release acceptance. After all three runs reached zero remaining browser schemas,
the dedicated browser/PostgreSQL containers and network were removed and verified
absent; [cleanup evidence](runtime-cleanup.json) records the exact names. Host raw
reports, copied artifacts, source snapshots and dependencies remain available for
the later wave. All fixtures are synthetic, security/TLS/admission policy is
unchanged, and parent retains orchestration and final acceptance.
