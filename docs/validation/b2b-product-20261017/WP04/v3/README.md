# WP04 v3: own issued occurrence authorization

PR: https://github.com/pablitxn/klisteniapp/pull/16. Amendment base: `04b2e036e6d9b5d8987c6d228ab92bf1a48827d1`; tested source: `27880a70ec1432699a057af8cf6073dcf3c55431`. This amendment replaces only the earlier legacy-assignment-only member check. [v1](../v1/README.md) and [v2](../v2/README.md) remain unchanged. The receipt commit changes only this v3 directory. Parent retains integration and main-merge authority.

Original frozen implementation base: `0b611064a91b87b3a17274cabca5415bcf1d7d55`; plan `447d77ebb5587e319018e7b56003f0ef7299bb6c`; Atlas `ce45d206a2ed4035f8003a3303abd1fff98e09b8`.

## Integrated-context reproduction

Integrator reported the issue at PR21 head `4954accaf0e4a0c88f8179b949886b1fcece8fa7`. That exact object was fetched and its alternatives handler, product context, occurrence/enrollment/stage SQL, session service and reviewed-segment validation were inspected read-only. The alternatives module's pre-amendment Git blob is identical in PR21 and this branch: `b8c8779c658964d100868782844f2733605d18ad`. Product context and product-schema sources also have no differences between these revisions. The integrated session path accepts issued occurrences, but the alternatives read checked only `b2b_program_assignment`.

The new real-PostgreSQL case creates full FK-linked goal/revision/enrollment/revision/stage/occurrence records, with schema-validated goal content and immutable v2 routine versions. The database contains zero legacy assignments. Against the unchanged handler, its own issued member's positive read fails `404 NOT_FOUND`; [reproduction.log](reproduction.log) retains that expected failure. An earlier startup attempt reached PostgreSQL during initialization and failed to connect; readiness was verified with `pg_isready` before the recorded product reproduction. Neither attempt is counted as a passing final check.

This is an isolated handler/SQL reproduction against the same pre-fix module and schema, not a claim that the entire PR21 HTTP/browser tree was executed here.

## Scoped correction

The existing member branch still invokes current `authorizeMember(actorId, 'history')` before reading prescriptions. It now accepts either the unchanged exact own legacy-assignment tuple or an exact own required occurrence tuple: organization, branch, member, routine ID and routine version must all match. The occurrence must have `eligibility='required'`. A bounded UNION query returns at most one authorization row. Routine scope/version/step parsing, raw legacy supplement hashing, blocked-step handling, active access, staff capability checks and branch catalog exclusions remain unchanged.

A published/catalog-visible routine alone is insufficient. Another member's occurrence, another branch/tenant, a different published version, an unissued routine, or a cancelled occurrence cannot authorize this read. Cancelling the sole matching required occurrence immediately removes that new access path. The legacy path retains its previous historical compatibility behavior. New-selection catalog/equipment checks remain separate and unchanged; the new v2-only case also verifies branch exclusion and current-target selection denial.

Only two implementation/test files changed: `apps/b2b-api/src/catalog/reviewed-alternatives.ts` and `apps/b2b-api/tests/reviewed-alternatives.test.ts`. No WP03/shared/schema/manifest/route file changed. Parent should consume the additive source commit on the composed integration branch, then rerun the affected integrated route/session checks. No new shared wiring is required for this existing handler.

## Final validation

Node 24.19.0 / declared pnpm 12.7.0 / frozen dependencies; disposable loopback PostgreSQL 17.11 with synthetic users/data. The task container/database and schemas were removed after validation. [evidence.json](evidence.json) records exact source and raw/normalized log digests.

| Check | Result |
| --- | --- |
| New v2-only regression against pre-fix module | 1 expected failure: own issued read returns 404; 0 skips |
| Full dedicated reviewed-alternatives test file | 7 passed, 0 failed/skipped |
| Full B2B API suite with synthetic PostgreSQL | 99 passed, 0 failed/skipped |
| `pnpm lint` | boundaries, 14 package tasks and complete B2B formatting passed; 13 unchanged cached tasks |
| `pnpm typecheck` | 14 package tasks passed; 13 unchanged cached tasks |
| `git diff --check`, effective Cloud identity, official commit and PR metadata checks | passed in their declared scopes |

The seven targeted cases are included in the 99 API tests and are not added again. New negative checks cover unissued/wrong-version/cancelled/foreign-member/foreign-branch/foreign-tenant tuples, export-only access, branch catalog exclusion, current-target eligibility, occurrence cancellation and current membership denial. Earlier raw-default fixtures, canonical counts and immutable supplement tests remain in the final dedicated run. Unchanged domain/web/contracts/catalog/scene suites and build retain earlier receipts; no new pass count is claimed for them.

No new browser cases executed; composed HTTP/QA/HTTPS acceptance remains with integration and QA. No claim about hosted CI or full PR21 acceptance is made. No deployment/activation, real data, provider/paid call, credential/security change, task dispatch, force push or application main merge occurred.
