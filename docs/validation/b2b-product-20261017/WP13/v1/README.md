# WP13 v1: pure manual health import extraction

Observed locally on 2026-10-17. This receipt covers implementation and synthetic
validation, with the package export still awaiting its exclusive integration owner.
It does not establish integrated product acceptance, CI, provider behavior or deployment.

## Revisions and ownership

- Repository: `pablitxn/klisteniapp`; branch `refactor/health-import-adapter-v1`.
- Audited application: `d65261d18de4522fb9a66104aabb5750104fb8b8`.
- Plan: `447d77ebb5587e319018e7b56003f0ef7299bb6c`.
- Reserved branch base: `b75b76de8f07a8a44847fbf86b112ea278880483`.
- Tested implementation: `ab3a19a245c4191d2b7d5e3a1bb3e79157c23ef9`.
- Atlas read-only context: `ce45d206a2ed4035f8003a3303abd1fff98e09b8`.
- Parent source thread: `01a118ed-6bf7-7481-93e6-336de48270f7`.
- CONTRACT/INTEGRATION: Astra thread `01a149e8-505b-7469-987b-3d99819c90ed`.

The implementation commit contains only the reserved parser, B2C wrapper, tests
and synthetic fixtures. The subsequent receipt commit adds only this evidence
directory. The published PR records its final immutable head. The branch retains
the plan and reservation ancestry; the intended stacked PR base is
`feat/b2b-contract-foundation-v1` at the reservation SHA above. Remote application
main was rechecked as the audited SHA; the foundation ref was rechecked as the
reservation SHA before publication. Parent retains merge authority.

Read the application and both Atlas AGENTS, local `atlas-navigate` and
`atlas-maintain` skills, source-of-truth/privacy policies, October 17 source/minutes,
A00-A08, language/identity/integration standards, and pinned plan/work-packages/prompts.
Atlas was not changed. No sub-agents were spawned; dispatch model/service controls
were not available to this worker.

## Result and compatibility

`packages/scene-schema/src/health-import.ts` contains the existing parser body
unchanged, using internal health/calendar imports where available. The existing
pure `dateInTimeZone` helper remains in `src/index.ts`; its direct import avoids
duplicating calendar behavior. The importer is deliberately absent from that
root barrel, so it introduces no runtime import cycle.

The B2C module re-exports the reserved package subpath. Existing runtime/type
symbols retain their names and behavior. The new `HealthImportAdapter` type and
`klisteniHealthImportAdapter` descriptor expose the exact existing format/version,
five categories, 2 MiB/10000-record bounds, preview and template functions, and
`manualOnly: true`. There are no provider, account, consent, storage or DOM actions.

Twenty-five golden preview cases and two exact template strings were captured
from the original importer at the audited SHA before extraction. Tests compare
serialized output bytes, including localized failures. They preserve source
identity, equivalent offsets, ID collisions, normalization, category counts,
sorting, zero/false/absent values and atomic failure. Frozen current-state inputs
prove nonmutation on both successful and rejected imports. Additional cases test
DST/local midnight, sleep/modified timestamp equivalence, inclusive byte/row
limits and cumulative merged-state rejection. All data is synthetic.

Supported format remains normalized `klisteniapp.health` version 1. Samsung CSV,
Health Connect ZIP and raw vendor JSON remain rejected. Source labels preserve
provenance and do not advertise a vendor-format parser.

## Shared-file request and integration blocker

Apply [integration-exports.patch](integration-exports.patch) as the exclusive
INTEGRATION owner. It adds exactly:

```json
"./health-import": "./src/health-import.ts"
```

to `packages/scene-schema/package.json` exports. `git apply --check` passes. This
metadata-only addition needs no dependency or lockfile change for WP13. No shared
manifest, barrel, lockfile, boundary rule or B2B file was edited by WP13.

Until this patch is incorporated, the ordinary B2C test and typecheck commands
cannot resolve the wrapper's reserved subpath. Their failures are a current
integration dependency, not passing acceptance. After applying the export, rerun
the ordinary commands below without validation-only resolution aids.

B2B API composition/dependency registration, normalized-to-B2B envelope mapping
and its API-only boundary exception remain with INTEGRATION/WP05. No B2B
contracts/domain/client/web import of scene-schema is introduced or requested.
Do not export this importer from the scene-schema root barrel.

## Validation

Environment: Node `v24.19.0`, pnpm `12.7.0` after sourcing the saved environment's
`/workspace/.onboarding/activate.sh`; locked dependencies already provisioned.
The unsourced shell exposed pnpm `11.25.0`; no pnpm command used that version for
validation. No dependencies, credentials or security settings were changed.

| Command / scope | Actual result |
| --- | --- |
| Before extraction: `node --test apps/b2c-web/test/health-import.test.ts apps/b2c-web/test/health-store.test.ts packages/scene-schema/tests/health.test.ts` | 35 passed; 0 failed/skipped |
| `node --test packages/scene-schema/tests/health-import.test.ts` | 33 passed; 0 failed/skipped |
| `pnpm --filter @klisteniapp/scene-schema test` | 79 passed; 0 failed/skipped |
| `pnpm --filter @klisteniapp/scene-schema typecheck` | Passed |
| `pnpm --filter @klisteniapp/scene-schema lint` | Passed |
| `pnpm lint` | Passed: boundary check, 14 package lint tasks and B2B formatting check |
| ESLint on the four changed source/test TypeScript files | Passed after fixing an unused test-only destructuring binding |
| `pnpm check:b2b:boundaries` | Passed with existing boundary rules unchanged |
| `node --test scripts/b2b-boundaries.test.mjs` | 8 passed; 0 failed/skipped |
| `pnpm --filter @klisteniapp/b2c-web test` | 190 passed; 1 failed test-file load; 0 skipped; `ERR_PACKAGE_PATH_NOT_EXPORTED` for the reserved subpath |
| `pnpm typecheck` | 13 successful package tasks; B2C web fails on the missing subpath and cascading missing-export/type errors |
| Focused importer/store/health tests with `register-subpath.mjs` | 69 passed; 0 failed/skipped; validation-only export simulation |
| `node --import ./docs/validation/b2b-product-20261017/WP13/v1/register-subpath.mjs --test apps/b2c-web/test/*.test.ts` | 204 passed; 0 failed/skipped; full B2C unit suite with validation-only export simulation |
| `pnpm exec tsc --noEmit --project docs/validation/b2b-product-20261017/WP13/v1/b2c-subpath-validation.tsconfig.json` | Passed with a validation-only TypeScript path mapping |
| `node docs/validation/b2b-product-20261017/WP13/v1/verify-baseline-parity.mjs` | 25 preview and 2 template fixtures match the audited importer; implementation body is byte-identical |
| `git apply --check docs/validation/b2b-product-20261017/WP13/v1/integration-exports.patch` | Passed; patch not applied |
| `git diff --check` | Passed |
| Atlas `tools/check_engineering_content.py check` | 176 files checked; passed; does not certify human language/provenance review |
| Atlas effective Cloud Git identity guard | Passed before each commit: author and committer `Pablo Coronel <git@pablocoronel.com>` |
| Atlas `check_engineering_content.commits(Path('/workspace/klisteniapp'), reservationSHA)` | Implementation commit passed; explicit app root is required because the helper CLI targets Atlas |

The validation-only Node resolver maps exactly one reserved subpath to its source
file. It does not alter the package manifest or production resolution. The
validation-only TypeScript config extends the real B2C config and adds only that
path mapping plus an explicit relative Vite type-library location needed from
the evidence directory. Its first attempt lacked that type-library location and
failed with TS2688; the corrected config passes. Neither aid substitutes for
rerunning ordinary test/typecheck commands after integration.

Browser/physical-device/HTTPS/provider/DB/deployment tests were not run: this is
a pure extraction with unchanged UI and no B2B registration or storage. Per WP13,
no speculative browser run is required for move-only code. No full build or
real-user health data was used. GitHub CLI API lookup returned HTTP 403; publication
uses the connected GitHub app without changing authentication settings.

## Receipt policy

Freeze this v1 evidence when published. Later integration or corrections require
a separate amendment/version linking this receipt and its immutable commit.
The parent must apply the shared export and validate the combined tree before
treating WP13 as integrated. CI state and final remote branch/base/head are recorded
in the draft PR, without presenting local checks as hosted CI acceptance.
