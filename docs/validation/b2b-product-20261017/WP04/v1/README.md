# WP04 reviewed alternatives: immutable v1 receipt

Source revision: `e4680efd476be513329e6733cf1267fabd473dee` on `feat/b2b-reviewed-alternatives-v1`.
Frozen implementation base: `0b611064a91b87b3a17274cabca5415bcf1d7d55` (PR15, including WP13).
Plan: `447d77ebb5587e319018e7b56003f0ef7299bb6c`; Atlas: `ce45d206a2ed4035f8003a3303abd1fff98e09b8`.
The receipt commit changes only this evidence directory. Source paths and SHA-256 digests are in [evidence.json](evidence.json). Later corrections must use v2 or an explicit amendment, preserving v1.

## Delivered behavior

The API projection verifies exact canonical ID, base ownership, published status, version 1, revision 0 and complete seeded content. Matching animation/base IDs never confer reviewed eligibility. Directed canonical relations preserve all conditions, rationale, review citations, target requirements and target content hashes. The reviewed catalog remains 37 exercises, 42 directed relations (8 alternatives, 17 progressions, 17 regressions), with nine empty lists. No relation was invented or changed.

Canonical target dose uses its own sets, repetition range, rest, tempo, bodyweight load and laterality. Canonical exercises currently prescribe repetitions; synthetic domain cases separately exercise both repetitions-to-duration and duration-to-repetitions. Alternating targets retain alternating laterality and per-side counting: left and right each require the minimum prescribed ordinals. Unilateral targets map to per-side. This mapping is explicit, with no unit or load conversion.

`enrichReviewedCatalog(db)` writes only the foundation's separate relation table, verifies unchanged installed rows under share locks, and is idempotent. `seed.ts` reuses the byte-compatible v1 payload builder; it retains ON CONFLICT DO NOTHING. Enrichment is deliberately not called before migration 006 creates its table. The successor migration patch is a CONTRACT request, not an installed migration.

WP02 receives pure publication freezing plus explicit, immutable legacy adoption. Adoption preserves original routine/step identity, original scalar prescription and original snapshot hash; missing legacy load/laterality require explicit confirmation. It rejects changed local source content and forged review metadata. Supplements store routine scope only, avoiding the first adopter's member identity in a shared row. Member envelopes are constructed separately. Retried/concurrent identical adoption produces one supplement and one attributed audit entry. Different content conflicts. Manual legacy allowlists remain in the original snapshot and have a separate presentation label; empty old lists do not imply a block.

Domain helpers create original/reviewed segments, select or explicitly restore exact retained segments, clear completion intent, and initialize fresh actual rows without carried measurement/load/RPE. Earlier actuals remain additional work. Completion counts only the selected segment's minimum set/per-side coverage, with positive actual measurements and independently entered external load; truthful below-target values remain valid. New-segment server checks require current target equipment. Retained historical segments survive later equipment loss. No source-segment credit, reverse/transitive inference, equivalent-load/effect claim or automatic completion is introduced.

The API read seam uses only frozen v2 versions or separately adopted legacy supplements. It checks tenant/branch, membership assignment for self reads, capabilities for staff, active access, snapshot scope and branch catalog exclusions. It never adopts new behavior during a read. ACCESS must register it inside its locked authorized transaction.

New UI components expose distinct blocked/empty states, target dose, readable requirements, condition checkboxes, unavailable-equipment notice and disabled selection until confirmed. Legacy authorizations are separately labelled. Step identity and frozen dose key checkbox state. Existing Session/ProgramEditor/training.ts were not changed.

## Validation

Node `24.19.0`, declared pnpm `12.7.0` through the existing `/workspace/.onboarding/activate.sh`, frozen lockfile/dependencies and disposable loopback PostgreSQL `17.11`. The initial pnpm command verified supply-chain policy and restored existing locked dependencies; no manifest or lockfile changed. PostgreSQL used a new task-owned container/database and ephemeral synthetic schemas. It was removed after validation.

| Command | Final result | Evidence |
| --- | --- | --- |
| `pnpm --filter @klisteniapp/b2b-contracts test` | 22 passed; 0 failed/skipped | [log](contracts.log) |
| `pnpm --filter @klisteniapp/b2b-domain test` | 18 passed; 0 failed/skipped | [log](domain.log) |
| `B2B_TEST_DATABASE_URL=<task-local> pnpm --filter @klisteniapp/b2b-api test` | 97 passed; 0 failed/skipped | [log](api.log) |
| `pnpm --filter @klisteniapp/b2b-web test` | 60 passed; 0 failed/skipped | [log](web.log) |
| `pnpm --filter @klisteniapp/catalog-base test` | 2 passed; 0 failed/skipped | [log](catalog.log) |
| `pnpm --filter @klisteniapp/scene-schema test` | 79 passed; 0 failed/skipped | [log](scene.log) |
| `pnpm lint` | boundaries, 14 package tasks and complete B2B formatting passed; final run reused 11 unchanged tasks | [log](lint.log) |
| `pnpm typecheck` | 14 package tasks passed; final run reused 11 unchanged tasks | [log](typecheck.log) |
| `pnpm build:b2b` | passed; existing large-chunk warning | [log](build-b2b.log) |
| `git diff --check`; both owner patches `git apply --check` | passed | local checks |
| effective Cloud Git identity guard | author/committer Pablo Coronel `<git@pablocoronel.com>` | before each commit |
| Atlas engineering content/commit/PR checker | passed in declared scopes; details below | local checks |

Total final suite tests: **278 passed, 0 failed, 0 skipped**. Repeated iteration runs are not added. Terminal trailing whitespace was normalized before first publication; evidence.json retains raw and normalized log hashes. New package cases are mapped in [acceptance.json](acceptance.json). API regression includes existing upgrade/new-install/repeated migrations, cross-tenant FKs, immutable historical JSON, authorization and queued-revocation cases. New database cases cover fresh/existing seed enrichment, changed canonical row rejection, concurrent supplement replay, single audit entry, immutable supplements, legacy and blocked-v2 reads, unauthorized member/branch/tenant/inactive denial, branch exclusions and later catalog edits.

An early domain fixture omitted strict response fields and one direction assertion named an existing explicitly curated edge; both tests were corrected before final validation. An intermediate root format run overlapped a final domain edit; the final root lint/format run passed. The engineering helper CLI anchors to Atlas rather than cwd, so its direct application-base invocation failed; its unchanged official `commits(app_root, base)` function passed when called with the application root. Atlas's own `check` passed 176 reviewed files; that is not an application-wide English certification. Human review remains necessary for language/provenance accuracy.

## Integration dependencies and limits

[Owner requests](owner-requests.md) include exact export/migration patches and typed service/publication/session/UI calls. Neither patch has been applied to shared files. `007-reviewed-catalog-v1` is proposed numbering; CONTRACT retains the migration registry and readiness decision. Installed databases do not receive enrichment automatically until that owner integrates the hook. The frozen catalog hash guard prevents a future changed catalog from silently changing the migration input; any future catalog amendment must preserve/version the v1 migration input with its owner.

The alternatives endpoint is not registered on this feature branch. UI components are not composed into Session or ProgramEditor. The build verifies the existing consumer and TypeScript verifies the new components; it does not establish interactive browser acceptance for uncomposed components. QA owns the final browser specs. **Zero product browser scenarios executed**; required scenarios are listed in acceptance.json. Matching Playwright runtime is parent/QA evidence at `e71c5c4273a9e18b7422a0250626729417de8a95`, not a result rerun here. HTTPS/Secure-cookie, physical-device and model/Blender gates remain separate. No `check:all`, whole-product build, preview or release-green claim is made; the previously documented Yoga failure is unchanged and was not rerun.

Git push succeeded normally. Local GitHub CLI API access returned Forbidden; PR publication and metadata verification use the connected GitHub tool. No credential, trust or security setting was changed. Source author/committer identity was checked locally; remote GitHub account linkage is separately verified where returned by the connector. No activation, application main merge, production operation, real health/user data, provider/paid call, shared-file write or new task dispatch occurred. Parent retains integration/merge authority. Atlas remains untouched for its single writer.
