# WP12 v17: completed independent HTTP waves R29 and R30

Both runs use application `a1ade61267506442bea99dd5110d73ed5e503283`, accepted
integration evidence `2f7e4bd5f8519a85891b76c8c6dca10240c235d6` and unchanged QA
`c17e43671eaa6c083c0516f94c70f6a0037dccb6`. R28's 20/20 receipt and earlier
failures remain immutable. These waves do not attest the newly supplied bd30eab5
application candidate.

| Run | Mode             | Projects                | Passed | Failed/timeouts/skipped/unrun | Run errors |
| --- | ---------------- | ----------------------- | -----: | ----------------------------: | ---------: |
| R29 | White Label HTTP | Chromium1440, WebKit320 |     16 |                             0 |          0 |
| R30 | Unified HTTP     | Chromium320, WebKit1440 |     16 |                             0 |          0 |

Each CLI exits 0 with no flaky or interrupted results. The runs remain separately
identified, not added to an unrelated or final acceptance total. Eight scenario
IDs run in four new contexts: WEEK-001/002/007, HISTORY-001, HEALTH-002/004 and
INACTIVE-004/008. All 32 cells were never run on this exact application in the v16
completed-receipt ledger, and are disjoint from R28 and active R31.

The real application/API and authenticated browsers exercise 4/3/1 accounting,
partial status, enrollment timezone/DST boundaries, history states, scope and
consent denial, cross-tab revoke/in-flight response privacy, owner export and
reactivation without automatic replay or restored health consent. Tests arrange
historical records/periods and mutations through actual accepted APIs where
specified; this receipt does not relabel API-arranged completions as clicks on
the explicit-completion UI. Actual displayed states, normal downloads and browser
privacy/navigation assertions remain in use. No transport response is mocked.

## Source and cleanup evidence

Both actual 25-file runtime ledgers match c17e436. Application byte/build proof
remains pinned in v13; no application or owned test code changed for these waves.
[Separate run ledgers](runs.json) preserve every cell, exact source, raw hashes,
actual terminal times, exit and cleanup observations. Raw Playwright JSON and
exact base64 log bytes are included; artifacts have a task-local hash ledger.
The existing PostgreSQL client-query deprecation warning remains in raw output.

The original wrapper records 6 global browser schemas after each run. Each
run's own six schema identities were captured from its actual control endpoint.
The independent post-run query finds zero of those owned schemas remaining:
after R29 the six belong to active R30; after R30 the six belong to active R31.
Those actual global counts are preserved, not rewritten to zero and not treated
as leaked schemas. Both runs' owned cleanup passes. The one existing nonroot
browser container and disposable PostgreSQL stay available for continuation.

An initial read-only R30 schema probe occurred before its control listener was
ready and returned ECONNREFUSED. The later actual readiness read succeeds and
captures all six schemas. No run was restarted, no browser case failed from that
probe, and no trust, sandbox, rate-limit or online-state guard was relaxed.

## Continuing acceptance

R31 remains on the older pinned source with 16 previously unrun White Label cells
at Chromium320/WebKit1440: ROLES-002/004/006, PROGRAMMING-004/006,
ALTERNATIVES-001/004 and HISTORY-006. No R31 result is claimed here. Its active
runtime will not be modified or interrupted for the new candidate.

Parent has supplied executable `bd30eab5b2a33c3f3e8a7692649632ec85103431` and
evidence `89409dcdbd4faedccfeec8ee236932191c6195d3`. INTEGRATION/v11 and its
explicit duration handoff are read. After the active older-source wave finishes,
QA will pin that candidate, consume its scoped independently synthetic timed
prescription through frozen-version read and normal enrollment, then run the
unchanged affected assertions and remaining supported HTTP matrices. Producer
component/native checks remain separate from authenticated QA acceptance.

Trusted HTTPS remains a separate explicit valid-trust input blocker. There is
no current executor or browser-runtime blocker. No application fix, shared
config/seed/manifest edit, main merge or production/provider/real-user action
occurs; parent retains orchestration and final acceptance.
