# Independent PR35 loading review and focused validation

[PR35](https://github.com/pablitxn/klisteniapp/pull/35) reviewed head: `76dcab2d28bd58072dc492bf6a994eb4995896e4`. Production source: `3f8ccba573c08045c809dc73c186158878a2dafa` (UI isolation commit `44b6ddd6d4b1b8670f0122df3541ef25d56e3976` plus separate gateway lifecycle commit). QA: `831203470d4c21322b8bc3ce7c4dedb7f84fe5d7`. PR35 adds documentation only after the production source commit; exported app and QA files also match its exact final head. No source from PR35 was imported into the frozen baseline or this QA branch.

## Frozen baseline remains terminal

[Immutable R71/R72 terminal record](https://github.com/pablitxn/klisteniapp/blob/072e5fe3d97c57523cb0069f22ac834934b8f4af/docs/validation/b2b-product-20261017/WP12/v48/README.md): R71 unified 527 passed / 1 failed; R72 White Label 526 passed / 2 failed. There were 1,056 unique full cells, zero retries, skips or whole-test timeouts. Full baseline acceptance was not met. All original reports, failures and v40/v41/v44/v45 history remain intact. The original 2,106 source/build files were reverified unchanged before retirement and after this candidate validation. Task-owned v11 containers were retired only after terminal reports, raw JSON/artifact hashes and zero browser schemas were verified; host source/evidence remains retained.

## Independent actual executions

| Check | Actual result | Scope |
| --- | --- | --- |
| Built-app synthetic loading | 14 passed, 0 failed/skipped/retried | Seven cases, Chromium 430 and 1440 |
| Same final test against retained baseline build | 1 expected failure, 0 retries | Chromium 430, unrelated reports chunk held |
| R74 unified product | 6 passed | ALTERNATIVES-004, ROLES-003, ROLES-009; Chromium 320/430 |
| R75 White Label product | 6 passed | Same three cases and viewports |
| R76 unified product | 2 passed | HEALTH-002, INACTIVE-003; WebKit 430 |
| R77 White Label product | 2 passed | Same two cases and viewport |
| UI state | 65 passed, 0 failed/skipped | Navigation, local flush, selection/recovery, restrictions, stream guard, consent |
| Gateway | 21 passed, 0 failed/skipped | Includes nested disconnect/error lifecycle cases |

Each browser suite uses one worker, zero retries and no failure cap. R74/R75 ALTERNATIVES-004 Chromium430 durations include recorded password-limiter idle waits of58,933/59,235ms. Those unchanged admission reservations remain explicit in cell annotations; they are not feature-readiness timing or relaxed authentication. Actual positive phase observations are retained separately. The 16 real-product instances are separate focused evidence, not a replacement 1,056-cell full matrix. No complete candidate matrix was run. All four product runs captured their six actual schema IDs live; all 24 owned schemas were removed by normal teardown. Final global browser-schema count: zero. No manual schema cleanup.

Fresh B2B and B2C production builds, B2B and standalone-browser type checks, package-boundary check and static-helper syntax check passed. Production build retains the existing large-chunk advisory. Producer lint/format results were audited as supplied evidence, not rerun or counted as independent checks. All 1240 app inputs, 30 exact QA/helper inputs and 856 fresh outputs matched their frozen hashes before/after the product runs and final publication. Dependency lock/workspace bytes and manifest dependency fields match the frozen installed tree. No dependency install, contract edit or shared config change.

The supported cached runtime remained nonroot UID1001 with Chromium sandbox enabled, existing seccomp/no-new-privileges, ordinary task network, no published ports and read-only platform CA/dependency mounts. Playwright1.63.0, Chromium153.0.8010.12 and WebKit26.6 were actually started; feature execution is limited to the cells listed above. The baseline build was mounted read-only.

## Review conclusion

The lazy imports remove unrelated feature dependencies from workspace admission and give the selected feature its own loading/error boundary. Navigation, current organization/branch controls, membership admission, stream authority, local recovery and navigation-flush ownership remain outside those boundaries. The direct workout imports re-export the exact same product components as the old legacy barrels. No DTO, authorization endpoint, role/capability guard, denial predicate or existing product assertion changed.

The baseline control fails at the exact organization combobox's five-second visibility assertion while the unrelated reports chunk is held. The candidate passes that test without requesting the reports chunk. Delayed and rejected selected chunks retain usable navigation; another section renders real fixture content. React.lazy caches a rejected import, so retrying that same feature requires a full page reload; resetting the scoped boundary does not refetch a rejected module. The UI directs users to another section and performs no silent retry. Branch/role changes during a pending import cannot reveal the old privileged marker or issue prohibited feature reads. Consent denial and revocation during a pending health import prevent mounting or reading health; inactive membership stays export-only. The fixture rejects unmodeled API reads. Its authentication/API responses are synthetic; it does not establish real-server authorization by itself. The separate real-product role/health/inactive scenarios provide focused integration evidence.

The gateway delta uses one open handle for metadata and body, transfers it to the read stream, preserves backpressure and cancels on downstream close/finish/error or request abort. Independent Node tests exercise complete GET/HEAD and empty files, MIME/security headers, path/method/fallback behavior, repeated disconnects and descriptor recovery, paused clients, disconnects during open/stat, replacement after stat, and open/stat/create/read errors. The synthetic loading fixture has its own static server and does not execute this gateway helper. No claim is made that stream cleanup caused the historical 20–53-second asset timings, bootstrap cancellation, or any specific R71/R72 failure.

Producer v15 audit verified all 27 manifest entries and 3,834 exact source Git blobs at `3f8ccba573c08045c809dc73c186158878a2dafa`. Its reduced browser report records14 candidate passes and one valid expected baseline failure, with private raw-report hashes. Producer setup/offline/locator failures are retained and not promoted to passes. Those supplied results remain separate from the executions above.

## Proposed pins and remaining gates

Proposed final application source: `3f8ccba573c08045c809dc73c186158878a2dafa`; proposed final QA: `831203470d4c21322b8bc3ce7c4dedb7f84fe5d7`. PR35 head `76dcab2d28bd58072dc492bf6a994eb4995896e4` has identical runtime source and adds only documentation. Parent retains the choice of the final combined integration head; this evidence does not fabricate or approve an unprovided combined SHA.

No blocking production-code finding was identified in this focused review. The candidate addresses the demonstrated eager-dependency failure mechanism and passes the selected regressions. Historical causality and broad performance remain unproven. Full candidate HTTP acceptance remains pending the parent's final accepted combined head and gate decision; baseline failures remain failures. Do not merge failing placeholder tests or waive full acceptance from these focused passes.

HTTPS remains unexecuted pending the existing trusted task certificate/key/hostname/trust inputs; no TLS or sandbox relaxation. Local viewports do not certify physical devices, Safari/iOS, production/provider data, deployment or main CI. Historical Yoga/model/Blender qualifications remain unchanged. Parent retains orchestration, integration and merge authority. No app source fix, main merge, external real-user message, provider or production action was performed.

## Evidence handling and Atlas

Public reports, request observations and logs are sanitized; private raw reports, traces and screenshots remain task-local with SHA256 manifests. Expected negative-control failure is retained without altering or rerunning it to obtain green. File manifests bind published bytes; runner-source sanitation is explicitly recorded and does not claim byte identity with private scripts.

Atlas context was read at `ce45d206a2ed4035f8003a3303abd1fff98e09b8`, using the mounted atlas-navigate skill and source-of-truth rules. The product repo governs implementation and contracts; dated runtime evidence governs these local results. Original plan pin: `447d77ebb5587e319018e7b56003f0ef7299bb6c`. All authored repository content and new Conventional Commits are English.
