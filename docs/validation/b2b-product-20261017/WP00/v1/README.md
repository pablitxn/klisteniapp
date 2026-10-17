# WP00 foundation freeze validation

Source commit: `bb34a4fb4547f33ccb05b7c13f23a68becdef2b2`. The subsequent receipt commit changes documentation/evidence only; its source-tree digest must match evidence.json. Use the final PR/parent handoff SHA as the dependency revision. Branch: feat/b2b-contract-foundation-v1; draft PR [15](https://github.com/pablitxn/klisteniapp/pull/15). No app-main merge or activation occurred.

Read the [adopted ADR](../../../../adr/b2b-training-v2.md) and [dispatch handoff](../../../../contracts/b2b-product-v2/README.md). Baseline main remains d65261d18de4522fb9a66104aabb5750104fb8b8. Atlas prerequisite remains ce45d206a2ed4035f8003a3303abd1fff98e09b8. Plan ancestry is 447d77ebb5587e319018e7b56003f0ef7299bb6c. WP13 head 6d0b5619c3f18ae4c2c52566e3e478166c60f00e is merged into this branch, preserving its commits.

## Final affected acceptance

Node 24.19.0, declared pnpm 12.7.0, disposable local PostgreSQL 17.11. All database tests used task-owned b2b_wp00_test/b2c_wp00_test on loopback in a disposable container. No real-user data, existing development database, provider health access, production or paid service was used.

| Command | Result |
| --- | --- |
| pnpm --filter @klisteniapp/b2b-contracts test | 22 passed, zero failed/skipped |
| pnpm --filter @klisteniapp/b2b-client test | 24 passed, zero failed/skipped |
| pnpm --filter @klisteniapp/b2b-domain test | 9 passed, zero failed/skipped |
| B2B_TEST_DATABASE_URL=<disposable> pnpm --filter @klisteniapp/b2b-api test | 92 passed, zero failed/skipped; includes all eight migration/gate cases and two health-boundary cases |
| pnpm exec turbo run typecheck --force | 14/14 passed, zero cache hits |
| pnpm exec turbo run lint --force | 14/14 passed, zero cache hits |
| pnpm check:b2b:boundaries | Passed |
| pnpm format:b2b:check | Passed |
| git diff --check; Cloud identity guard; official engineering commit checker | Passed; preserved current identity, no history rewrite |
| pnpm install --frozen-lockfile --ignore-scripts | Passed using pnpm 12.7.0, normal policy checks; no version upgrades |

The 147 final affected tests are not added to earlier repeated runs. Logs and SHA-256 digests are in evidence.json. The legacy fixture digest identifies exact synthetic input. Migration tests compare complete historical relational projections and database JSON text/hash before/after upgrade and repeat migration; published routine/execution/audit/media/grant bytes and links remain equal.

Migration cases cover empty install, 001-005 upgrade/repeat, two brands/four branches, role/invitation capability mapping without platform grants, last-superadmin competing deactivation, tenant/branch/member FK rejection, append-only revisions/original linkage, v2 draft/version/assignment/corrected-execution guards, prevention of legacy overwrite, exact legacy retry preservation and activated legacy callbacks denied after current authorization checks. SQL and schemas do not claim to implement the downstream schedule/consent/session domain services.

## Integrated WP13 and supporting regression

The exact requested scene-schema health-import export is applied. Ordinary scene-schema tests passed 79/79, ordinary B2C web tests passed 204/204 and ordinary B2C typecheck passed without NODE_OPTIONS loaders or validation-only path mapping. The API-only dependency and boundary allowance are registered; B2B contracts/domain/client/web remain unable to import scene-schema. Pure B2B adapter tests compare canonical normalized preview bytes and reject invalid measurements/unsupported formats.

An earlier full uncached 14-package sweep passed 637 tests, including 97 B2C API database tests and 91 B2B API tests at that working-tree stage, plus 26 root-script tests. The final affected suites above supersede earlier contract/client/API counts after the last guard/interface changes. The full sweep is supporting regression evidence, not a claim that its intermediate tree equals the final SHA. Parser/B2C source did not change after their ordinary checks.

The lockfile change is only the existing local scene-schema workspace link. Offline regeneration/install first failed because registry policy metadata was absent. No policy was disabled: the minimal local link was recorded and the normal frozen online install succeeded with the exact existing versions. Legacy white-label training fixtures required migration 005/006 because current runtime correctly refuses missing format discriminators. Those fixtures were advanced, not the guard weakened. An intermediate formatting check caught concurrently edited files; final formatting passed after formatting those files.

Two executor transport disconnections were observed. Safe reads recovered the same working tree both times; checkpoint c21ccfd7b64b514008862d3cfab3cb3b8a128c74 and then source bb34a4f were pushed before final receipt. No task was duplicated or restarted.

## Remaining integration gates

WP00 has no browser-layout deliverable. It executed zero product-browser scenarios. Parent reports WP12 matching Playwright 1.63 runtime/transport smoke is now available at e71c5c4273a9e18b7422a0250626729417de8a95; that is separate evidence and not re-executed here. All 88 product scenarios still require integrated application/database acceptance and valid-trust HTTPS where applicable. No browser bypass or runtime substitution was used.

No new UI feature/build/release claim is made. Full composed builds, cross-feature browser/HTTPS acceptance, physical-device and deferred model/Blender evidence remain integration gates. The previously documented Yoga extraction-receipt failure remains a known unrelated baseline issue; this task did not alter previews or relabel that failure. GitHub CI/check-run coverage is separate from these local results.

Parent owns dispatch. WP01/WP02/WP03/WP04/WP05 can consume the frozen contracts on their isolated branches. CONTRACT/INTEGRATION retains shared schema, export, manifest, lockfile and registration ownership; ACCESS takes shared http/service/context only through the explicit parent handoff. No feature service is activated by migration 006. Canonical Atlas remains untouched for WP15's eventual single-writer receipt.
