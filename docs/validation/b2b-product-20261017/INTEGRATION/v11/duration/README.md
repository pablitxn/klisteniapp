# Synthetic reviewed-duration fixture integration validation

Four assigned scripts authored/modified, no commits:
- scripts/b2b-product-reviewed-duration-fixture.mjs (new pure builder)
- scripts/b2b-product-reviewed-duration-fixture.test.mjs (new six focused tests)
- scripts/b2b-product-seed.mjs (fresh activated-only primary fixture, separate resources.reviewedDuration)
- scripts/b2b-product-composed-harness.test.mjs (actual HTTP/service proof plus inactive guard)

Builder interface: buildReviewedDurationFixture({organizationId,branchId,programId,publishedAt}) returns {content,snapshot,manifest}. Snapshot is strict RoutineVersionV2/version1; content is RoutineDraftContent. The manifest binds exact organization/primary branch/reference, real canonical directed-pair provenance, independent synthetic target-dose provenance/hash and frozen routine hash. Exact example: fixture-example.json. QA consumption and provenance limits: qa-handoff.md.

Commands (run from /workspace/klisteniapp):

```bash
source /workspace/.onboarding/activate.sh
node --test scripts/b2b-product-reviewed-duration-fixture.test.mjs
node /tmp/b2b-reviewed-duration-fixture-validation/run-composed.mjs
./node_modules/.bin/eslint scripts/b2b-product-reviewed-duration-fixture.mjs scripts/b2b-product-reviewed-duration-fixture.test.mjs scripts/b2b-product-seed.mjs scripts/b2b-product-composed-harness.test.mjs
./node_modules/.bin/prettier --check scripts/b2b-product-reviewed-duration-fixture.mjs scripts/b2b-product-reviewed-duration-fixture.test.mjs scripts/b2b-product-seed.mjs scripts/b2b-product-composed-harness.test.mjs
git diff --check -- scripts/b2b-product-seed.mjs scripts/b2b-product-composed-harness.test.mjs
```

The retained run-composed.mjs privately reads the authorized synthetic klisteni-integration-postgres Docker environment, constructs loopback55441/klisteni_b2b_integration_test connection settings in memory, and spawns `node --test --test-concurrency=1 scripts/b2b-product-composed-harness.test.mjs` with B2B_TEST_DATABASE_URL. It prints no credentials or connection URI. Each harness case creates and tears down its own disposable schema.

Final results: all commands exit0. test.log:6/6 pass. composed.log:3/3 pass (unified HTTP,white-label HTTP,inactive foundation),19.4seconds. lint.log:empty/success. format.log:all files conform. The initial composed attempt's Monday-only stage caused its current-continuity assertion to find0; corrected only the owned test setup to a full current week while retaining one Monday slot. The initial failed output is preserved as composed-initial.log; it is not counted as a pass.

Focused tests invoke unchanged schema/domain and actual catalog-eligibility code with a read-only database stand-in. Composed tests additionally use actual synthetic PostgreSQL, authorization/session admission, public HTTP endpoints, current catalog eligibility and normal save services; they verify scoped reads/publications, normal enrollment and occurrence linkage, truthful below-target timed partial/explicit completion, retained source actuals, rejected missing-side/dose/condition submissions, immutable routine/goal, original secondary six-occurrence invariants and equal historical preservation hashes. Foundation mode yields no duration fixture and keeps original v2 unassigned.

No production catalog/API/contracts, migration, dependencies, manifest/lockfile, QA-owned files, WP09 files, trust or sandbox changes. Parent ProductWorkspace.tsx edits left untouched. These tests are service/HTTP evidence, not a browser ALTERNATIVES-011 pass; final combined-candidate QA remains pending.
