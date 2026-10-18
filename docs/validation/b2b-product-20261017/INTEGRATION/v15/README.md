# Workspace feature loading and static-file lifecycle candidate

Date: 2026-10-18. Status: targeted validation complete; independent product validation and merge remain parent-owned. No deployment or full matrix was started.

## Revisions and scope

- Branch: `fix/b2b-workspace-feature-loading`, isolated worktree `/workspace/klisteni-loading-fix`.
- Base: `f89edc6bf78d91f01d29ac9c34c6f25587d7a526`, the unchanged readiness branch.
- UI and standalone regression: `44b6ddd6d4b1b8670f0122df3541ef25d56e3976`.
- Separate gateway hardening / final source candidate: `3f8ccba573c08045c809dc73c186158878a2dafa`.
- Frozen parent QA pair remains application `d2adf75d3fee18740ef38632a361c91203d77dc6` / QA `831203470d4c21322b8bc3ce7c4dedb7f84fe5d7`.
- Remote readiness base rechecked as `f89edc6`; remote main observed at `d1c8fd58d30d1a1ff1fe76abd01d01dd435f9781`. This is a stacked candidate on the requested readiness base, not a merge into main.
- Atlas consulted at `c6feff676a0001cb69ded8c7d07d4f620486666a`; product authority remains the [October 17 decisions](https://github.com/pablitxn/sysadmin-workspace/blob/c6feff676a0001cb69ded8c7d07d4f620486666a/atlas/entries/2026-10-17-klisteni-b2b-product-definition.md).

All 3,834 copied runtime source files match the committed source candidate, with zero mismatches: [binding](candidate-source-binding.json), [source hashes](source-hashes.json). The 453 production build files are bound by [build hashes](build-hashes.json). Evidence-only publication commits do not change those validated inputs.

## Resulting behavior

The workspace shell no longer eagerly imports all feature modules. Seven module-level lazy entries have local Suspense/error boundaries. Organization and branch controls, navigation, membership admission, session/SSE ownership, recovery and navigation-flush registration remain outside the feature-loading boundary. Trainer health still requires current workspace and consent-stream authority before its lazy view can mount. Direct product workout imports remove the legacy history/session bridges.

The production [manifest](build-manifest.json) and [dependency closure](bundle-dependencies.json) show all seven feature entries as dynamic imports, outside the workspace shell's static closure. A held unrelated reports chunk prevents the baseline organization selector from appearing; the candidate exposes the authorized shell and initial programming view without requesting that chunk.

Gateway hardening is a separate commit. Built-file serving opens metadata and body through the same file handle, uses asynchronous metadata operations, closes sources on downstream cancellation, and contains open/stat/read failures. Existing host/domain gates, method checks, path rejection, missing-asset behavior, SPA fallback, bytes and headers remain intact. This fixes a source-level resource-lifetime gap; it is **not a proven cause of R71/R72 delays**, and production Nginx is unchanged.

## Executed validation

| Check | Actual result |
| --- | --- |
| Composed production-build browser regression | **14/14 passed**: seven scenarios each at Chromium 430 x 932 and 1440 x 1000; one worker, zero retries, zero skipped/interrupted cases; 24.4 seconds total. |
| Final-source baseline negative control | **Expected failure**, one Chromium430 case: the organization combobox remains absent behind `Cargando…` while the existing reports chunk is held; unchanged five-second visibility assertion. |
| UI state contracts | **65/65 passed**: navigation, local flush, workout selection/recovery, restricted access, stream guard and health consent state. |
| Gateway lifecycle/regression | **21/21 passed**, including subtests: exact bytes/hash and HEAD, empty file, routing rejection/fallback, pending open/stat disconnects, same-handle path replacement, initial/later read failures, 16 sequential disconnects and four paused transfers. All tracked handles close and synthetic-file descriptors return to baseline. |
| B2B web TypeScript; scoped UI ESLint/Prettier | Passed. |
| New browser config/spec strict TypeScript and scoped ESLint | Passed. |
| Gateway/helper Node syntax; B2B boundaries; diff whitespace | Passed. |
| Production build | Passed; existing large-chunk advisory remains. |

The browser suite uses the actual composed frontend and production chunks with a local synthetic HTTP/API/SSE fixture. It exercises the real login form and client admission/denial logic, but does **not** verify real authentication, database authorization, full-product acceptance, HTTPS, Safari/iOS or production performance. No real-user records, external health access, provider or paid service is involved. Existing product acceptance specs, helpers, configurations, assertions and deadlines are byte-for-byte unchanged; no lockfile or schema change.

Browser scenarios cover unrelated chunk isolation, delayed selected-feature navigation/release, rejected selected-feature errors with usable navigation, branch/role denial before sensitive reads, consent revocation during a pending import, initial consent denial and inactive export-only access. Chunk gates first verify the target exists. Late health-import checks await native evaluation and two rendering frames, then reassert current denial and absence of health reads; this is not a general React-idle assertion.

See [browser results](browser-results.json), [request phases](request-phases.json), [UI tests](ui-state-tests.txt), [gateway tests](gateway-tests.txt), [candidate browser log](candidate.txt) and [baseline log](baseline.txt). Per-request browser header/body/failure observations and synthetic server arrival/finish/close timestamps are retained. The clocks are identified separately; these are not production latency measurements or proof that the historical 20-53 second delays are resolved.

## Preserved unsuccessful attempts and corrections

These records are retained rather than counted as passes:

1. Candidate build read permissions initially prevented the nonroot server from starting: zero tests executed. Only permissions on task-owned build output were corrected.
2. The initial loopback-only container reported `navigator.onLine=false` while visible. All 14 candidate cases failed before the intended feature checks; traces recorded zero SSE requests. The [probe](network-none-probe.json) identifies the runtime condition. An isolated Docker internal bridge restored truthful online status; no browser property, application gate or security setting was overridden.
3. The new suite used exact label queries for select elements whose labels contain nested option text. All 14 cases failed those new queries even after actual navigation/programming readiness. The queries were corrected to exact accessible `combobox` role queries, matching existing QA. Predicates and deadlines were preserved. Earlier baseline runs using these incorrect queries are retained diagnostic attempts, **not** credited as discriminating controls; the final role-query baseline above is the valid control.
4. The environment's pnpm wrapper attempted metadata installation and failed before checks. Existing dependencies were privately copied into the isolated worktree; direct Node executables performed validation without dependency or lockfile changes.

[Raw artifact inventory](retained-artifact-manifest.json) records task-local traces/screenshots/reports and hashes; [browser-results.json](browser-results.json) preserves all run outcomes and error summaries. Full raw artifacts remain under `/tmp/klisteni-loading-validation/evidence`. Final browser runs used Chromium 153.0.8010.12 / Playwright 1.63.0, nonroot UID1001, sandbox enabled, no `--no-sandbox`, and no effective capabilities. The [runtime probe](internal-network-probe.json) and [internal-network setting](network-internal.json) are recorded. No host ports were published; only the task container/network were created and later removed.

## Reproduction commands

From the repository root, using existing dependencies:

```sh
node --test apps/b2b-web/tests/navigation-state.test.ts apps/b2b-web/tests/localWorkoutFlush.test.ts apps/b2b-web/tests/workoutSelection.test.ts apps/b2b-web/tests/workoutRecovery.test.ts apps/b2b-web/tests/restrictedAccess.test.ts apps/b2b-web/tests/product-stream-guard.test.ts apps/b2b-web/tests/healthConsentState.test.ts
node --test scripts/b2b-gateway.test.mjs
node node_modules/typescript/bin/tsc --noEmit -p apps/b2b-web/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --strict --skipLibCheck --types node apps/b2c-web/playwright.workspace-loading.config.ts apps/b2c-web/test/workspace-loading/workspace-loading.spec.ts
node scripts/check-b2b-boundaries.mjs
```

From `apps/b2c-web`, in an online/visible, sandbox-capable isolated browser runtime:

```sh
node node_modules/@playwright/test/cli.js test --config playwright.workspace-loading.config.ts --reporter=list,json --max-failures=1
```

All 14 cases executed despite the diagnostic stop-on-first-failure setting because none failed. The [suite README](../../../../../apps/b2c-web/test/workspace-loading/README.md) documents building or supplying an immutable build and collecting artifacts. For the baseline control, supply the retained `d2adf75` build through `B2B_WORKSPACE_LOADING_DIST`, select `--project chromium430`, and use `--grep 'an unrelated production chunk'`. Do not run selected-entry baseline scenarios when that older build coalesces their chunks.

## Review and remaining gates

Independent Astra-ultra source review found no concrete blocker in production changes, commit ownership or the final fixture refinements; no tests were rerun by that reviewer. Ordinary implementation/test owners used GPT6.1 Sol high. Root alone owns the combined source/evidence publication. Local results are not hosted CI approval.

Rejected module-level lazy imports remain rejected until page reload; the scoped error offers other navigation and makes no automatic retry promise. In-place mutation of served build files is outside the immutable-build assumption. The underlying historical resource delays, backend request latency and R71's full-navigation programming readiness remain unproven; this patch does not claim they are all fixed.

The original [R71/R72 failures](https://github.com/pablitxn/klisteniapp/tree/5c1b4fc7d22b568773b936bc52a36fa87e5d319f/docs/validation/b2b-product-20261017/WP12/v45-failures-roles-chromium430) and [resource observations](https://github.com/pablitxn/klisteniapp/blob/5c1b4fc7d22b568773b936bc52a36fa87e5d319f/docs/validation/b2b-product-20261017/WP12/v45-role-resource-observations/observations.json) remain immutable. Parent-owned frozen refs and processes were not altered. Integrate UI commit first, then separate gateway hardening if accepted; independent validation must assess the resulting application/QA pair before any merge or next full matrix. No retry-until-green, acceptance waiver, merge or deployment is authorized by this receipt.
