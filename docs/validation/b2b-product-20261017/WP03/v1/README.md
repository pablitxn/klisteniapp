# WP03 v1 immutable validation receipt

Date: 2026-10-17. Status: feature modules ready for owner integration and Astra review; application activation remains disabled.

- Application frozen base: `0b611064a91b87b3a17274cabca5415bcf1d7d55` (PR15, integrated WP13).
- Tested implementation head: `22dd8743ce9e20cecfb7ddd098a75d0af1bef5ba`.
- Plan: `447d77ebb5587e319018e7b56003f0ef7299bb6c`.
- Atlas read-only context: `ce45d206a2ed4035f8003a3303abd1fff98e09b8`.
- Isolated branch: `feat/b2b-session-ledger-v1`; intended stacked PR base: `feat/b2b-contract-foundation-v1`, still at the frozen base when refreshed. Remote main read `d65261d18de4522fb9a66104aabb5750104fb8b8`; it was not substituted for the assigned base.
- Source-file list and hashes: [source-files.sha256](source-files.sha256). The evidence-only commit follows the tested source head; its exact SHA is in the PR/handoff. This v1 directory is frozen after publication. Corrections require v2 or an amendment.

## Implemented and verified

The six frozen RecordsServices handlers are exported by `createRecordsServices` in `apps/b2b-api/src/schedule/index.ts`. New sessions/schedule modules reuse ACCESS's transaction, with no second connection or transaction commit. Occurrences retain issued enrollment/stage/slot/ordinal/date/week/routine links. Same-week moves preserve quantity and use explicit date overrides across stage boundaries. Reconciliation preserves identities for period translations/weekday edits, retains cancelled obligations, and never renumbers allocated ordinals. Ending an enrollment excludes only future local dates; past work can arrive late under current authorization.

Own session changes compare revisions, append full snapshots, and atomically append immutable operation receipts and bounded revision-reference audits. Exact normalized request replay returns its accepted response even after successors; changed operation content conflicts. Current active authorization and ownership precede receipt lookup. Empty drafts do not complete work. Completion uses explicitly selected effective segments, positive applicable actuals and minimum/per-side coverage; below-target actuals remain truthful. Prior segment snapshots are immutable, switches retain actuals, and set removal requires an explicit correction reason.

Legacy execution bytes and IDs stay untouched. Revision-zero history joins immutable assignment/version snapshots. The first correction uses the original execution ID and retains the complete revision-zero snapshot. Legacy ad hoc work never creates a prescribed obligation. General training history never exposes private health.

Weeks use enrollment IANA calendar dates with half-open Monday boundaries, including 167/169 elapsed-hour DST weeks. Derived summaries read under enrollment locks, count at most one completion per eligible occurrence, and advance a revision watermark after actual/schedule changes and close. Partial work remains outstanding/missed. Four required/three completed yields one missed; duplicate retries or repeated records do not fill another occurrence. Period shifts recalculate both weeks without copying actuals or retaining duplicate absences.

## Commands and results

Environment: Node `24.19.0`, pnpm `12.7.0` activated from the retained onboarding toolchain, frozen workspace dependencies. PostgreSQL `17.11`, disposable loopback-only synthetic container using retained image digest `sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`. Per-test schemas are removed in finally blocks. No production or real-user/health data was used.

| Command / scope | Result | Evidence |
| --- | --- | --- |
| `pnpm --filter @klisteniapp/b2b-contracts test` | 22 passed, 0 failed, 0 skipped | contracts.log |
| `pnpm --filter @klisteniapp/b2b-domain test` | 20 passed, 0 failed, 0 skipped | domain.log |
| `B2B_TEST_DATABASE_URL=<disposable local test DB> NODE_OPTIONS='--import /workspace/klisteniapp/apps/b2b-api/tests/fixtures/wp03-domain-seams.mjs' pnpm --filter @klisteniapp/b2b-api test` | 105 passed, 0 failed, 0 skipped; includes all 13 new WP03 cases, real concurrent transactions and existing migration/legacy/HTTP regression | api-full.log |
| `pnpm --filter @klisteniapp/b2b-domain typecheck` | exit 0 | domain-typecheck.log |
| `pnpm exec tsc -p /tmp/wp03-api.tsconfig.json` | exit 0 with only the two pending public domain subpaths mapped to their actual source files | api-typecheck-seams.log; config below |
| `pnpm exec turbo run lint` | 14 packages passed | lint-packages.log |
| `pnpm format:b2b:check` | passed all matched files | format.log |
| `pnpm lint` / boundary check | blocked: four import sites need two owner-reserved domain export entries | lint-ordinary.log |
| `pnpm typecheck` | blocked by the same missing exports and one resulting inferred-any diagnostic; root task cancelled two remaining UI checks | typecheck-ordinary.log |
| Atlas commit checker `commits(app_root, frozen_base)` | 2 source commits passed | commits.log |
| Atlas engineering allowlist CLI `check` | 176 Atlas files passed; does not certify application prose | engineering.log |
| Cloud Git identity guard before each commit; `git diff --check`; proposed owner patch `git apply --check`; source hash verification | passed | PR/handoff plus source-files.sha256 |

The Node resolution hook is limited to the two unregistered domain subpaths, using the actual implementation source. It does not change DTOs, runtime rules, dependencies, SQL, fixtures or assertions. The separate temporary TypeScript config extends the real API tsconfig and adds only:

```json
{
  "compilerOptions": {
    "paths": {
      "@klisteniapp/b2b-domain/schedule": ["/workspace/klisteniapp/packages/b2b-domain/src/schedule.ts"],
      "@klisteniapp/b2b-domain/sessions": ["/workspace/klisteniapp/packages/b2b-domain/src/sessions.ts"]
    },
    "typeRoots": ["/workspace/klisteniapp/node_modules/@types"]
  }
}
```

This is explicitly pre-integration validation, not a claim that ordinary API resolution or root static checks pass. The exact manifest proposal is [integration-exports.patch](integration-exports.patch); it was checked without applying it. After the owner applies it, rerun ordinary tests/static checks without the validation hook/config.

The first offline frozen install lacked cached registry metadata; using the retained store with `pnpm install --frozen-lockfile --store-dir /workspace/.onboarding/pnpm-store` succeeded without dependency changes. A fixture initially duplicated grants already installed by the real migration trigger; the fixture was corrected. Initial use of the Atlas commit CLI targeted its fixed Atlas root, so the application-base check failed; the existing official `commits(app_root, base)` function was then used explicitly and passed. No failure or skip was counted as a pass.

## Integration dependencies and unexecuted acceptance

See [owner-requests.md](owner-requests.md) for exact export/service requests, WP02 transaction/preview call order, WP04 supplement hashing/target-dose needs, and browser scenario handoff.

- INTEGRATION must add domain exports. WP01 must register the six new v2 HTTP handlers inside its current locked authorization context. New v2 HTTP/host/revocation integration has not run here; the database tests use a dedicated current-membership/branch authorization fixture.
- WP02 must compose enrollment activation, period preview hash/CAS/expiry and atomic apply with the reconciliation helpers and planning audit. Final stale-preview tests belong on that composed head.
- WP04 must freeze independent target doses and directed provenance in publications/supplements and compose current equipment/selection availability. Source-only legacy edits work without a supplement; unsupplemented old unreviewed substitution actuals stay in revision zero. New selected-target corrections require an explicit own-dose supplement, rather than invented target prescription. Confirm the canonical source-snapshot hash convention before integration.
- Astra contract-sensitive review is requested, not completed by this worker. No new Cloud task was dispatched.
- New browser scenarios, UI/mobile/layout/physical-device/HTTPS acceptance and full combined build were not executed; WP12 owns new browser specs and final UI validation awaits composition. Existing Yoga/provider/backup/CI/release gates remain independent. No `pnpm check:all` or release-ready claim is made.

No migrations, DTOs, manifests, lockfile, export barrels, shared API service/http/context/access files, legacy training files or new browser specs were edited. No main merge, activation, deployment, paid call, provider access, credential change or history rewrite occurred.

## Authority

Read both repositories' AGENTS.md, Atlas atlas/AGENTS.md, local atlas-navigate and atlas-maintain skill instructions, policies and engineering/identity/PR standards. The application ADR, contracts, endpoint inventory and actual migration SQL at the frozen base govern implementation. Product authority is the [October 17 Atlas minute](https://github.com/pablitxn/sysadmin-workspace/blob/ce45d206a2ed4035f8003a3303abd1fff98e09b8/atlas/entries/2026-10-17-klisteni-b2b-product-definition.md), A03/A04/A05 and plan C03-C06. Atlas remained unchanged; historical milestones and source evidence were preserved.
