# WP12 v27: WebKit320 programming layout investigation

Owner investigation requested from PROGRAMMING/INTEGRATION while both original
full matrices continue. This is an unresolved application/browser layout failure,
not a diagnosed CSS cause or a passing acceptance result. No application fix is
made by QA, and no viewport assertion is weakened.

## Exact original failures

Application `bd30eab5b2a33c3f3e8a7692649632ec85103431`, accepted integration
evidence `89409dcdbd4faedccfeec8ee236932191c6195d3`, full-run QA
`1374b94ed441365789d2756742afa8306022c0a0`. R34 unified HTTP, WebKit320,
320x740 with touch/mobile enabled, zero retries and no failure cap:

| Scenario                                          | Actual final viewport observation             |
| ------------------------------------------------- | --------------------------------------------- |
| PROGRAMMING-008 period impact/apply               | innerWidth 320; document/body scrollWidth 368 |
| PROGRAMMING-004 invalid dose/date/stage rejection | innerWidth 320; document/body scrollWidth 366 |

Both complete their preceding functional/API assertions, then fail the existing
five-second viewport predicate. PROGRAMMING-008 applies the reviewed period
change, verifies the incremented revision, preserved slots and original session
revision, and checks the actor/revision audit before its viewport failure.
PROGRAMMING-004 reaches its final viewport check after the invalid-input and
period/stage rejection assertions. These outcomes remain failed.

[Exact measurements](observations.json) and sanitized encoded error contexts
retain those observations. The recorded list of elements whose bounding right
edge exceeds innerWidth is empty in both cases. The final viewport screenshots
visually fit their current lower-page view. This limits the diagnosis: internal
native control overflow, retained browser scroll range and application containment
have not yet been distinguished. QA does not identify a responsible element or
claim a verified feature fix. Full private traces/screenshots remain local;
their hashes and paths are retained without promoting authentication material.

## Reproduction and safe next step

The actual original execution is the complete 528-cell unified configuration,
which reaches these cases after the earlier scenarios on each project's isolated
two-brand/four-branch fixture. From apps/b2c-web, with the already supported
sandboxed WebKit runtime, registered disposable PostgreSQL fixture and built B2B
consumer, its command is:

```sh
node node_modules/@playwright/test/cli.js test \
  --config=playwright.b2b-product-unified.config.ts \
  --timeout=180000 --reporter=list,json
```

The test database environment is task-owned, loopback and disposable; no database
URL, password, session cookie or invitation token is included here. No browser
sandbox, TLS verification, admission or privacy guard is relaxed.

Focused R39 is running separately on unchanged application bd30eab5 with QA
`5442ab4c3caf9580e309eb9eecb7bec99914f4cf`. It selects PROGRAMMING-004/007/008,
HISTORY-005 and INACTIVE-001 in unified WebKit320. Its outcome is pending at this
receipt. Fresh-fixture deterministic reproduction is not claimed. New diagnostic
fields capture native visual viewport/scroll position and internal element
scroll widths after an actual failure; the existing predicate still fails
unchanged. All 26 active R34/R35 QA files still match 1374b94. All 1,218 diagnostic
application files match bd30eab5, and all 26 diagnostic QA files match 5442ab4.

Inspect native date/select controls and the period/stage containers in
PeriodImpactEditor.tsx, StageScheduleEditor.tsx and programming.css at the pinned
application. Constrain any confirmed responsible control within its real
container while retaining full values, keyboard/touch operation and the semantic
period/history assertions. The new measurements should first establish whether
the document has a real horizontal scroll range despite fitting element bounds.
Parent supplies an exact accepted application fix head before revalidation.

## Separate readiness failures

R35 HISTORY-005 and INACTIVE-001 fail the old five-second post-password
organization-selector readiness assertion while the workspace is still loading.
The existing bounded 30-second positive readiness correction is present in R39;
these full cases have not yet passed on that prospective source. They remain
original failed outcomes and are not classified as lost history or inactive
access failures merely from a loading snapshot.

R34 PROGRAMMING-007 fails its positive original-routine-history region assertion
while the lazy history route is still loading. Its new case-local positive wait
is bounded at 30 seconds; the exact original routine ID and historical equality
assertions remain. Immediate privacy/denial assertions are unchanged. The retained
timeline records the real asset/access request sequence, and corrected complete
execution is pending in R39. Scoped ESLint, B2C typecheck, formatting, whitespace
and effective Git identity checks pass on both new owned QA changes.

The previously confirmed White Label INACTIVE-003 public unknown-route defect
also reproduces in WebKit320. Its original owner request remains v21 and the
explicit INTEGRATION PR21 handoff; it is separate from this unresolved layout
investigation. Both full 528-cell runs continue unchanged. No full acceptance,
application merge, provider, real-user or canonical Atlas completion is claimed.
