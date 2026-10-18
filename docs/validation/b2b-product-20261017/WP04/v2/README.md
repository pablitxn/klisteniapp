# WP04 v2: raw historical hash amendment

This immutable amendment supersedes v1 only for the legacy snapshot hash fix and the new current-catalog selection helper. [v1](../v1/README.md) remains unchanged. PR: https://github.com/pablitxn/klisteniapp/pull/16. Parent retains merge and integration authority.

Amendment base: `c91fbcbaf3dc228630cda66dd2229f2524cb46c9`. Tested source: `31a1deb278f5fed777ee8314d51097a615a9f695`. Original frozen implementation base remains `0b611064a91b87b3a17274cabca5415bcf1d7d55`; plan `447d77ebb5587e319018e7b56003f0ef7299bb6c`; Atlas `ce45d206a2ed4035f8003a3303abd1fff98e09b8`. The subsequent receipt commit changes this v2 directory only. [evidence.json](evidence.json) pins source/fixture/log digests.

## Required correction

Integrator review identified that the alternatives read path hashed a schema-normalized legacy snapshot while supplement storage compared raw historical JSON. The schema can fill missing duration/RPE and historical machine lineage/status/revision fields. A valid old snapshot therefore has a different normalized hash. The initial helper also compared unparsed fields against v2 confirmation, causing adoption failures for omitted values.

`legacySupplement(rawOriginal, confirmedV2, memberId)` now accepts the exact unmodified JSON value read from storage. It computes the identity hash from that raw value and parses a separate semantic projection for comparisons. `saveLegacySupplement` checks and passes through the raw stored value. The read path also checks the raw stored value. None writes normalized/defaulted fields into the original snapshot. Callers must pass the raw database snapshot, not the output of `ProgramVersionSchema.parse`; parsing is for validation and display, not persistence identity. Existing fully specified snapshot hashes retain their meaning. No fallback accepts both hashes or bypasses the hash check.

Two committed exact JSON fixtures exercise repetitions and duration. They omit supported step defaults (`targetRpe`; repetitions also omits `durationSeconds`) and historical machine defaults (`derivedFromId`, `derivedFromVersion`, `revision`, `status`). [fixture-hashes.json](fixture-hashes.json) records exact file SHA-256, raw content hash and the deliberately different normalized content hash.

Tests show valid adoption, replay and alternatives reads for both fixtures; raw input objects remain unchanged. Real PostgreSQL checks compare `snapshot::text` and its SHA-256 before/after accepted adoption, replay, rejected normalized-hash input and rejected tampered input. Source hashes must equal the raw snapshot hash; replacing them with normalized or changed-content hashes fails. Changed original content is rejected by semantic validation. Historical original bytes/IDs and immutable supplement rows remain preserved. PostgreSQL JSONB's stored text is checked separately from the fixture file's original serialization; neither is represented as the other's exact byte format.

## WP03 coordination seam

`assertNewReviewedCatalogEligibility(context, content, previous)` is added in owned `catalog/reviewed-alternatives.ts`. It uses the same authorized transaction/connection and checks current published, unchanged canonical base target rows against selected-branch catalog exclusions. New segments and explicit restoration of a previously unselected retained segment require current eligibility. Missing/changed/draft/foreign-local targets, excluded branch rows or outdated catalog revision fail with `409 REVIEWED_TARGET_UNAVAILABLE`.

An unchanged retained historical selection remains usable for history/log correction if the catalog is later edited or hidden. The helper does not rewrite or remove segments/actuals. It complements frozen-relation/domain checks and live equipment checks; it cannot authorize a request on its own. [owner-requests.md](owner-requests.md) gives the exact WP02/WP03 handoff. No WP03, shared service/route, schema, manifest or barrel file was edited.

## Validation and limits

Node 24.19.0, declared pnpm 12.7.0 via the existing activation script, unchanged frozen dependencies, disposable loopback PostgreSQL 17.11. Task-owned container/database and schemas were removed after checks. No real data, production, provider, credential/security change, task dispatch, force push or main merge.

| Command | Result |
| --- | --- |
| `B2B_TEST_DATABASE_URL=<task-local> pnpm --filter @klisteniapp/b2b-api exec node --test tests/reviewed-alternatives.test.ts` | 6 passed, 0 failed/skipped; included in full suite below |
| `B2B_TEST_DATABASE_URL=<task-local> pnpm --filter @klisteniapp/b2b-api test` | 98 passed, 0 failed/skipped |
| `pnpm --filter @klisteniapp/b2b-api typecheck` | passed |
| `pnpm --filter @klisteniapp/b2b-api lint` | passed |
| `pnpm check:b2b:boundaries` | passed |
| `pnpm lint` | 14 tasks, 13 unchanged cache hits; boundaries and complete B2B formatting passed |
| `pnpm typecheck` | 14 tasks, 13 unchanged cache hits; API checked at amended source |
| new JSON fixtures: `pnpm exec prettier --write <fixture paths>` | formatted; final scoped TypeScript/source formatting passed via root lint |
| `git diff --check`, effective identity and official engineering commit/PR checks | passed in documented scopes |

The six targeted tests are not added to the 98-test full API count. Unchanged domain/web/contracts/catalog/scene suites and B2B build retain their v1 evidence; they were not rerun or counted as new passes for this API-only amendment. Product browser cases remain unexecuted pending composed-head QA. Owner migration/export/route/publication/session/UI wiring requests from v1 remain outstanding, now with the additional raw-input and current-catalog requirements. The supplied helper's real-database tests cover branch exclusion, edited current target rejection, explicit restore denial and unchanged historical selection preservation. Hosted CI status and final integrated/HTTPS/browser acceptance remain separate from these local results.
