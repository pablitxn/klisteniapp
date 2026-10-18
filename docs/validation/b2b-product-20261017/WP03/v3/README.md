# WP03 v3: frozen error mapping and latest WP02 dependency

Source `4d6c1ccce4eb68917fa44f938a42f0064ca7b167`; frozen base `0b611064a91b87b3a17274cabca5415bcf1d7d55`. Accepted dependencies: WP02 `c6825101d6ac798437599062481adf2a79ac5f69`, WP04 `04b2e036e6d9b5d8987c6d228ab92bf1a48827d1`. Disposable local composition `66384f32d4653207228184cc6936c007272b8578`. All 22 owned source/test files are byte-identical between feature and composed trees, bound by source-files.sha256 and composition.json. This test composition excludes WP01's shared access changes and is not the final integration candidate.

This immutable amendment supersedes v2's older WP02 pin and error-enum proposal. Do not apply v2/contract-selection-error.patch. V1/v2 remain unchanged historical evidence for their exact heads. The parent explicitly requested a frozen-contract/client regression; this revision adds one dedicated client test, with no client source/registration, DTO, manifest, lockfile or shared access-file edits.

## Implemented mapping and preserved behavior

The production records writer consumes WP04's API eligibility helper unchanged. Internal REVIEWED_TARGET_UNAVAILABLE is caught at the records boundary and mapped to status 409, existing code INVALID_INPUT, and a ProductIssue with code unavailable at content.selectedSegments. Current source/target catalog withdrawal and equipment unavailability use the same safe field response. Authentication and unrelated exceptions keep their original behavior. No new transport enum or raw internal selection code/message is exposed.

Real API denial/race cases parse their actual error through ProductErrorSchema. The new client regression sends the frozen saveSession input through the real public product client and existing transport, verifies the safe status/code/issue survives strict parsing, retains the request and local notes, sends once, and emits no auth-change signal. No client implementation was changed.

Session CAS, exact immutable receipt replay after successors, current authorization before replay, segment retention, current source/target scope/canonical checks, catalog races, issued linkage, period reconciliation and weekly rules remain as documented in v1/v2. Previously accepted unchanged segments/history remain usable after withdrawal; selecting a restored unavailable alternative is rejected with the same recoverable field issue.

## Actual validation

Node 24.19.0 / pnpm 12.7.0, frozen dependency files and disposable synthetic loopback PostgreSQL 17.11. The three pending domain exports are resolved to actual composed sources using the documented validation hook; no production payload/DTO/SQL/assertion is replaced. The separate production-planning run replaces only the WP02 fixture's default synthetic callback with createPlanningSchedule, leaving assertions unchanged. No proposed owner patch was applied.

| Scope | Actual result | Evidence |
| --- | --- | --- |
| All WP03 records/schedule/catalog race cases plus four latest WP02 planning files | 45 passed / 0 failed / 0 skipped | focused.log |
| Entire existing client suite including new strict field-error regression | 25 passed / 0 failed / 0 skipped | client.log |
| Full API in partial WP02+WP04+WP03 tree, without WP01 access producer | 136 passed / 7 failed / 0 skipped | api.log |
| Four latest WP02 files using production adapter rather than default synthetic fixture | 23 passed / 1 failed / 0 skipped | planning-production.log |
| API TypeScript with explicit pending export paths; client TypeScript | passed | typecheck.log, client-typecheck.log |
| Package lint; B2B formatting | 14 packages passed; formatting passed | lint.log, format.log |
| Source hashes, diff, Git identity, commit/PR metadata; still-applicable WP02 owner patch apply-checks | passed | source-files.sha256 and handoff |

The broad API result is not green. Six failures are in legacy integration.test.ts at 396, 486, 610, 930, 1214 and 1432; the seventh is white-label-training.test.ts:371's superseded zero North-assignment expectation. The latest WP02 receipt validates its changed legacy training paths together with WP01; this partial test tree deliberately omits that shared access producer. The legacy failures need the owning combined WP01/INTEGRATION head and diagnosis, not an unowned records-worker edit or waiver. The 500s, count mismatch and unexpected media status are retained verbatim in api.log; they are not silently classified as harmless. Assertions after each failed test location were not executed. The exact North identity patch from WP02 was reviewed but not applied because the shared test is INTEGRATION-owned.

The separate production-planning failure remains period-history.test.ts:400: the synthetic fixture assumed a replacement slot generates no new obligations, while the real adapter retains cancelled old IDs and creates required new IDs. End functionality still needs an immutable effectiveAt field in WP02's internal ScheduleChange. A negative real-DB test proves fail-closed rollback when missing, and a positive explicit-time test verifies future-only cancellation. This does not count the currently missing endpoint input as accepted. V2's apply-checked timestamp/production-fixture proposals still fit the latest WP02 source.

V2's 34 domain / 22 contract passes remain evidence for unchanged domain/contract bytes; v3 changes API error mapping and a dedicated client regression only. Its earlier full API 138/138 result used the previous WP02 pin and must not be presented as the latest full result. Ordinary branch static checks still require composition of producer sources and reserved exports. New v2 HTTP/current-access composition, ordinary checks without seams, Astra review, repaired owner tests/end metadata, browser/mobile/HTTPS/physical checks and combined build remain unexecuted owner gates.

## Handoff

[owner-requests.md](owner-requests.md) gives the current wire mapping, production factory registration, superseded enum proposal, latest dependency pins and remaining timestamp/test patches. The implementation branch remains isolated from the frozen base; no producer source, shared contract/access/manifest files or main merge were introduced into it. No new Cloud dispatch, deployment, activation, paid/provider call, credential change, real health/user data or history rewrite occurred. Evidence-only commit(s) follow the tested source; exact final head is in the PR receipt. This v3 directory is frozen after publication.
