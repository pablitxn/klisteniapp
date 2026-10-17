# WP01 roles and audit v1 evidence

Status: owned modules ready; **package acceptance incomplete** pending the PLANNING patch and composed browser acceptance. No production activation, application merge or deployment occurred.

## Immutable inputs and scope

- Work package: WP01 / Atlas A01; branch `feat/b2b-roles-audit-v1`.
- Frozen implementation base: `0b611064a91b87b3a17274cabca5415bcf1d7d55` (PR15 foundation plus integrated WP13).
- Tested code head: `eb906dd7442aa2c6b79ab6b19fa34c17251f4394`.
- Plan: `447d77ebb5587e319018e7b56003f0ef7299bb6c`; main plan, work packages and full WP01 prompt read.
- Atlas: `ce45d206a2ed4035f8003a3303abd1fff98e09b8`; both repositories' AGENTS, Atlas instructions/navigation skill, October 17 source/minutes/roadmap, policies and engineering/identity/integration standards consulted. Atlas was not edited.
- Repositories: `/workspace/klisteniapp` and `/workspace/sysadmin-workspace`, both initially clean on `work`. WP01 created its isolated branch directly from the frozen base.
- Refresh before handoff: remote application main remains `d65261d18de4522fb9a66104aabb5750104fb8b8`; dependency branch `feat/b2b-contract-foundation-v1` remains the frozen base above. The draft PR targets that dependency branch so its diff isolates WP01. Parent owns retargeting/composition/main merge.
- [code-files.txt](code-files.txt) is the exact 16-file code/test scope; [code-files.sha256](code-files.sha256) pins their bytes. The later evidence-only commit changes no code. The PR body supplies the final evidence head, avoiding a recursive self-hash in this report.

The ACCESS lease covers the four named API files, new auth/audit modules and People UI. Only the superseded assigned-coach assertions changed in the shared integration test. No contract, SQL/migration, manifest/lockfile, export barrel, producer training module, navigation, browser fixture or Atlas file changed. [Owner requests](owner-requests.md) include the exact unapplied producer patch and remaining interface gaps.

The prompt's requested model/effort/service tier is GPT-6.1 Sol high/fast. This session exposes no independent control or verification for the serving model/service tier. No new worker or Cloud task was dispatched.

## Implemented behavior

A current locked transaction constructs the v2 context, checks session/host generation/membership/entitlement and the selected branch role, and supplies separate active-planning versus retained-history target authorization. Unified trainer defaults require an unambiguous permitted Principal branch; multi-branch ambiguity fails closed. White-label and product routes share the branch policy. No highest-role aggregation, automatic branch grant or platform authority is introduced.

Organization superadmin inherits own-brand admin capabilities. A narrower admin manages only coaches/members, with current target-role checks before permission receipts. Role changes preserve explicit branch grants. Permission revisions also advance for grant-only changes. Existing database constraints and serialized API checks preserve the last active superadmin. Newly accepted narrower admin invitations retain that role; invitation acceptance rechecks the issuer's current authority and never promotes/reactivates an existing membership.

Accepted mutations atomically persist exact operation receipts and bounded actor/action/tenant/branch/time/field-name/revision audit. Retries return the original response after successors and reject changed payload/scope reuse. Historical audit rows retain unknown metadata; trainer audit reads expose only planning actions in the selected branch. General audit contains no actual/health payloads. Membership deactivation appends consent revocation in the same transaction; reactivation restores none.

Only the six owned v2 routes are mounted: capabilities, access, people, updateMember, inviteMember and audit. Discovery is authenticated before activation. Feature routes remain gated; unfinished producer routes are 404 and `product_active` is never enabled outside disposable synthetic fixtures. Legacy strict DTOs and format gates remain in place.

People discovers activation, keeps the legacy surface before activation, labels the role hierarchy, limits permission controls to current capabilities and reuses operation identities after response loss. Keyed resources and cancellation hide departed account/brand/branch data. A native modal audit dialog includes actor/time/fields/revision references and explicit unknown historical detail. Its browser behavior is supplied to QA, not certified here.

## Runtime and validation

Node `v24.19.0`; pnpm `12.7.0` after sourcing `/workspace/.onboarding/activate.sh`. Unsourced pnpm was `11.25.0`; no dependency operation used it. Frozen installation succeeded with no dependency or policy changes. Disposable PostgreSQL `17.11` ran in the task-owned `klisteni-wp01-pg` container on loopback, database `b2b_wp01_test`, isolated per-test schemas and synthetic identities only. No existing development/production database, real user/health data, provider or paid service was used. Database connection values are omitted from evidence commands.

| Command | Actual result | Evidence |
| --- | --- | --- |
| `pnpm install --frozen-lockfile --ignore-scripts --store-dir /workspace/.onboarding/pnpm-store` | Passed, unchanged lockfile | [install](frozen-install.log) |
| `pnpm --filter @klisteniapp/b2b-contracts test` | 22 passed; zero failed/skipped | [contracts](contracts.log) |
| `pnpm --filter @klisteniapp/b2b-domain test` | 9 passed; zero failed/skipped | [domain](domain.log) |
| `pnpm --filter @klisteniapp/b2b-client test` | 24 passed; zero failed/skipped | [client](client.log) |
| `pnpm --filter @klisteniapp/b2b-web test` | 58 passed; zero failed/skipped, including 2 People capability cases | [web](web.log) |
| `B2B_TEST_DATABASE_URL=<disposable> pnpm --filter @klisteniapp/b2b-api exec node --test tests/product-authorization.test.ts tests/product-audit.test.ts` | 13 passed; zero failed/skipped | [product API](product-api.log) |
| `B2B_TEST_DATABASE_URL=<disposable> pnpm --filter @klisteniapp/b2b-api test` | **104 passed, 1 failed, 0 skipped** out of 105 | [full API](api.log) |
| `pnpm lint` | Boundary check, 14 lint tasks (12 unchanged cached) and formatting passed | [lint](lint.log) |
| `pnpm typecheck` | 14 tasks passed; 12 unchanged cached | [typecheck](typecheck.log) |
| `pnpm check:b2b:boundaries` | Passed | [boundaries](boundaries.log) |
| `pnpm build:b2b` | Passed; existing large-chunk warning | [standalone build](b2b-build.log) |
| `KLISTENI_PUBLIC_PROFILE_FILE=instance-profile.example.json pnpm build:instance` | Passed using the checked-in synthetic public profile; existing large-chunk warning | [unified build](instance-build.log) |
| `git diff --check` | Passed | [metadata checks](metadata-checks.log) |
| `git apply --check .../planning-owner.patch` | Passed; patch **not applied** | [metadata checks](metadata-checks.log) |
| Atlas engineering instruction allowlist / WP01 commit-text / prepared PR-template checks | Passed; heuristic and provenance limits retained | [metadata checks](metadata-checks.log) |
| Effective Cloud identity guard | Both author/committer `Pablo Coronel <git@pablocoronel.com>` | [metadata checks](metadata-checks.log) |

The 13 focused tests cover real PostgreSQL branch/tenant isolation; selected-role downgrades; ambiguous branchless denial; active planning versus inactive history; role hierarchy/platform separation; canonical request identity; exact retries after successors; atomic rollback; invitation role preservation, unrepresentable-grant rejection and issuer revocation; consent deactivation/reactivation; competing last-superadmin removals; and queued **reads and accepted-operation retries** behind session, membership, branch and domain-generation revocation. HTTP tests authenticate discovery, validate path/body/account/version identities, enforce activation and confirm producer 404s. The full suite retains old migration/hash, white-label authorization and training regressions without skips.

The one full-suite failure is intentional evidence of an **unfinished integration requirement**, not an accepted test failure: `integration.test.ts` now expects same-branch unassigned assignment visibility, while PLANNING's frozen repository still applies assigned-coach filters. Consequently unassigned assignment creation and history-query visibility remain unaccepted until [the exact patch](planning-owner.patch) is integrated and the suite rerun. WP01 did not edit outside its lease or weaken the new expectation.

Earlier diagnostic runs exposed three obsolete assigned-coach assertions (updated only within the granted test lease) and one synthetic consent-category fixture mistake (corrected to the frozen `activity` category). One incidental audit invocation omitted the database environment and reported **1 passed / 4 skipped**; its [log](incidental-no-db-audit.log) is retained, is not acceptance, and was superseded by configured runs above with zero skips. A first unified build omitted the required public-profile setting and [failed](instance-missing-profile.log); the configured synthetic-profile build above passed. An initial formatting check ran while the callback was still being edited; final lint/format checks above pass.

## Remaining acceptance and handoff

1. PLANNING/parent applies the exact coverage/history-purpose patch and reruns the full API suite; then exercise edit/publish/assign and inactive historical target routes on the composed head. This is a package acceptance blocker.
2. CONTRACT resolves arbitrary invitation grant arrays if required: frozen SQL supports one invitation branch. Unsupported combinations currently fail atomically; no accepted data is silently discarded. The required successor table/fixture request is in owner-requests.md.
3. INTEGRATION composes complete producer services, revision/audit calls, explicit branch selection in both shells and planning audit affordances. No placeholder endpoint is activated here.
4. WP12 owns all new product browser specs/fixtures and executes [browser-scenarios.md](browser-scenarios.md) at the required Chromium/WebKit mobile/desktop matrix on the composed head, using matching Playwright 1.63 guidance. **No browser scenario or layout/accessibility acceptance was run or counted as passing here.**
5. WP06 receives the shared ACCESS family only sequentially after the parent accepts this immutable handoff. WP01's own implementation is finished; no simultaneous shared-file editing is requested.

No claim of full `pnpm check:all`, whole-repository test/build acceptance, current CI, valid-trust HTTPS/Secure cookies, physical devices, provider behavior, Yoga/Blender resolution or deployment is made. Existing October 12/16 records, WL-0-WL-8, snapshots/log IDs and unrelated release gates remain unchanged. Freeze this directory after publication; amendments belong in a new evidence revision.
