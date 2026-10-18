# Accepted-pair full HTTP acceptance

Application `d2adf75d3fee18740ef38632a361c91203d77dc6`; QA `92d951c2a6de3b954ef617ecabd3d02e245c46e8`; integration evidence `a7abf9c8123d070e8e5b029dbed0571434462c8d`.

| Mode | Attempted | Passed | Failed | Timed out | Skipped |
| --- | ---: | ---: | ---: | ---: | ---: |
| unified-http | 528 | 528 | 0 | 0 | 0 |
| white-label-http | 528 | 527 | 1 | 0 | 0 |

Full HTTP acceptance: not met; nonpassing cells remain nonpassing.

| Run | Mode | Scenario | Context | Status |
| --- | --- | --- | --- | --- |
| R62 | white-label-http | B2BP-HISTORY-002 | product-chromium-desktop | failed |

All leaf results remain attached to their actual case start times, context and immutable source pair. One worker per mode, zero retries, no failure cap. Fresh B2B/B2C builds and source/bundle hashes verified before and after each wave. All actual owned schema IDs were captured live and absent after teardown; final global browser-schema count is zero.

[Unified full receipt](../v38/README.md) and [White Label full receipt](../v39/README.md) contain sanitized raw reports/logs, original hashes and private-artifact manifests. [Targeted regressions](../v37/README.md) remain independent and are not pooled into full-wave counts. Original failed [R34](../v31/README.md) and [R35](../v32/README.md) retain their original app bd30/QA1374 identities and all failures.

The [original complete R55/R56 matrices](../v36/README.md) remain immutable on QA ff78328 with their four actual failures. The corrected repeated verification is separately retained in v37.

HTTPS remains unexecuted: 528 planned cells require existing trusted task-owned TLS certificate/key inputs. Local Chromium/WebKit viewport coverage does not certify physical devices, Safari/iOS, providers, production, deployment or main CI. No TLS, sandbox, admission or privacy guard relaxation was used. Historical Yoga and model/Blender qualifications remain unchanged. Parent retains final integration and main-merge authority.


History readiness: 456 observations, observed heading waits 352–1767ms, 0 acknowledgments over 5000 ms. The bound remains 30 seconds, with actual UI assertions and response-status observations. No sleeps or changed app responses were used. These timings do not establish a historical root cause. GitGuardian remains neutral because the PR exceeds configured scan size; no clean scan is claimed.


HISTORY-002 / White Label Chromium 1440 failed its five-second positive continuity-content assertion while current access was still verifying. Later access/continuity requests returned 200, but eventual UI readiness was not captured. This direct-history caller bypasses the bounded showWeek observer. The [immutable failure diagnosis](../v37-failure-r62-history002-chromium1440/README.md) preserves the uncertainty; no functional app root cause or passing retest is claimed. The current failed cell remains failed and no mid-wave change was applied.
