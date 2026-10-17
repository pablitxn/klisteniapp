# WP10 health UI validation v1

Date: 2026-10-17 UTC. Scope: Atlas A07, manual B2B health import,
explicit scoped consent settings and online trainer disclosure.

Implementation: `7c223969cfecff8549d20462e8770bf4c332517b` on
`feat/b2b-health-ui-v1`, from frozen
`0b611064a91b87b3a17274cabca5415bcf1d7d55`.
The subsequent evidence-only commits carry this immutable directory; the final SHA
is the final PR head in the publication receipt. No source changes follow the
implementation SHA in this revision.

## Authority and dependencies

- PLAN: `447d77ebb5587e319018e7b56003f0ef7299bb6c`, including the main plan,
  work-packages and full WP10 prompt. The supplied frozen implementation base
  supersedes the plan's earlier audited application base.
- Atlas: `ce45d206a2ed4035f8003a3303abd1fff98e09b8`. Read both repositories'
  AGENTS, Atlas AGENTS and local `.agents/skills/atlas-navigate/SKILL.md`,
  source-of-truth/privacy policies, October 17 definition source/minutes and
  roadmap, and language, integration and Cloud Git identity standards.
- Frozen owner-repo contracts: `docs/contracts/b2b-product-v2/README.md`,
  endpoint inventory, `docs/adr/b2b-training-v2.md`, product health/access/common
  schemas, client/transport and actual health/consent SQL in product-schema.
- WP05 PR17: `b5715612f989b66327a2f89d7df94813bbebf98a`; read its
  `WP05/v1/integration-request.md` and implementation. Its exact head was checked
  out in a separate detached dependency worktree for tests. It was **not merged**
  into this feature branch. Shared parser is already in the frozen base.
- Ref observations before publication: main
  `d65261d18de4522fb9a66104aabb5750104fb8b8`; PR base branch
  `feat/b2b-contract-foundation-v1` remains the frozen base above.

Parent retains dispatch, monitoring, composition and merge decisions. No worker,
subagent or Cloud task was dispatched. The package prompt requests GPT-6.1 Sol
high/fast; this task inherits its platform configuration. There is no exposed
control here to change this task's model, reasoning or service tier, and no
claim of independently verified dispatch settings.

## Delivered behavior

- `HealthSettings` uses injected current access and identity/host/branch binding.
  Manual JSON file recognition rejects CSV/ZIP/unknown versions and oversized
  UTF-8 before upload. The API remains the sole semantic parser. Preview shows
  per-category additions, duplicates and rejection issues; any issue/conflict
  prevents confirmation. Preview expiry and expected revision are enforced.
- Confirm sends the reviewed immutable request and hash. Uncertain delivery
  retries the same operation, including after ticket expiry, so WP05's durable
  receipt can resolve acceptance. Import never calls a consent mutation.
- Default-private status is displayed after current settings load. Sharing
  requires category selection and a separate acknowledgement of brand, branch,
  dynamic current-and-future authorized trainer audience and disclosure v1.
  Existing categories can be replaced; revoke invalidates trainer views before
  dispatch and after success, then reloads current settings. A failed mutation
  never claims revocation succeeded. Other-branch grants are disclosed, with
  branch selection delegated to the shell.
- `TrainerHealthView` requires active selected-branch coach access and the
  read-consented-health capability. Administrative scope alone is insufficient.
  The server still authorizes each disclosure. The UI displays only returned
  categories and recorded values with their original units/provenance, without
  profile/goals, aggregation, recommendations or medical inference.
- The frozen client supplies strict v2 input/output parsing, the version header,
  selected branch, abort and `cache: no-store`. Feature state is memory-only.
  No trainer export, durable store, query cache or offline projection exists.
- Trainer data clears before every request and on disconnect, blur, background,
  pagehide, session notification, context abort and health invalidation. Epoch
  checks reject late responses/file reads that ignore cancellation. A changed
  context or member selects a blank store during render. Reconnect/focus and
  15-second foreground checks obtain a new authorized projection. Native owner
  file-picker focus changes preserve the import workflow.
- An injected personal-export action remains available for export-only access;
  operational health endpoints are never called in that mode. The inactive view
  explains revocation and the need for a new grant after reactivation. Automatic
  deactivation revocation belongs to WP05/WP06 transactions and composed tests.

English source comments, test names and authored documentation follow Atlas.
Spanish user-visible product localization is intentional, consistent with the
existing app. Legacy records, contracts, snapshots, log IDs, B2C storage and
identity/billing are untouched.

## Ownership and files

[files.txt](files.txt) lists all 13 implementation/test files, and
[source-sha256.txt](source-sha256.txt) binds their exact bytes. Production edits
are confined to `apps/b2b-web/src/features/health/**`; dedicated tests are
`healthConsentState.test.ts`, `healthImportFlow.test.ts`, `healthLifecycle.test.ts`
and their `healthFixture.ts`. Remaining edits are this WP10 evidence directory.

No DTO, schema/migration, manifest/lockfile, shared client/export barrel,
HTTP/service/access provider, shell route/navigation, browser spec/fixture or
Atlas file was edited. [integration-request.md](integration-request.md) gives
the exact import/props/event/export wiring contract.

## Validation

Runtime: Node `24.19.0`, pnpm `12.7.0`, activated through the existing onboarding
script. Frozen install reused the declared lockfile/dependencies with zero
downloads. Neither manifest nor lockfile changed.

All final test runs have **zero failures, skips, cancellations and todos**.
The 38 focused tests are a subset of the 94 web tests. There are 390 distinct
tests on the feature tree and 22 on the separate producer head; that separation
does not establish a composed-tree pass.

| Exact command / scope | Result | Evidence |
| --- | --- | --- |
| `pnpm --filter @klisteniapp/b2b-contracts test` | 22 pass | [contracts.log](contracts.log) |
| `pnpm --filter @klisteniapp/b2b-domain test` | 9 pass | [domain.log](domain.log) |
| `pnpm --filter @klisteniapp/b2b-web test` | 94 pass | [web.log](web.log) |
| `node --test apps/b2b-web/tests/healthConsentState.test.ts apps/b2b-web/tests/healthImportFlow.test.ts apps/b2b-web/tests/healthLifecycle.test.ts` | 38 pass | [health-focused.log](health-focused.log) |
| `node --test packages/scene-schema/tests/health.test.ts packages/scene-schema/tests/health-import.test.ts` | 45 pass | [scene-health.log](scene-health.log) |
| `node --test apps/b2c-web/test/health-import.test.ts apps/b2c-web/test/health-store.test.ts apps/b2c-web/test/health-dashboard.test.ts` | 31 pass | [b2c-health.log](b2c-health.log) |
| `pnpm --filter @klisteniapp/b2b-api test` | 92 pass, including migration/compatibility/races | [b2b-api.log](b2b-api.log) |
| `pnpm --filter @klisteniapp/b2c-api test` | 97 pass | [b2c-api.log](b2c-api.log) |
| At exact WP05 head: `node --test --test-concurrency=1 apps/b2b-api/tests/health-import.test.ts apps/b2b-api/tests/health-consent.test.ts apps/b2b-api/tests/health-revocation-races.test.ts` | 22 pass | [producer-health.log](producer-health.log) |
| `pnpm typecheck` | 14 packages pass; 13 unchanged package cache hits on final run | [typecheck.log](typecheck.log) |
| `pnpm lint` | Boundary, 14 package lint and repository B2B formatting pass; 13 unchanged lint cache hits | [lint.log](lint.log) |
| Target web `typecheck` and `lint` | Pass, direct final checks | [web-typecheck.log](web-typecheck.log), [web-lint.log](web-lint.log) |
| `node scripts/check-b2b-boundaries.mjs` | Pass | [boundaries.log](boundaries.log) |
| `pnpm build:b2b` | Pass; existing large-chunk warning retained | [build.log](build.log) |
| `node /tmp/wp10-health-bundle.mjs` | Both unrouted UI modules and CSS compile, 131 modules | [health-module-build.log](health-module-build.log), [exact build script](build-health-modules.mjs) |
| Atlas identity helper, engineering check and scoped commit check | Pass; language/provenance still require human review | [identity.log](identity.log), [engineering-check.log](engineering-check.log), [commit-check.log](commit-check.log) |

Tests ran against an isolated local PostgreSQL container with tmpfs storage and
localhost port 55410, image
`sha256:79bd7c99e923138f136f8009d6bffa66e21e9d4fda5c0c561b00fc9c90cfe537`.
Only synthetic databases were created: `klisteni_b2b_wp10_test`,
`klisteni_b2c_wp10_test` and the WP05 fixture-required `klisteni_b2b_test`.
Database URLs were supplied only to these local test processes. No existing
application/onboarding database or real health data was read. The container was
removed after tests; there is no retained database dump.

Iteration corrections: native Node strip-only mode rejected an initial
TypeScript parameter property; it was replaced with an erasable declaration.
An initial scene-schema command used `test/` instead of `tests/` and discovered
zero cases; it is not counted. The initial WP05 run rejected the nonstandard
synthetic database name at its fixture guard; the corrected isolated database
run passed all 22 cases. No fixture/security guard was relaxed. Final logs above
record the corrected executed cases.

The Atlas commit helper CLI binds its own repository root, so a direct CLI call
with the application base cannot resolve that revision there. The retained
commit check imports the unmodified helper and calls
`commits(Path('/workspace/wp10-health'), BASE_SHA)` with the application root.
PR-text validation uses the helper CLI and the concrete prepared metadata.

## Remaining gates

- **INTEGRATION/ACCESS:** route/navigation/export composition, real current
  access/host generation, abort signals, server health response headers/body
  limits and all WP05 registration requests remain outstanding in this branch.
  Remote consent/role/member revocation must reach the shell's invalidation
  path to clear immediately; same-origin BroadcastChannel alone cannot notify
  other devices. The 15-second foreground fallback is subject to browser
  scheduling and cannot establish instantaneous remote revocation.
- **QA/WP12:** the complete browser matrix is unrun, not passed or silently
  skipped. [browser-scenarios.md](browser-scenarios.md) supplies the privacy,
  late-response, inactive, cross-scope, picker, keyboard and layout cases. Await
  the parent-supplied composed head. No QA-owned browser spec was created.
- The module bundle is compile evidence only. Root build currently omits
  unrouted health entrypoints, hence the additional direct module build. Neither
  proves routed DOM behavior, HTTP authorization/no-store response headers,
  real-browser cancellation, mobile layout or valid-trust HTTPS cookies.
- GitHub CI/status, physical devices and all historical Yoga/content/archive/
  provider/backup/release gates retain their owners. Local checks are not CI.
  No production deployment, real provider call, paid call, application main
  merge, force push, credential or operational security change was performed.

Once published, this `v1` directory is frozen. Corrections require a successor
evidence revision with an explicit supersedes link.
