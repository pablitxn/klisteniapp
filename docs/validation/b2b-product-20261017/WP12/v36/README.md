# Accepted-pair full HTTP acceptance

Application `d2adf75d3fee18740ef38632a361c91203d77dc6`; QA `ff78328cf499c5f5efddf5383f226aa75e4fb74b`; integration evidence `a7abf9c8123d070e8e5b029dbed0571434462c8d`.

| Mode | Attempted | Passed | Failed | Timed out | Skipped |
| --- | ---: | ---: | ---: | ---: | ---: |
| unified-http | 528 | 526 | 2 | 0 | 0 |
| white-label-http | 528 | 526 | 2 | 0 | 0 |

Full HTTP acceptance: not met; nonpassing cells remain nonpassing.

| Run | Mode | Scenario | Context | Status |
| --- | --- | --- | --- | --- |
| R55 | unified-http | B2BP-ALTERNATIVES-009 | product-chromium-430 | failed |
| R55 | unified-http | B2BP-ALTERNATIVES-005 | product-webkit-desktop | failed |
| R56 | white-label-http | B2BP-ALTERNATIVES-009 | product-chromium-430 | failed |
| R56 | white-label-http | B2BP-ALTERNATIVES-009 | product-chromium-desktop | failed |

The [immutable live checkpoint and unapplied readiness proposal](../v34-checkpoint-20261018T1028Z/README.md) retain the trace-supported diagnosis for the three Chromium ALTERNATIVES-009 failures observed by 10:28 UTC. No proposed patch was applied to either full wave.

All leaf results remain attached to their actual case start times, context and immutable source pair. One worker per mode, zero retries, no failure cap. Fresh B2B/B2C builds and source/bundle hashes verified before and after each wave. All actual owned schema IDs were captured live and absent after teardown; final global browser-schema count is zero.

[Unified full receipt](../v34/README.md) and [White Label full receipt](../v35/README.md) contain sanitized raw reports/logs, original hashes and private-artifact manifests. [Targeted regressions](../v33/README.md) remain independent and are not pooled into full-wave counts. Original failed [R34](../v31/README.md) and [R35](../v32/README.md) retain their original app bd30/QA1374 identities and all failures.

HTTPS remains unexecuted: 528 planned cells require existing trusted task-owned TLS certificate/key inputs. Local Chromium/WebKit viewport coverage does not certify physical devices, Safari/iOS, providers, production, deployment or main CI. No TLS, sandbox, admission or privacy guard relaxation was used. Historical Yoga and model/Blender qualifications remain unchanged. Parent retains final integration and main-merge authority.


ALTERNATIVES-005 / unified WebKit 1440 failed at the five-second positive history heading wait during loading. Authenticated bootstrap completed just after the deadline, followed by successful access/history reads. Eventual UI readiness was not captured, so no functional app defect is established. The [timing diagnosis and separate bounded-readiness proposal](history-readiness-diagnosis/unapplied-proposal/README.md) preserve this limitation; no correction was applied or tested in these waves.
