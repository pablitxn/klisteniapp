# WP12 v14: completed authenticated Close matrix and logout-race correction

Application source throughout: `a1ade61267506442bea99dd5110d73ed5e503283`.
The accepted parent evidence remains INTEGRATION/v10 at
`2f7e4bd5f8519a85891b76c8c6dca10240c235d6`. Earlier versions and failures remain
immutable. These are real authenticated application/browser journeys with
synthetic task-local PostgreSQL data; the producer's synthetic-transport native
cases remain separate evidence.

| Run | QA source                                  | Scope                                               | Passed | Failed | Timed out | Skipped/unrun |
| --- | ------------------------------------------ | --------------------------------------------------- | -----: | -----: | --------: | ------------: |
| R26 | `217733d14cd773e620c3e2d3a9bb9e4c9aa82447` | SYNC-001/009/012 across Chromium/WebKit320/430/1440 |     15 |      2 |         1 |             0 |
| R27 | `0fcf2dac94f472f64f2adb036eacaf60c3198213` | Corrected SYNC-012, WebKit1440                      |      1 |      0 |         0 |             0 |

Both runs leave zero browser schemas, have no flaky/interrupted results and no
run-level errors. R26's CLI says three failed cases because it includes the one
timed-out result; the leaf ledger preserves the distinction. R26 and R27 overlap
and are not added into a green matrix or used to rewrite the original timeout.

## Completed actual Close coverage

SYNC-001 passes in all six R26 projects. Each cell performs real password
admission and issued-session entry, captures two edits behind a genuine native
CAS write, starts actual `Volver`, and verifies the form stays mounted until
release. It separately delays the existing durable selection's actual readonly
validation callback. A fresh connection verifies both captured values and the
bound pointer; original accepted content and operation list stay unchanged,
status stays draft and explicit completion stays false. The complete case also
reopens, synchronizes, edits offline, reloads, uses actual explicit resume and
verifies the final acknowledged partial record. No completion is inferred from
Close or sync, and no network response or stored document is fabricated.

SYNC-009 passes in the four430px/1440px cells. Its two320px cells finish the
storage-recovery assertions, then retain the original layout failure. All six
cells show actual native quota failure, keep captured quantity3 available, fail
Close visibly, download unconfirmed local work, restore the storage fault, and
use explicit retry to save and close. Native storage then verifies captured
values, unchanged accepted/completion/operation state and the legal pointer
binding. The exported value and retry success are not substitutes for the failed
viewport assertion.

SYNC-012 passes five R26 cells, including the existing void/revocation race and
the new local Close/sign-out barrier. Actual sign-out immediately hides private
UI and aborts the held readwrite transaction before commit; releasing the held
and queued callbacks leaves native generation/content/operations unchanged.
The sixth R26 cell never reaches that new barrier because its earlier fresh-login
setup times out. R27 separately passes the complete corrected WebKit desktop
case, including the barrier. That correction does not relabel the R26 result.

[Native checkpoints](authenticated-close-checkpoints.json) decode the exact
attached observations with each enclosing case's actual status. Aggregate and
per-stage attachments repeat evidence and are not additional passed cases.
The current same-selection adapter validates an already durable pointer; its
generation is a lower bound on the newer document, not an autosave rewrite.
Initial new-pointer and additional navigation variants retain the parent's
separately qualified native evidence; this matrix does not claim all21 of those
component cases ran as authenticated QA journeys.

## Remaining layout defect

The two R26 failed results are the unchanged320px quota error-state check in both
engines. [Native measurements](quota-layout-measurements.json) show Chromium
inner/document/body width345px, and WebKit innerWidth320 with document/body345px.
The measurement was captured before later recovery; the failure remains even
though retry subsequently saves successfully. The error controls retain the
shared nowrap behavior under the training wrapper's width constraint.

WP09 owns this quota-recovery layout request. The separate root history resume
button is already fixed and its real WEEK-008/WEEK-012 journeys pass in both
320px engines in R22. No duplicate history change is requested. QA changes no
application CSS or viewport assertion.

## WebKit desktop timeout is a QA logout/navigation race

The R26 timeout occurs in the existing mid-case `login`, while it waits for the
Email field. Immediately before that, the test clicked actual `Salir` and then
called a helper that performs full navigation to `/app` without waiting for
sign-out to settle. The retained trace records POST `/auth/sign-out` with status-1
(aborted), followed by successful authenticated bootstrap responses. The snapshot
is still the member workspace, not a login form. The new held-write sign-out
barrier has not run yet, so the timeout is not evidence that it failed to cancel.

[Sanitized auth sequence](r26-auth-transition-network.json) includes only path,
method, monotonic time and response status; no headers, cookies, tokens or bodies.
Correction0fcf2da awaits the real sign-out response and visible login form before
the fresh navigation/admission. R27 then passes the entire WebKit desktop case.
It does not skip login, reuse a claimed identity or change the application auth
controller. Immediate privacy assertions in the later barrier remain unchanged.

Read-only review found the same immediate-navigation setup in HISTORY-009,
HEALTH-010 and PROGRAMMING-010. Prospective QA correction
`c17e43671eaa6c083c0516f94c70f6a0037dccb6` adds visible-login waits there. Those
three targeted actor-switch journeys are selected in the next White Label run;
their execution on that source is not claimed by this receipt.

## Verification and continuing work

QA217733d full B2C typecheck, scoped lint and repository boundaries passed;
exact logs are included. The auth-wait changes passed scoped lint, formatting,
whitespace and Pablo Coronel identity checks. The later full/static source
qualification remains separate from these217733d logs. All actual25-file runtime
ledgers match their pinned QA source. Application proof/builds remain the
separately recorded a1ade612 inventory in v13.

Raw reports, exact encoded terminal logs, failure contexts, source proofs and
artifact hash ledgers are committed. Full trace/session bytes stay task-local at
the recorded roots. The existing PostgreSQL client-query deprecation warning is
preserved in raw output and is not counted as a test failure.

R28 continues at a1ade612 and QAc17e436, selecting20 White Label HTTP cells at
Chromium/WebKit430. It includes adoption/invitation, staff history, native Back/
Forward, the three actor-switch setups and actual Close/recovery. No R28 result
is attested here. The runtime is reachable and active; no current test was
interrupted or restarted for these receipts.

Parent has routed completion feedback and quota width to WP09, and health
revalidation plus the approved duration-target fixture gap to Astra. The precise
v11 requests and old-source qualifications remain; no newer classification
changes those assignments. Full feature/mode coverage, trusted HTTPS inputs and
final acceptance remain pending. No sandbox/TLS/admission relaxation, application
feature fix, shared seed/config/manifest edit, real-user/provider data or main
merge occurs. Parent retains orchestration and final acceptance.
