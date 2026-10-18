# WP05 manual health API and revocable consent receipt

Date: 2026-10-17. Status: owned service modules ready; shared HTTP/auth/export
composition and browser acceptance pending their owners. No product activation,
application main merge, production migration or deployment occurred.

| Revision | Value |
| --- | --- |
| Frozen implementation base / PR15 | `0b611064a91b87b3a17274cabca5415bcf1d7d55` |
| Plan read | `447d77ebb5587e319018e7b56003f0ef7299bb6c` |
| Atlas read, unchanged | `ce45d206a2ed4035f8003a3303abd1fff98e09b8` |
| Tested implementation commit | `ec4ca015d54a836b8f46aa5a6d00a99fc253d96b` |
| Branch | `feat/b2b-health-consent-api-v1` |
| Stacked draft PR target | `feat/b2b-contract-foundation-v1` at the frozen base |
| Main observed before publication | `d65261d18de4522fb9a66104aabb5750104fb8b8` |

The receipt commit adds evidence only; its SHA and final PR head are reported in
the draft PR/handoff. `source-sha256.txt` pins every implementation/test file.
This v1 directory is frozen when published; later corrections require a new
receipt revision. No shared manifest, contract, migration, barrel, auth, route,
client, navigation, browser spec or Atlas file was edited.

## Implemented behavior

`createHealthServices` implements all eight frozen `HealthServices` methods.
Manual JSON preview uses the integrated API-only product-health-adapter and is
write-free. Confirmation binds owner/revision/parsed input/normalized output/
expiry, revalidates, and atomically stores owner data and exact operation receipt.
Canonical semantic validation, future observations, UTF-8 2 MiB import, 10000
imported records, 4 MiB accumulated state, duplicate provenance and full-file
conflict rejection remain enforced. Import never grants consent.

Consent is a separate explicit, CAS/versioned owner act scoped to organization,
branch, categories and the disclosed current authorized trainer audience.
Current membership/role/branch grants and target activity are checked in SQL;
capabilities alone are insufficient. Admin/superadmin scope gives no trainer
audience bypass. Revocation fences queued reads and stale grant retries;
final-disclosure revalidation rejects revoked/replaced generations and reloads
current values. The inactivity hook revokes only this gym's grants atomically.
Reactivation never recreates consent. Owner-only export includes full private
state under identity access, including export-only inactive membership.

Health payloads enter only owner storage/receipts, never general gym audit or
routine snapshots. Consent audit contains actor/scope/operation, server time,
before/after revision and field names, without health values. Legacy tables,
snapshot/log IDs and v1 compatibility paths are untouched.

## Validation and environment

Node `v24.19.0`; pnpm `12.7.0` from the declared onboarding activation script.
`pnpm install --frozen-lockfile --store-dir /workspace/.onboarding/pnpm-store`
passed without manifest/lockfile changes. PostgreSQL uses the existing pinned
17-alpine local Docker image and dedicated `klisteni_b2b_test`/
`klisteni_b2c_test` databases. WP05 creates/removes isolated random schemas,
migrates from empty using the real registry and uses only synthetic identities
and measurements. No credentials or database URLs are retained in this evidence.
Tests use READ COMMITTED, distinct connections and observed PostgreSQL lock
waits rather than timing guesses for revocation/collision barriers.

| Command / scope | Result | Skips |
| --- | --- | --- |
| `node --test --test-concurrency=1 apps/b2b-api/tests/health-{import,consent,revocation-races}.test.ts` with private local test env | 22 passed | 0 |
| `pnpm --filter @klisteniapp/b2b-api test` with private local test env | 114 passed, including those 22 and migration/new-install/repeat/legacy/branch/privacy regressions | 0 |
| `pnpm --filter @klisteniapp/b2c-api test` with private local test env | 97 passed, including retained health/account isolation and export | 0 |
| `pnpm --filter @klisteniapp/b2b-contracts --filter @klisteniapp/b2b-domain --filter @klisteniapp/scene-schema --filter @klisteniapp/b2c-web test` | 22 / 9 / 79 / 204 passed, including retained parser/schema/health store | 0 |
| `pnpm typecheck` | 14/14 tasks passed, uncached | n/a |
| `pnpm lint` | boundaries, 14/14 lint tasks and full B2B formatting passed, uncached | n/a |
| Final API typecheck and `pnpm check:b2b:boundaries` after the collision fix | passed | n/a |
| Effective Git identity guard | author and committer Pablo Coronel <git@pablocoronel.com> | n/a |
| Atlas engineering allowlist check | 176 checked; this checks Atlas instructions, not app fluency | n/a |
| Application commit and PR text checks using the Atlas checker | passed; receipt/PR publication adds the final metadata check | n/a |
| `git diff --check` | passed | n/a |

525 unique tests passed across the listed suites; the separate focused 22 are
already included in the 114 API count. There were zero skipped, cancelled or
todo cases in those executions. Full root `pnpm test`, build, previews, browser,
HTTPS/Secure-cookie, physical-device and provider acceptance were not run by
WP05. No unavailable case is represented as a pass.

Iteration disclosure: first focused run was 9 passed / 12 failed / 0 skipped
because a PostgreSQL JSONB audit parameter was incorrectly passed as a JS array.
The fix explicitly serializes that parameter; the next run passed all 21 cases.
Manual race review then added an owner-and-revision SQL upsert guard and a
deterministic 22nd test for competing owners using the same absent consent ID.
The final focused and full API runs include that guard/test and pass.

## Acceptance coverage and remaining boundaries

- `health-import.test.ts` (8): preview/no-write; owner override; canonical
  units/duplicates/future dates; provenance/dedup/atomic conflict; exact retries
  after expiry/successors; owner/input/revision/expiry fences; rollback; file/
  accumulated limits; unsupported input no-write; concurrent confirmation/CAS.
- `health-consent.test.ts` (7): default deny; precise category projection with
  no profile/goals; wrong audience/category/scope/owner; dynamic branch audience;
  current role/grants; consent CAS/replay/audit; owner/brand list isolation;
  inactivity rollback/revocation across branches/gyms/reactivation; own export.
- `health-revocation-races.test.ts` (7): queued read vs revoke; prepared response
  vs revoke/regrant and owner edit; queued role/grant loss; inactive queued
  import/export; stale grant update/retry; inactive target defense; absent
  consent ID collision between distinct owners.

These are real-DB feature tests with a synthetic context builder, not WP01's
final session/host/entitlement transaction. Actual HTTP registration/no-store,
body-size handling, delayed network dispatch, inactive personal export
composition and UI view-epoch/offline clearing remain pending. See the exact
[owner wiring requests and browser scenarios](integration-request.md).

Preview tickets are bounded, process-local and expire after five minutes.
Restart/eviction/cross-replica confirmation fails closed and requires preview
again. Rejected parser previews expose its canonical single issue, not invented
structured conflict IDs. The no-store headers and final guard are exported
seams until ACCESS applies them. Already delivered bytes cannot be recalled.

Parent retains dispatch, monitoring, disclosure-boundary review by Astra and
all integration/main-merge decisions. Model/effort/service-tier selection for
this running worker is not exposed as a control; no alternate worker or Cloud
task was dispatched. WP12 exclusively owns new product browser specs.

## Authority

Read both repositories' AGENTS, Atlas navigation/maintenance skills and policies,
October 17 source/minutes/A00-A08, the exact plan/package/prompt, frozen contract
README/ADR/schemas/endpoint inventory and actual migration SQL before coding.
Canonical product source:
[Atlas October 17 minutes](https://github.com/pablitxn/sysadmin-workspace/blob/ce45d206a2ed4035f8003a3303abd1fff98e09b8/atlas/entries/2026-10-17-klisteni-b2b-product-definition.md).
Historical milestones and unrelated Yoga/CI/provider/release gates remain open
under their existing owners; this receipt makes no deployed/legal claim.
