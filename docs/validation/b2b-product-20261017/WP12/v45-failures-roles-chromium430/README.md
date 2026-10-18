# Additional full-run role failures: Chromium 430

Application `d2adf75d3fee18740ef38632a361c91203d77dc6`; QA `831203470d4c21322b8bc3ce7c4dedb7f84fe5d7`.

Two actual cells failed without retry:

- White Label R72, ROLES-003: the existing 30-second organization-combobox visibility assertion (`app-fixture.ts:266`) failed after real password admission. The retained failure snapshot shows only “Cargando…”. The later role/invitation assertions were not all completed and are not credited as passing. This assertion precedes the new shared workspace-admission phase.
- Unified R71, ROLES-009: the unchanged five-second programming-heading assertion (`b2b-product-roles.spec.ts:610`) failed after opening programming. The snapshot contains the selected coach context and navigation, with “Cargando programación y permisos…” instead of the expected heading. The final heading and viewport assertions did not pass.

Exact test-info names, private trace/screenshot hashes, normalized selected network entries, retained frame observations and failed trace action timings are preserved per case. Raw status -1 is not an HTTP server status; response/timing entries are not proof of rendered UI or body completion. Eventual ready UI and product/harness ownership remain unproven.

During the overlapping 20:57–20:59 UTC interval, several host progress/process/filesystem reads were delayed and subsequently completed successfully. The observed load/memory/storage facts and limits are recorded in monitoring-read-delay-incident.json. Temporal overlap does not establish a resource or filesystem cause. No environment-related pass override is applied. Both runner processes remained active and monitoring recovered.

All 2,106 source/build hashes still match. The complete uncapped matrices continue on the frozen pair, with no test retry, source/app change, larger deadline, automatic navigation/authentication recovery or security relaxation. These failures remain separate from independent focused passes and all old failed waves. Task-local Git publication commands now disable automatic Git maintenance per call to avoid starting unrelated maintenance during tests; repository/global Git configuration and application/runtime policy are unchanged, and this is not claimed as a cause or fix.

A safe follow-up is to investigate cold workspace admission and programming-permission loading with the exact source and retained traces, while preserving all role/host/branch/denial predicates. No product defect, harness-only cause or passing remediation is asserted. Raw traces remain task-private; sanitized error contexts are base64 encoded. HTTPS remains unexecuted without existing trusted TLS inputs. GitGuardian size-limit skip is neutral, not clean. Parent retains orchestration, integration and main-merge authority.
