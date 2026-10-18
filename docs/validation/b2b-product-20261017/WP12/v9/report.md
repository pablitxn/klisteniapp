# WP12 v9: completed R16 capped unified diagnostic

R16 completed against application
`00b9f855746a7dd8c8ddfc97991e3a2163fa5ac8` and QA
`127440fa30ca7b0e54048a2ce2003a04edd7725d`. Its selected 528 cells represent
88 original scenario IDs across six native projects. Actual execution reached
the configured 12-failure cap after all 88 Chromium320 cells.

| Actual result                    | Cells |
| -------------------------------- | ----: |
| Passed                           |    76 |
| Failed                           |    12 |
| Unrun, with empty results arrays |   440 |
| Skipped test results             |     0 |
| Interrupted                      |     0 |

The run-level error is exactly `Testing stopped early after 12 maximum allowed
failures.` It is the configured cap notification, not a thirteenth failed test.
Playwright's summary labels the 440 unrun cells as skipped; the leaf-result
ledger explicitly distinguishes them. Chromium430/1440 and every WebKit project
were unrun in R16. Exit1 is preserved. No browser result was retried or rewritten.

Wrapper start/end: 2026-10-17T17:05:44Z / 2026-10-17T17:35:06Z. Reported test
duration is 1761600.831ms. Zero disposable browser schemas remained after teardown.
This is a completed diagnostic, not full browser acceptance. Earlier R13/R14
passes and R15 failures retain their own source pins in [v6](../v6/report.md);
they are not added into R16 totals.

## Failure classification

Every row remains failed in the raw result. Classification guides the next
action; it does not promote any failed cell to passed.

| Scenario         | Observation                                                                                                             | Next owner/action                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| ALTERNATIVES-009 | Missing per-side completion shows no actionable alert; unchanged partial synchronization clears validation feedback     | WP09/root: preserve failed validation before synchronization; keep the assertion                                           |
| ALTERNATIVES-011 | Real reviewed projection has no duration target for the required repetitions-to-time direction                          | CONTRACT/ALTERNATIVES/root: accepted reviewed fixture/provenance or explicit scope reconciliation; no QA-invented relation |
| HEALTH-005       | Explicit trainer reconnect/revalidation shows a generic error and sends no new health request                           | Root/health: reconcile renewed health lifetime with outer request readiness; keep data hidden until validation             |
| PROGRAMMING-004  | QA expected semantically invalid complete dates to save as an incomplete draft                                          | Separate QA correction asserts exact 400 issues and unchanged continuity                                                   |
| ROLES-003        | QA collected role options before the actual invitation form mounted                                                     | Separate QA correction waits for the real control; creation/activation actions still require execution                     |
| ROLES-006        | QA expected an error for a foreign ID filtered within current organization                                              | Separate QA correction asserts empty scoped result plus independent cross-organization denial                              |
| SYNC-001         | QA offline status locator matched root and workout statuses                                                             | Separate QA correction scopes the workout status                                                                           |
| SYNC-008         | Native offline deactivation/reconnect did not reach inactive screen within the existing assertion; sends stay suspended | Root: reproduce membership/stream refresh; later receipt/export assertions were not reached                                |
| SYNC-011         | QA injected failures beyond the configured automatic attempt budget                                                     | Separate QA correction tests recovery within the bounded budget and unchanged payload/operation                            |
| SYNC-009         | Quota handling/retained old bytes pass, final 320px layout measures 345px                                               | WP09/root/UI: repair actual storage recovery layout; preserve quota and width checks                                       |
| WEEK-012         | Below-target completion, additional actual set and adherence pass; final 320px history layout measures 355px            | WP08/root/UI: repair actual history/recovery layout; preserve semantic and width checks                                    |
| WEEK-008         | QA offline status locator again matched root and workout statuses                                                       | Separate QA correction scopes the workout status; late submission/date correction actions still require execution          |

The new WEEK-012 failure occurs after completed semantic assertions. Its screen
contains `Retomar trabajo guardado en este dispositivo` above actual history.
[Native measurements](history-viewport-measurements.json) report
inner/document/body width355 for a requested width320. The root resume control
is an inspection lead; this receipt does not claim a measured single-element
cause. The exact error context and screenshot/trace hashes are retained.

The final WEEK-008 failure occurs immediately after native offline completion,
before reconnection. It reproduces the same two-status strict-locator ambiguity
as SYNC-001. Owned correction
`13ae7f226fff29871a82170c1763e7382db4975b` scopes the real workout status and
passed scoped ESLint, formatting, whitespace and identity checks. It was made
after R16 completed, so R16 still executes only127440f.

Additional rationale, initial error contexts and exact prospective QA commits
are in [v7](../v7/report.md) and [v8](../v8/report.md). The six corrected QA cases
are selected for a separate R17 diagnostic at13ae7f2 against the same unchanged
application. That later run is active and has no outcome attested by this receipt.

## Evidence and remaining acceptance

[Run ledger](run.json) contains every selected cell, exact pins, actual statuses,
run error, times and raw hashes. [Raw Playwright JSON](playwright-r16.json) is
preserved; `playwright-r16.log.b64` decodes to the exact raw terminal bytes.
[QA source proof](r16-qa-source-proof.json) binds 24 actual files and the
[application proof](application-source-proof.json) retains the 948-file source
match. No application file was replaced during execution.

[Artifact ledger](task-local-artifacts.json) hashes all47 retained screenshots,
error contexts and traces. Full trace/session bytes remain task-local under the
recorded root. New weekly error contexts are encoded without byte changes;
earlier failure contexts remain in their immutable v7/v8 revisions. The manifest
is verified against committed Git blobs before publication.

The runtime uses the supported matching official Playwright1.63 image, nonroot
pwuser, pinned seccomp, Chromium sandbox and unchanged admission limits. All
fixtures are synthetic; PostgreSQL is task-local. No TLS or security relaxation
occurred. Trusted HTTPS inputs remain absent. Full matrix/mode coverage, actual
ordinary-Close/durability/failure/revocation journeys on the forthcoming composed
WP09/root candidate, and final combined-head acceptance remain pending. Parent
retains orchestration and shared/application ownership; QA makes no application
fix or main merge.
