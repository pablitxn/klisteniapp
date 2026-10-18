# WP03 v4: repaired production end acceptance

This additive receipt supersedes v1-v3's missing-effective-time, synthetic-planning-fixture and old negative-end-expectation limits. Earlier evidence and its failed results remain unchanged for their declared source heads. The frozen transport mapping from v3 remains: status 409, INVALID_INPUT and an unavailable ProductIssue; no contract enum or client implementation was changed.

## Exact inputs and source

- Frozen base: `0b611064a91b87b3a17274cabca5415bcf1d7d55`.
- Tested owned source: `9199f3f04aeaf2f5007a82ffe1439b182b3aa863`.
- Accepted WP02: `b861e29b41ba15c2d38fc52eeda513507dacc4da`.
- Accepted WP04: `04b2e036e6d9b5d8987c6d228ab92bf1a48827d1`.
- Full validation also includes the WP02 receipt's exact WP01 pin `af1fef78f912d746f79a00c52c261f03b58b4fe9`.
- Disposable local composed head: `fa4c9537b12bc986aea3aba05ababa8cfd82cd48`.
- Plan `447d77ebb5587e319018e7b56003f0ef7299bb6c`, Atlas `ce45d206a2ed4035f8003a3303abd1fff98e09b8`.

All 23 owned source/test files were byte-compared between the isolated feature branch and composed tree; source-files.sha256 and composition.json bind those bytes. Producer source is merged only in the local disposable validation worktree, not this feature branch or application main. Evidence-only commit(s) follow the tested source; the PR/handoff carries the final head. No shared DTO, SQL, migration, manifest, lockfile, barrel, access/http/service/context, legacy training or shared browser/test expectation was edited by WP03.

## Repaired behavior verified through the service handler

WP02's real production fixture now calls the actual createPlanningSchedule callback. Its internal readonly effectiveAt is captured by the service; end uses one precise server instant and period preview uses the stable expiry-bucket anchor. No caller-supplied end timestamp is added to the strict transport request.

The former WP03 test expecting the valid end handler to reject has been replaced with a successful real PlanningServices.endEnrollment/database test. At 2026-10-08T01:00Z, it is still October 7 in New York: the October 5 past and October 7 current obligations stay required, while October 8 and later local dates cancel. This distinguishes the enrollment zone from the UTC date. An accepted actual remains linked to the original occurrence/routine, still counts once in the derived week, and keeps its exact revision JSON. Original stage/slot/ordinal/routine/date/week identities, published routine bytes and old occurrence snapshots remain unchanged.

A later exact operation replay returns the original ended response, retains one receipt and one end audit event, appends no occurrence revision and performs no new cancellation. The direct adapter negative test now deliberately omits immutable effectiveAt from malformed internal input and still rejects it. The existing explicit-time pure planning/apply case retains clone determinism checks. Thus a broken internal caller remains rejected while the repaired endpoint is positively accepted.

The source adapter now directly reads the accepted required effectiveAt property; its stale comment about the former absent seam is removed. No scheduling algorithm or dose/authorization policy changed in this amendment. A new validation-only resolver supplies the three pending public domain exports with no load hook, source/fixture rewrite, timestamp injection or assertion substitution.

## Actual checks

Node 24.19.0, pnpm 12.7.0, frozen dependency files and loopback-only disposable synthetic PostgreSQL 17.11. Database readiness was confirmed before execution. No real user/health data or production configuration was used. Per-test schemas are disposed in fixture cleanup.

| Check | Actual result | Evidence |
| --- | --- | --- |
| New handler/adapter file | 4 passed / 0 failed / 0 skipped | end-handler.log |
| Entire owned records/schedule/catalog-race suite plus all four current WP02 planning files, using the real production fixture | **48 passed / 0 failed / 0 skipped** | focused.log |
| Full composed API with pinned WP01/WP02/WP04 | **158 passed / 1 failed / 0 skipped** | api.log |
| Client / domain / contracts | **25 / 34 / 22 passed**, zero failures/skips | respective logs |
| API TypeScript with three pending exports mapped to actual source | Passed | typecheck.log |
| Package lint / complete B2B formatting | 14 packages passed / formatting passed | lint.log, format.log |
| Source/evidence hashes, diff, effective identity and Conventional Commit/PR metadata | Passed | immutable manifests and handoff |

The sole full-suite failure remains shared white-label-training.test.ts:371, which expects zero North assignments despite an explicit North grant and prescribed North assignment. Its exact identity assertion belongs to INTEGRATION. WP03 did not alter that file in either tree; composition.json records its SHA-256 and byte equality against the frozen base. This result is not reported as a green full suite, and assertions after that failure were not executed. No failure or skip is counted as a pass. The earlier partial-composition failures and the old negative-end failure are historical results, not the current result.

Reproduce with `B2B_TEST_DATABASE_URL=<disposable local test DB> NODE_OPTIONS='--import /tmp/wp03-composed/apps/b2b-api/tests/fixtures/wp03-production-exports.mjs' pnpm --filter @klisteniapp/b2b-api test`. The focused run uses the same resolver with `node --test --test-concurrency=1` on production-schedule, session-revisions, weekly-adherence, training-operation-races, catalog-selection-races, reviewed-session-selections, goal-programs, period-history, planning-coverage and planning-publication test files. The resolver changes only public module resolution. TypeScript extends the real API config with source paths for domain sessions/schedule/alternatives and the existing node types. None of the proposed shared owner patches was applied.

## Owner handoff and remaining gates

[owner-requests.md](owner-requests.md) gives exact production factories/current pins. The accepted WP02 amendment closes the earlier end-time and production-fixture owner requests; do not reapply the superseded v2 proposals. The v2 transport-enum proposal remains superseded by v3's frozen error mapping.

INTEGRATION still owns the shared North assertion, public export registration and final records/planning HTTP registry composition. Ordinary checks without the temporary export resolver, new v2 HTTP/current-context integration, Astra contract-sensitive review, QA browser/mobile/HTTPS/physical acceptance and the full composed build remain unaccepted here. Product activation stays disabled. No new Cloud dispatch, main merge, deployment, provider/paid call, credential change or history rewrite occurred. V4 evidence is frozen on publication; later corrections require another revision.
