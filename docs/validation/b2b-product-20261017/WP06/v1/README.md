# WP06 inactive membership and personal export receipt

Status: owned modules ready for integration; full HTTP/UI acceptance pending the shared composition lease. Draft PR [24](https://github.com/pablitxn/klisteniapp/pull/24). No product activation, production operation, application main merge, real identity/health data, external provider or B2C conversion was performed.

## Immutable revisions and ownership

- Assigned branch/base: `feat/b2b-inactive-export-api-v1` from `7a046c099443f7433c8c7ec213ac37cc92e0f241` (PR21, migration008).
- Tested source head: `c36db34cf574afc6518a9ef0522c73564e4e8f7a`. The following evidence-only commit is the published final head recorded in the PR/handoff. This v1 directory is frozen at publication; corrections require v2.
- Plan SHA: `447d77ebb5587e319018e7b56003f0ef7299bb6c`; frozen implementation foundation: `0b611064a91b87b3a17274cabca5415bcf1d7d55`; Atlas: `ce45d206a2ed4035f8003a3303abd1fff98e09b8`.
- Inspected producer dependencies: WP01 `af1fef78f912d746f79a00c52c261f03b58b4fe9`, WP03 `d12b56b92304764f988b051350b6211b7f1e38ba`, WP05 `9029ea573872c3dd44265af33d0aea13c7a56bcd`. Integration refresh `90994bd82e724a7f03712a16f7e164edb305111a` was read without silently replacing the assigned base.
- Read app/Atlas AGENTS, mounted atlas-navigate/atlas-maintain, source/minutes/A00-A08, C01-C08, frozen work packages/prompts, contract README/ADR/schemas/endpoint inventory and actual SQL through migration008. Atlas was read only. Parent retains dispatch, monitoring, lease transfer and merge decisions. No new tasks or subagents were dispatched.

Only owned files changed: `apps/b2b-api/src/membership/access.ts`, `src/exports/{index,training}.ts`, `tests/{inactive-access,personal-export,reactivation}.test.ts`, `tests/wp06/fixture.ts`, and WP06 validation evidence. Shared http/service/organization-context/white-label-access, DTOs, SQL/registry, config, manifests, lockfile, exports, client registration, navigation and QA-owned browser fixtures/specs were not edited. [source-files.sha256](source-files.sha256) lists exact source/checkpoint paths.

## Implemented behavior

`bindInactiveBrandSession` admits only a known inactive membership on a verified correct host after password authentication creates a live own session. Product v2/header/migrations/activation are required; a foreign existing brand binding cannot be rebound. `authorizeExportIdentity` builds only the frozen self identity context in the caller's transaction, with current session/membership/domain-generation checks. It opens no connection and grants no operational branch context. `inactiveAccess` exposes no branches and only export capability. The restricted allowlist denies every operational endpoint, HEAD/range, media, mutation and queued receipt/write route; sign-out is explicit. General active authorization is untouched.

`createPersonalExportServices` implements the frozen personalExport and b2cInvitation seams. Selected-organization training includes own issued immutable v1/v2 routine versions, legacy originals, all accepted correction/period/occurrence revisions and immutable supplements. Retained/revoked/archived branches remain historical export scope only. It preserves range targets, scalar actual units, reviewed provenance, segments and original IDs/links without querying current catalog/drafts. Payload scope is checked against relational identity; an incomplete current historical pointer fails the entire export. Export does not mutate original JSON. Owner health remains identity-global and private; export is independent of gym consent and uses WP05's owner lock after organization/membership locks.

The versioned envelope marks serverAcceptedOnly. Coverage metadata explicitly excludes unsynchronized local work, other members/organizations, unissued staff drafts/private audit/contact data, media bytes/temporary authorization, historical health-edit receipts and separate B2C data. Historical media references retain no new capability. WP11 must disclose these omissions and keep local-outbox export separate; the frozen strict schema has no human-readable omissions field. A new downloadable textual-manifest field requires CONTRACT's coordinated amendment, not an incompatible worker addition.

Invitation returns a configured HTTPS destination or null, and states separate paid product/no automatic conversion. It performs no account/session/billing/data transfer. Existing WP01 -> WP05 atomic inactivity revocation remains the only hook: no second hook/audit is installed. Tests verify two equal consent IDs in different branches revoke once under migration008, other-tenant consent survives, historical training remains staff-authorized, health is revoked, reactivation retains records/current grants and restores neither revoked branch grants nor consent.

## Actual validation

Node `24.19.0`, pnpm `12.7.0`; frozen dependency install used the existing retained store with no dependency change. `COREPACK_HOME=/tmp/wp06-corepack` avoids writing the restricted home cache. PostgreSQL `17.11`, disposable loopback-only container from retained image digest `sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`; synthetic test database, per-case schema cleanup. The temporary container is removed after validation. No real credentials/data were used.

| Check on tested source head | Result | Evidence |
| --- | --- | --- |
| `pnpm --filter @klisteniapp/b2b-api test`, disposable B2B_TEST_DATABASE_URL | 188 passed, 0 failed, 0 skipped, 0 cancelled | api-full.log, api-results.json |
| Owned three test files | 15 passed, 0 failed/skipped/cancelled; also included in full API 188 | owned-tests.log |
| `pnpm --filter @klisteniapp/b2b-contracts test` | 22 passed, 0 failed/skipped | contracts.log |
| `pnpm --filter @klisteniapp/b2b-domain test` | 22 passed, 0 failed/skipped | domain.log |
| `pnpm typecheck` | 14 tasks passed | typecheck.log |
| `pnpm lint` | boundaries, 14 lint tasks and full B2B format check passed | lint.log |
| `pnpm check:b2b:boundaries`; `git diff --check` | passed | boundaries.log, diff-check.log |
| Effective Cloud identity guard before commits | approved author/committer | identity.log |
| Official Atlas `commits(app_root, base)` | 2 source commits passed | commits.log |
| Official Atlas engineering `check` | 176 allowlisted Atlas files passed; does not certify application prose | engineering.log |
| Prepared five-section PR metadata checker | passed | pr-check.log |
| Disposable test schema cleanup | zero WP01/WP05 fixture schemas remain | schema-cleanup.log |

`static-results.json` records exact commands, exit codes, durations and source head. Initial iteration exposed a fixture relative-path mistake and a wrong test import; both were corrected before the passing frozen-head run. The first pnpm activation attempted an unavailable home-cache path; retry used a task-local cache and succeeded. Initial `gh` GraphQL access returned Forbidden; the connected GitHub tool published the authorized draft PR successfully. These failures were not counted as passes. Earlier exploratory full API/static runs are superseded by this frozen-head receipt. Human review remains necessary for English/provenance and substantive acceptance.

## Acceptance matrix and remaining blockers

| Acceptance | Verified scope | Remaining composition |
| --- | --- | --- |
| Inactive correct-host login; missing/foreign/copy/generation/session denial | Identity/binding functions on real DB, 5 inactive-access tests | Actual password-login HTTP/cookie binding and restricted bootstrap |
| Deny every gym/media/mutation/queue path | Exhaustive frozen endpoint allowlist matrix; existing operational brand/context gates still reject inactive | Install early route guard and self dispatch; stale HTTP/outbox/media GET/HEAD/Range acceptance |
| Own original/revised lossless export and exclusions | 7 personal-export real DB tests, strict round-trip/provenance/units/supplements, stale context/incomplete history/queued inactivity | Register actual self download route, headers/errors and WP11 omission disclosure |
| Retained staff historical training; private/revoked health | Actual WP01/WP05 policy/update services on synthetic DB, migration008 tests and full regression | Composed WP03 HTTP producer acceptance |
| Reactivation restores records/current grants, no revived consent/revoked branch | 3 reactivation tests, atomic rollback/retry, stale contexts and tenant isolation | Composed stale screen/reconnect/browser scenarios |
| Separate B2C invitation | Optional/configured service DTO and no-mutation assertions | Integration config, WP11 UI and no cross-product request browser assertions |

The code is not represented as a fully wired inactive-session feature. Shared files remain leased to Astra integration; no named handoff was received. Exact binding requests, WP11 contract/omission handoff and QA scenarios are in [owner-requests.md](owner-requests.md), supplementing the immutable [early checkpoint](../checkpoint/README.md). Parent must compose these or transfer the lease before full acceptance. A schema amendment is needed only if human-readable manifest text must be inside downloaded JSON rather than disclosed by the UI.

No new browser cases executed: mobile/desktop Chromium/WebKit, deep-link/back/stale active screen, real queued workout replay, configured invitation and downloaded-file UX remain pending composed head/WP11/WP12. Node test skips are zero; these unexecuted browser/HTTP scenarios are not counted as passes or hidden as Node skips. No UI change was made, so UI build/browser execution is deferred to composition. Full root test/build/release/preview checks were not claimed; known Yoga/physical-device/valid-trust HTTPS/provider gates remain independent. No merge/deployment claim follows from these local tests.
