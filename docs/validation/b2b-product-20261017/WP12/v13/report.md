# WP12 v13: authenticated narrow history and durable Close checkpoints

All execution here uses application
`a1ade61267506442bea99dd5110d73ed5e503283`, accepted evidence input
`2f7e4bd5f8519a85891b76c8c6dca10240c235d6`. INTEGRATION/v10 was read and normally
merged. Only the accepted upstream resume-control line changed application source
from the previous wave; both consumers were rebuilt. The application inventory
checks 1,216 files with zero mismatches. All prior evidence remains unchanged.

| Run | QA source                                  | Selected scope                                            | Pass | Fail | Skip/unrun |
| --- | ------------------------------------------ | --------------------------------------------------------- | ---: | ---: | ---------: |
| R22 | `43660a9e6cb7b9bcacd133a2f9d18795b6021045` | WEEK-008/WEEK-012, Chromium/WebKit320                     |    4 |    0 |          0 |
| R23 | `43207f582f87cc88c781ea6c3ad6a7152153189d` | Three authenticated Close/recovery scenarios, Chromium430 |    2 |    1 |          0 |
| R24 | `04c238fb8a52d069e9f24d552bcf47267917f624` | Close/reopen diagnostic with bounded wait, Chromium430    |    0 |    1 |          0 |
| R25 | `217733d14cd773e620c3e2d3a9bb9e4c9aa82447` | Complete corrected SYNC-001, Chromium430                  |    1 |    0 |          0 |

Every run has zero remaining browser schemas and no interrupted/flaky results.
R24's single run-level error is its configured one-failure cap notification.
It is not another failed case. No results are retried or rewritten. These
overlapping diagnostics are not added into an accepted matrix.

## Real history journeys confirm the root resume fix

All four R22 cells pass the original complete journeys and final viewport
assertions. WEEK-012 performs actual below-target positive completion with a
ranged-set minimum, verifies an API-arranged extra actual set and unchanged
adherence, then shows history. WEEK-008 performs actual offline completion,
reconnect acknowledgement and chronology checks; its subsequent API-arranged
date correction updates both closed summary revisions and retained excluded work.
Those API fixture actions do not establish separate missing UI-edit variants.

The requested 320px bounds now pass in both engines with the original root resume
control present. These authenticated results independently verify the parent's
wrapping fix; its six synthetic-transport layout/Close cells remain separate.

## Authenticated Close preserves the native document and selection

SYNC-001 now exercises two actual Close barriers inside the complete authenticated
application. Password admission, bootstrap, scoped access, SSE and the real
issued-session action are unchanged. The test performs real native offline and
two UI edits. One round holds the actual native CAS transaction before its write;
the next holds the existing selection's native readonly validation transaction.
Keepalive reads maintain native transaction activity without fabricated data or
transport. Actual `Volver` keeps the editor mounted until release.

Fresh native connections read both captured fields after each departure. Status
remains `draft`, `explicitCompletion` remains false, accepted revision and
operations stay unchanged, and the durable pointer matches the exact document
ID/key/scope/origin with its legal generation lower bound. R24 records generations
6 and 12 with pointer.documentGeneration0. That unchanged pointer is valid under
the existing recovery contract; it does not need an autosave rewrite.

R23 already passes the complete quota/retry/export case and actual sign-out
cancellation case at430px. The quota test retains captured quantity3 after the
native transaction fault, fails actual Close visibly, downloads unconfirmed local
work, restores the fault and uses the actual explicit retry. Fresh storage verifies
the saved quantity, unchanged accepted/completion/operation state and bound pointer.
The cancellation case signs out while the genuine readwrite transaction is held,
immediately hides private UI, observes native abort and preserves the baseline
generation/content/operations after releasing the held/queued callbacks.

[Assertion checkpoints](authenticated-close-checkpoints.json) decode the exact
attached evidence and retain each enclosing case's actual status. Duplicate
aggregate attachments and successful assertions inside a failed case are not
additional passed tests. Full reports and task-local trace hashes support review.

## Retained diagnostic failures and final corrected case

R23 completes both Close storage/selection assertions, but its new intermediate
five-second wait for synchronization after the second reopen expires. A later
actual successful session mutation appears in the retained trace during cleanup.
That does not establish data loss or a permanently frozen form. No application
change was requested from this observation before further verification.

R24 uses a bounded30-second intermediate wait, matching the existing reconnect/
replay backoff rather than asserting an undocumented five-second guarantee. Both
reopen waits settle and both Close checkpoints pass. The case then fails because
QA's broad offline-status expression matches both the actual offline status and
the newly recovered-draft notice. That is a QA locator ambiguity.

R25 narrows only that locator to the complete actual offline status text. The
entire SYNC-001 case passes: both delayed Close barriers, durable values/pointer,
successful reopen synchronization, subsequent native offline edits, hard reload,
actual explicit resume, original retained values and final server acknowledgement
as partial with `explicitCompletion:false`. The original final reload/value/status
assertions are retained. It uses no direct completion write or fabricated pointer.

The earlier R21 pointer equality failures remain in v12. Neither those nor the
R23/R24 diagnostics are retroactive passes. The final QA changes passed scoped
lint/format/whitespace/identity checks; full B2C typecheck and boundaries are being
checked again while the next matrix runs, so their later result is not asserted
by this checkpoint.

## Remaining scope

R26 selects the three authenticated Close/recovery IDs across all six native
Chromium/WebKit320/430/1440 projects at QA217733d and the same application source.
It is active; this receipt claims no R26 result. The quota case preserves its
original narrow error-state viewport assertion, even if later retry succeeds.
Its known320px layout defect is still an owner request, not an allowed skip.

Completion feedback, health revalidation and the reviewed duration-target gap
retain the precise v11 requests and qualifications. Full mode/feature coverage,
trusted HTTPS and final acceptance remain pending. Runtime containers are active
for R26, use the existing sandbox/CA/admission policy and synthetic PostgreSQL,
and will be cleaned up after execution. Parent retains orchestration and final
merge/acceptance; QA makes no application feature or shared config/manifest fix.
