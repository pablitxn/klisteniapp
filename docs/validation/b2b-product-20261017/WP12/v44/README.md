# Approved-pair full HTTP acceptance

Application `d2adf75d3fee18740ef38632a361c91203d77dc6`; QA `4ec0273151194acb189ac6ed327033d66366dbd5`; integration evidence `a7abf9c8123d070e8e5b029dbed0571434462c8d`.

| Mode | Attempted | Passed | Failed | Timed out | Skipped |
| --- | ---: | ---: | ---: | ---: | ---: |
| unified-http | 528 | 527 | 1 | 0 | 0 |
| white-label-http | 528 | 526 | 2 | 0 | 0 |

Full HTTP acceptance: not met; actual nonpassing cells are retained.

All 88 scenarios ran once in every Chromium/WebKit 320, 430 and 1440 context in each HTTP mode: 1,056 unique cells, zero retries, one worker per mode and no failure cap. Every result retains its actual start time, duration, context and exact source pair.

| Run | Mode | Scenario | Context | Status |
| --- | --- | --- | --- | --- |
| R67 | unified-http | B2BP-SYNC-002 | product-webkit-430 | failed |
| R68 | white-label-http | B2BP-HEALTH-002 | product-webkit-430 | failed |
| R68 | white-label-http | B2BP-WEEK-009 | product-webkit-430 | failed |

All 2103 source/build hashes matched at start and after each run; final verification also matched. The exact fresh B2B/B2C builds verified by targeted R63–R66 were reused without change. Each run captured six actual fixture schema IDs live; all owned schemas were absent after teardown and final global browser-schema count is zero. No manual cleanup was used.

[Unified receipt](../v42/README.md) and [White Label receipt](../v43/README.md) include sanitized reports/logs, private original hashes and artifact manifests, native checkpoint observations, source/build/runtime proofs and cleanup evidence. Real traces and screenshots remain task-private.

HISTORY-002 continuity region: 12 observations, 12 visible; waits 885–1165 ms, 0 over five seconds. Bounds remain 30 seconds. Observations are not additional test passes and do not establish a historical root cause.

History heading: 456 observations, 456 visible; waits 177–4170 ms, 0 over five seconds. Bounds remain 30 seconds. Observations are not additional test passes and do not establish a historical root cause.

Original [v40 full outcomes](../v40/README.md), including R62 HISTORY-002 failure, and [v41 targeted results](../v41/README.md) are byte-for-byte preserved by manifest verification. All older failed waves remain immutable under their original app/QA pins. These results do not retroactively change historical failures or pool the 18 targeted passes into full coverage.

HTTPS remains unexecuted: 528 planned cells require existing trusted task-owned certificate/key/hostname/trust inputs. No TLS, sandbox, admission, privacy or security assertion relaxation was used. Local viewport coverage does not certify physical devices, Safari/iOS, providers, production, deployment or main CI. GitGuardian skipped scanning due configured PR scan-size limits; neutral status is not a clean scan. Historical Yoga/model/Blender qualifications remain unchanged. Parent retains orchestration, integration and main-merge authority.


[R68 HEALTH-002 failure diagnosis](../v41-failure-r68-health002-webkit430/README.md) preserves the unchanged five-second positive login-navigation failure on White Label WebKit 430. A retained snapshot contains navigation DOM 33.138 ms after the browser assertion ended. That snapshot is not a later visibility assertion, passing retest or established root cause. The actual cell remains failed; no mid-wave change was applied.


[R67 SYNC-002 failure diagnosis](../v41-failure-r67-sync002-webkit430/README.md) preserves the initial synchronized-status failure on unified WebKit 430. The actual draft POST returned 200 with a performedAt differing from the helper-filled value; the UI showed the correction-reason alert. Helper/initial-autosave ordering is a review candidate, not established root cause. The cell remains failed and no mid-wave fix or retest was applied.


[R68 WEEK-009 failure diagnosis](../v41-failure-r68-week009-webkit430/README.md) preserves the direct-reload void-history assertion failure on White Label WebKit 430. The final retained snapshot still shows history loading and no actual-sessions region. Eventual ready UI and product/harness cause remain unproven; the failed cell is retained.
