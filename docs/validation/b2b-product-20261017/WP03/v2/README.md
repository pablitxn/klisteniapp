# WP03 v2: production dependency adapters and catalog races

This is an immutable amendment to [v1](../v1/README.md), following the parent's pinned WP02/WP04 notices. V1 remains historical evidence for its declared source. Feature modules are implemented; final acceptance remains blocked on the owner amendments below. No application activation or main merge occurred.

## Revisions and ownership

- Frozen implementation base: `0b611064a91b87b3a17274cabca5415bcf1d7d55`.
- Tested WP03 source: `c569d109572c09ec5e587c5f66548672ba38f8d8`.
- WP02 accepted head: `3b045cbe431d1995d75f9e88eeac1d79a08607bb`.
- WP04 accepted amendment: `04b2e036e6d9b5d8987c6d228ab92bf1a48827d1`; supersedes `c91fbcbaf3dc228630cda66dd2229f2524cb46c9`.
- Disposable composed test head: `05d8c2a3d477dd38510efebdba3e957c97ad950a`.
- Plan `447d77ebb5587e319018e7b56003f0ef7299bb6c`; read-only Atlas `ce45d206a2ed4035f8003a3303abd1fff98e09b8`.

The feature branch still starts at the assigned frozen base and contains only WP03 owned modules/tests/evidence. Pinned producer source was merged in a disposable local test worktree, not into the application main or published feature branch. All 20 owned source/test files in [source-files.sha256](source-files.sha256) were byte-compared between the feature source and composed tree. [composition.json](composition.json) records the pins and explicit test seams. Evidence-only commits follow the tested source; the PR receipt contains the final feature head. No shared DTO, migration, manifest, lockfile, barrel, API http/service/access/context, legacy training or browser-spec file was edited.

## Production work

`src/schedule/planning.ts` supplies `createPlanningSchedule(): PlanningSchedule` against WP02's actual callback types. Plan is synchronous, deterministic and performs no database/clock I/O. It includes current occurrence revisions, all linked actual heads, eligibility changes and retained same-week overrides. Apply allocates new identities under the caller's enrollment lock, verifies impacts/current snapshots, writes only occurrence heads/revisions and retains all issued links and actuals. New slot quantities are generated; removed IDs remain cancelled. The existing synthetic fixture is not a production adapter.

Operation locking now matches WP02 exactly: current authorization, actor/operation lock, enrollment advisory lock/row, child session. Period preview/apply races are exercised using the real PlanningModule with the production callback, including an actual member move that invalidates its earlier preview.

The records writer consumes WP04 `checkEffectiveSegments`, `checkNewSegmentSelections`, `targetEquipmentAvailable` and API `assertNewReviewedCatalogEligibility`. This enforces target units, alternating/per-side coverage, ranged maxima, bodyweight null external load, exact frozen relation/conditions and independent target dose. Incomplete draft selections are projected only for validation and never persisted or completed automatically. Legacy supplement identity uses the accepted producer `contentHash` on raw stored JSON.

New and explicitly restored alternatives recheck BOTH current source/target publication and tenant/branch eligibility. WP04 additionally rejects noncanonical/edited/unproven/wrong-revision targets using its accepted helper. Frozen prescription validation and live catalog authorization remain separate. Existing accepted selections, actuals and receipts survive later withdrawal; restoring a withdrawn alternative is a new selection and fails without deleting history.

A catalog-table SHARE lock covers absent override rows, so a concurrent disable INSERT cannot slip between authorization and acceptance. Current source/target and active equipment rows are held FOR SHARE. These catalog write exclusions last only for the existing acceptance transaction; assess the cross-branch write serialization cost at integration. No new connection or production authorization fixture was introduced.

## Validation and limits

Node 24.19.0 / pnpm 12.7.0, frozen dependency bytes, local synthetic PostgreSQL 17.11 from the retained immutable image. No production or real health/user data. The disposable DB uses loopback and task-only synthetic authentication; per-test schemas are removed. Public export entries remain INTEGRATION-owned, so validation resolves only domain sessions/schedule/alternatives to their actual composed source. The temporary TypeScript config extends the real API tsconfig with those three paths and the existing node types. No transport, assertions, dose or SQL is replaced by that export seam.

| Check | Result | Evidence |
| --- | --- | --- |
| Full composed API, original WP02 regression fixture plus 21 WP03 cases using production handlers/callbacks where applicable | 138 passed, 0 failed/skipped | api-final-latest.log |
| Both original WP02 test files with their default fixture callback replaced by the production adapter; assertions unchanged | 18 passed, 1 failed, 0 skipped | wp02-production-pinned.log |
| Current-catalog transaction races | 3 passed, 0 failed/skipped; also included in full API | catalog-races.log |
| Accepted WP04 amendment plus affected records cases | 10 passed, 0 failed/skipped; also included in full API | wp04-amendment-records.log |
| Composed domain suites (WP03 plus pinned WP02/WP04) | 34 passed, 0 failed/skipped | domain-composed.log |
| Contracts | 22 passed, 0 failed/skipped | contracts.log |
| Composed API TypeScript with explicit pending export paths | exit 0 | typecheck.log |
| Package lint | 14 packages passed | lint-packages.log |
| B2B formatting | passed | format.log |
| Identity guard, Conventional Commit/PR metadata, diff, owned-source/evidence hashes, all proposed patch apply-checks | passed | handoff and immutable manifests |

The full command is `B2B_TEST_DATABASE_URL=<disposable local test DB> NODE_OPTIONS='--import /tmp/wp03-composed/apps/b2b-api/tests/fixtures/wp03-composed-seams.mjs' pnpm --filter @klisteniapp/b2b-api test`. The hook resolves the three pending exports only in this run. For the separate production-WP02 run, `WP03_PRODUCTION_SCHEDULE=1 node --import ... --test --test-concurrency=1 apps/b2b-api/tests/goal-programs.test.ts apps/b2b-api/tests/period-history.test.ts` substitutes only the default synthetic fixture callback; assertions remain unchanged. `WP03_END_TIME_PROPOSAL` was not used, and none of the proposed owner patches was applied. Therefore native regression green is not described as full production-planning acceptance.

The one production-injected failure is the existing period-history.test.ts:400 expectation that every occurrence is cancelled after replacing a slot. The synthetic adapter generated no replacement obligations. The production adapter correctly retains cancelled old IDs and generates new required IDs. The provided test amendment separates those assertions. The pinned end callback also lacks immutable effectiveAt metadata; a focused real-DB test proves fail-closed rollback, and another supplies the explicit timestamp and verifies past requirements survive while only future dates cancel. The pinned end endpoint has not passed functional production acceptance.

The table-lock races prove both orderings: a committed disable insertion or source unpublication before selection denies it with no accepted revision/receipt; an accepted selection first delays the competing disable until commit, then preserves retained history. Publication/foreign tenant/unshared branch/source/target denial, canonical review, explicit withdrawn-target restoration, empty drafts, old receipt replay, CAS and old byte/ID preservation remain covered.

The first fresh container run began before readiness and hit connection resets; it was rerun after pg_isready. pnpm initially refused symbolic-link task-state directories in the disposable worktree; they were replaced with real task-local directories while retaining the same dependency files. No policy or security check was disabled. These setup failures were not counted as passes. Ordinary branch boundary/typecheck still require producer source composition and owner export registration; v1 raw diagnostics are retained, and no root lint/typecheck/check-all green claim is made.

## Remaining owner actions

See [owner-requests.md](owner-requests.md). Exact apply-checked proposals:

- [wp02-effective-time.patch](wp02-effective-time.patch): internal immutable effectiveAt supplied by WP02's server clock. Without it, deterministic future-only end reconciliation fails closed; it cannot infer time from enrollment creation or read wall clock inside plan.
- [wp02-production-fixture.patch](wp02-production-fixture.patch): register the real production callback in the WP02 test fixture and correct the replacement-slot assertion. The pinned production run remains 18/19 until its owner accepts this change.
- [contract-selection-error.patch](contract-selection-error.patch): register the new producer REVIEWED_TARGET_UNAVAILABLE code in ProductErrorSchema. Existing transport preserves the code string; CONTRACT still owns the enum.
- INTEGRATION combines our v1 domain exports with WP04's alternatives export and registers records/planning using the exact factories; WP01 supplies current authorized transaction/host/tenant/branch context. No synthetic context builder is suitable production authorization.

Astra review, final ordinary checks without seams, repaired production end/fixture acceptance, new v2 HTTP authorization, browsers/mobile/HTTPS/physical acceptance and combined build remain pending on the owning integrated head. QA retains browser ownership. No new Cloud dispatch, main merge, activation, deployment, paid/provider call, credential change or history rewrite occurred. V2 evidence is frozen when published; later corrections require another revision.
