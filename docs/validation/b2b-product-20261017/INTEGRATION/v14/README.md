# Shared readiness and initial draft correction

Status: implementation candidate for independent QA; not full HTTP acceptance, main merge or deployment authorization.

## Source pins and review scope

- Unchanged application runtime: `d2adf75d3fee18740ef38632a361c91203d77dc6`.
- Prior accepted QA: `4ec0273151194acb189ac6ed327033d66366dbd5`.
- Historical failed full run: `66b80a55b66c71189fca5da886945da7f22ef0c1`, [WP12/v44](https://github.com/pablitxn/klisteniapp/blob/66b80a55b66c71189fca5da886945da7f22ef0c1/docs/validation/b2b-product-20261017/WP12/v44/README.md).
- Isolated branch: `fix/b2b-acceptance-readiness-v1`.
- Composition commit: `471bea1c2bf9446a69865ef091840ebada23d2f9`, normal merge of integration `a7abf9c` and QA `4ec0273`.
- Corrective source and repeated product-run pin: `c8a5aaa5fab4206a646a644601481713d42f4a65`.
- Final candidate: `831203470d4c21322b8bc3ce7c4dedb7f84fe5d7`. Its only differences from the product-run pin are moving the standalone synthetic contract spec outside `e2e`, adjusting its relative helper import, and updating the dedicated `testDir`/`testMatch`. This prevents accidental discovery by demo and legacy B2B runners. Product helpers, all 88 scenario bodies, product configs, runtime inputs and builds are unchanged. The standalone browser contracts run from the final candidate's exact Git bytes. These scopes are reported separately; no full matrix on either new pin is claimed.

## Diagnosis

| Failure retained in v44 | Evidence and classification | Correction |
| --- | --- | --- |
| Unified SYNC-002, WebKit430 | The helper filled `10:00:00Z` while the initial immutable autosave accepted `12:00:06.781Z`. The receipt preserved the concurrent local edit. The domain correctly required a reason for changing accepted time. Confirmed harness setup race; a longer wait cannot resolve the content mismatch. | Remove the unrelated setup timestamp mutation. Observe the actual initial draft receipt, exact request/accepted content equality, occurrence identity, draft/noncompletion/empty sets, scheduled date for the calendar path, matching visible timestamp and synchronized UI. Arm the response observer only immediately before workout entry, after calendar setup. |
| White Label HEALTH-002, WebKit430 | The five-second navigation assertion ran during outer stream admission. A retained snapshot contained navigation DOM 33.138ms after assertion failure; this is not a later passing visibility assertion. The selected `/access` response alone does not establish final composed admission. Confirmed incomplete harness admission contract; no authorization defect established. | Positive selected-context preparation, actual admission response, exact organization/branch-role controls and admitted navigation share one bounded phase. Export-only login and all denial/revocation predicates remain unchanged. |
| White Label WEEK-009, WebKit430 | The raw reload was followed immediately by the void-content assertion. The history heading renders before three base reads and every linked occurrence context. The failure retained loading UI and 41 occurrence reads; eventual ready UI was not captured. Confirmed missing harness data-readiness boundary; historical eventual completion and product performance cause remain unproven. | Shared history readiness requires both semantic regions, completed history loading and no history alert. Apply it to history navigation and positive reload/back paths. Calendar readiness additionally requires the selected timezone, requested rendered week, completed calendar load and no history alert. Keep the original `Anulada`, revision, privacy and viewport assertions. |

Source: `app-fixture.ts`, `readiness.ts`, `ProductWorkspace.tsx`, `productStream.ts`, `ProductHistoryPage.tsx`, `historyReads.ts`, `useProductTrainingSession.ts`, `workoutSync.ts`, and `packages/b2b-domain/src/sessions.ts`. The actual accepted-time guard is `sessionIssues`; `firstCorrectionProblem` concerns the legacy-original path and is not the cause of this occurrence-session failure.

The 41-request history fanout remains a scaling concern, not an established correctness defect. This correction retains atomic occurrence/enrollment validation and does not substitute current-week data for historical linkage. Actual rapid typing through slow local storage is also distinct from the observed timestamp setup race and is not claimed as covered by this diagnosis.

## Contract and assertion preservation

`readiness.ts` uses a strict 30-second phase deadline, with no deadline reset between predicates. It records named phases and normalized response/requestfinished/requestfailed events on success and failure, then removes all listeners. A response event is not body completion; a finished request is not rendered UI. There is no `networkidle`, automatic navigation/authentication retry, response rewrite, new helper sleep, clock change or consent mutation. Existing calendar clock setup is unchanged. Deliberate rendering delays occur only in the separate synthetic DOM regression fixtures.

Workspace readiness is limited to fresh positive admission; navigation is not claimed to establish reconnect readiness. Positive history waits are not inserted into export-only, foreign-context or revocation assertions.

All 323 extracted outer `expect` call texts across the sync, health, week and history scenario files match the prior QA pin exactly. The helper adds stricter receipt/content assertions. This AST audit supplements semantic review; it does not prove all behavior by itself. The existing 88-scenario matrix remains 528 cells per mode; standalone contract tests are excluded from product, demo and legacy B2B discovery. Actual discovery counts are product 528, demo 101, legacy 540 and dedicated contracts 8, with zero discovery errors.

All 24 `startWorkout` call sites across 23 scenarios were audited: they start on the assigned Monday in UTC, and none requires the removed initial `10:00` mutation. WEEK-008 asserts the scheduled date; its later timestamp edit remains an explained correction.

The domain regression verifies that changing an accepted draft timestamp requires a reason, while an unchanged time and an explained correction remain valid. No production guard was changed.

## Validation

| Check | Actual result | Executed source |
| --- | --- | --- |
| SYNC-002, HEALTH-002, WEEK-009; three fresh-fixture rounds × both HTTP modes × six Chromium/WebKit320/430/1440 profiles | **108/108 passed**, no retries/skips/timeouts | `c8a5aaa` |
| HISTORY-001/002/009, WEEK-008, SYNC-006, INACTIVE-003; both modes × Chromium1440/WebKit430 | **24/24 passed**, no retries/skips/timeouts | `c8a5aaa` |
| Synthetic readiness contracts; Chromium/WebKit430 | **8/8 passed**, no retries/skips/timeouts | Final `8312034` Git bytes |
| Relevant Node domain/client/harness/stream regressions | **61/61 passed**, no skips | `92a7c3b`; unchanged test/runtime applicability verified at final candidate |
| Final typecheck, scoped ESLint and discovery isolation | Passed; product 528/demo 101/legacy 540 exclude the eight dedicated contracts | Final `8312034` |
| Source/build verification and schema teardown | **0 mismatches**, 2,132 files checked before/after every product run; 48 distinct fresh schemas, all removed | `c8a5aaa` runtime |

Actual result tuples and original reports/logs are retained in [actual-instances.json](actual-instances.json) and `runs/`; [validation-summary.json](validation-summary.json) provides totals. [source-applicability.json](source-applicability.json) distinguishes the frozen product execution from the final standalone-discovery follow-up. The intermediate `92a7c3b` standalone eight-case run is retained separately and is not counted again.

The task-owned database ended with zero browser schemas before its container was removed. Task containers and network were removed; existing containers were untouched. See [terminal-cleanup.json](terminal-cleanup.json).

Three independent fixture lifecycles per mode are used instead of `--repeat-each`: the existing scenario week identity does not include the repeat index, so reusing the same schema would accumulate assignments and invalidate required-count assertions. Every run retains actual instances, statuses, start times, durations, source/build hashes and six live schema IDs. Original v44 failures are never replaced or pooled into these runs.

The retained supporting-run logs include a PostgreSQL client concurrent-query deprecation warning.

The separate contract suite uses synthetic DOM in real Chromium/WebKit430. It proves delayed positive admission beyond five seconds, incomplete-history rejection, failure propagation/listener cleanup, and a shared timeout across delayed predicates. Its deliberate timeout is an expected contract assertion, not a timed-out product case. It does not exercise product authentication, SSE or persistence.

## Evidence and environment

The new runtime is task-owned and disposable: a nonroot browser container, the existing seccomp policy, no-new-privileges, Chromium sandbox enabled, readonly application/runtime mounts, and PostgreSQL17.11 in tmpfs sharing only task-container loopback. No host ports are published. Ordinary Docker bridge networking is not an egress-isolation claim. Only synthetic accounts, plans, logs and health fixtures are used.

Fresh B2B/B2C instance builds use the repository's public example profile. The browser driver/cache is exact Playwright1.63. Browser/server startup uses the existing fixture admission, pacing, privacy and teardown code. Source and build files are rehashed before and after each product run. All 1,285 frozen source hashes also match immutable `c8a5aaa` Git blobs. The `setup/` receipts describe the earlier provisional preparation at composition HEAD; they are preserved unchanged and are superseded for execution provenance by the candidate Git binding and per-run checks. No external health data, production deployment/migration, TLS exception, trust mutation, paid service, history rewrite or main merge occurred.

A discovery-only preflight hit an unreadable newly copied support directory. Its original output is retained separately; zero tests ran. Permissions were corrected only on the disposable code copy. No application or test logic changed to resolve that setup error.

Independent historical evidence audit verified the v44 manifest and three failure manifests with zero byte/hash mismatches, all 1,056 actual result tuples, all 1,261 original source hashes and v40/v41 preservation. Historical raw traces/screenshots were unavailable in this environment: diagnosis uses their published sanitized extracts and capture hashes. Historical build hashes are receipt evidence, not an independent reconstruction here.

## Independent QA handoff and remaining gates

Review the narrow corrective range from `471bea1` through final candidate `8312034`, together with the source applicability proof for the standalone-test discovery follow-up. Independent source review is clean. A separate read-only product audit matched all 108 affected-run tuples to raw reports and verified source/build hashes and all 36 affected-run schema teardowns; its capture predates the supporting regression results. A separate subsequent audit verifies the remaining 24 regression tuples, both cleanup receipts and terminal 132/132 totals. The separate contract audit verified final Git bytes, all eight actual results and both expected shared-deadline rejections. Its note about intermediate receipts is resolved by separately named historical receipts and final applicability records; the audit is preserved unchanged. The entire composed candidate may be used, or the QA-owned files may be combined with unchanged app `d2adf75`; retain exact immutable inputs and verify all source/build hashes.

Parent retains dispatch and integration authority. Independent QA should assess the shared readiness/input contracts and the preserved assertion/denial behavior before accepting a new full run. The agreed final gate remains both complete uncapped HTTP matrices on one accepted app/QA pair, with zero retries and no failure cap. Neither targeted repeats nor standalone contract passes fulfill that gate.

Trusted HTTPS remains blocked: 528 planned cells have not run without existing trusted certificate/key/hostname/trust inputs. GitGuardian's oversized-PR neutral skip is not a clean security scan. Physical devices, Safari/iOS, external providers, production, main CI and prior Yoga/model/Blender qualifications remain uncertified. No acceptance waiver or merge is requested by this evidence.

## Dispatch prompt for independent QA

Review draft PR #34 without merging. Application runtime is `d2adf75d3fee18740ef38632a361c91203d77dc6`; proposed final QA source is `831203470d4c21322b8bc3ce7c4dedb7f84fe5d7`, narrow correction range `471bea1c2bf9446a69865ef091840ebada23d2f9..831203470d4c21322b8bc3ce7c4dedb7f84fe5d7`. Verify initial autosave receipt preservation and accepted-time correction semantics; shared positive admission/history/week deadlines and listener cleanup; unchanged denial, consent, revocation, historical linkage and viewport predicates; final standalone discovery isolation. Audit this v14 manifest, actual instances, source applicability, source/build checks and teardown against historical WP12/v44. Report accept/reject and exact accepted source pair. Do not launch another full matrix until review is accepted by the parent. If accepted, the parent separately dispatches both complete uncapped HTTP 528 matrices on that one immutable pair, zero retries/failure cap, retaining every actual result and failed-run evidence. Do not bypass TLS or change any gate.

Evidence files contain synthetic fixture metadata only. The task database password/URL and raw browser traces/storage are excluded; the published files and decoded inline attachments were checked for the task connection secret. The independent contract audit predates final packaging and intentionally preserves its intermediate-receipt warning. Final applicability records resolve that distinction explicitly.
