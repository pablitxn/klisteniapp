# WP02 v2: scoped trainer coverage and publication resolver amendment

This additive receipt supersedes v1's pending WP01 query-patch and WP04 candidate
input status. V1 remains byte-for-byte unchanged: evidence tree
`f67126d07b06944a62933a29eae0d0b16312b6ef`. No original log or result was rewritten.
Date: 2026-10-17. PR18 remains draft; no main merge or deployment occurred.

## Immutable inputs and owned changes

- Frozen implementation base: `0b611064a91b87b3a17274cabca5415bcf1d7d55`.
- Previous PR18 head: `3b045cbe431d1995d75f9e88eeac1d79a08607bb`.
- Validated amendment source: `0e6e0ce93c4d9c59a22435b0aeddba48596a0ba3`.
- WP01 request/code: `af1fef78f912d746f79a00c52c261f03b58b4fe9`, including its
  `WP01/v2/planning-owner.patch` and README. Reviewed/applied the requested semantic
  changes only in leased `training/index.ts` and `training/repository.ts`.
- WP04 projection: `c91fbcbaf3dc228630cda66dd2229f2524cb46c9`, including actual
  `freezeReviewedRelations`, projection/endpoint code and owner requests.
- Plan and Atlas remain `447d77ebb5587e319018e7b56003f0ef7299bb6c` and
  `ce45d206a2ed4035f8003a3303abd1fff98e09b8`; A01/A02/A03/A06 scope is unchanged.

Exactly five source/test files change in this amendment:

1. `apps/b2b-api/src/training/repository.ts`: coach assignment/execution reads use
   the explicit selected branch, without a coach-to-student assignment prerequisite.
   Tenant and member/self predicates remain; missing coach branch returns no rows.
2. `apps/b2b-api/src/training/index.ts`: forwards purpose `history` for assignment
   and execution reads, while new assignment still uses active planning access.
3. `apps/b2b-api/src/planning/resources.ts`: supplies all published exercises visible
   in the authorized branch to the reviewed relation resolver, including targets
   outside source steps. Foreign/private/hidden/draft targets are filtered before
   the callback, and returned targets still undergo scoped content validation.
4. `apps/b2b-api/tests/planning-coverage.test.ts`: two tenants/four branches,
   unassigned-trainer reads, branchless denial, self-only history, retained inactive
   target history and active-planning rejection.
5. `apps/b2b-api/tests/planning-publication.test.ts`: complete candidate input,
   explicit sharing/hiding, immutable target inclusion and rejection of foreign,
   hidden or changed resolver output.

No shared HTTP/service/context/access/contract/migration/manifest file was edited.
No execution JSON, actual-log/outbox mutation or WP04 hash/provenance implementation
was changed. `source-hashes.json` verifies every WP02 source/test byte against both
validation trees below.

## Actual validation and remaining failing shared assertion

Node 24.19.0, pnpm 12.7.0 and PostgreSQL 17.11; frozen dependency installation.
Only a new loopback-bound ephemeral synthetic PostgreSQL container and disposable
random schemas were used. Existing credentials/data were not read or changed.

| Tree/check | Result | Log |
| --- | --- | --- |
| Owned source: four dedicated planning API files | 24 passed / 0 failed / 0 skipped | `focused.log` |
| Owned source: contracts | 22 passed / 0 failed / 0 skipped | `contracts.log` |
| Owned source: domain | 13 passed / 0 failed / 0 skipped | `domain.log` |
| Owned source: `pnpm typecheck` | 14/14 successful, 13 unchanged-package cache hits | `typecheck.log` |
| Owned source: `pnpm lint` | 14/14 successful, 13 unchanged-package cache hits; boundaries and full B2B formatting passed | `lint.log` |
| Pinned WP01 + owned source: full B2B API | **128 passed / 1 failed / 0 skipped** | `composed-api.log` |
| Pinned WP01 + WP04 + owned source: four planning files | 24 passed / 0 failed / 0 skipped | `composed-focused.log` |
| Pinned WP01 + WP04: API typecheck | Passed | `composed-typecheck.log` |
| Real WP04 publication callback | 2 reviewed pushup relations frozen; hidden full-pushup excluded; blocked step yields 0 relations | `wp04-seam.log` |

The original unassigned-trainer HTTP integration case now passes, as do WP01's
current role/grant/revocation tests. The full suite is **not green**: shared
`apps/b2b-api/tests/white-label-training.test.ts:371` still expects zero North
assignments, although its fixture explicitly grants the coach the North branch
and creates `northAssignment`. Receiving that assignment is the newly authorized
behavior. Cross-branch isolation remains covered by the dedicated regressions.

INTEGRATION must review/apply [integration-test-expectation.patch](integration-test-expectation.patch),
which replaces the outdated zero count with the exact North assignment identity.
It passed `git apply --check` against the frozen/unchanged shared test. It was
**not applied or executed** in either validation tree because that existing test
is outside this lease. The remainder of that failing test after the assertion is
therefore unexecuted in this run. No failure or blocked case is counted as a pass.

## Reproducible composed trees

These are local validation-only merge commits, not PR18 ancestors, pushed branches
or application main merges. Reconstruct them from the published producer pins;
tree hashes below bind their actual combined content independently of commit time.

| Candidate | Exact commit / tree |
| --- | --- |
| Owned source merged with WP01 | `8c4b5857a2f4b4c761ac19e7d50f52eeae173465` / `d4b84ef43adad334365d739cb889d5bd88e607b2` |
| Previous candidate merged with WP04 | `2849c9a4a9015c08529f01bb479efcb508611b90` / `b4fefd30a9904947055a97c3a5d277f56fa5eb09` |

Commands: install with `pnpm install --frozen-lockfile --store-dir
/workspace/.onboarding/pnpm-store`; set `B2B_TEST_DATABASE_URL` to a disposable local
synthetic database; run `pnpm --filter @klisteniapp/b2b-api test` on the first tree.
On the second tree, run `node --test --test-concurrency=1` with the four API files
`goal-programs.test.ts`, `period-history.test.ts`, `planning-coverage.test.ts` and
`planning-publication.test.ts`; run the API typecheck and
`node <receipt>/validate-wp04-seam.mjs <composed-repository-root>`.

The real callback validation is separate from WP04's full package/hash acceptance.
The requested hash fix remains with WP04; this receipt neither changes that code
nor claims its ongoing correction passed. Log copies normalize trailing whitespace
and final empty lines only; `checks.json` retains original-output SHA-256 hashes.

## Exact publication composition request

This supersedes v1's source-only third callback argument. INTEGRATION composes the
real callback without guessing target IDs or passing an unfiltered canonical list:

```ts
import { createPlanningServices } from './planning/index.ts';
import { createPlanningResources } from './planning/resources.ts';
import { freezeReviewedRelations } from './catalog/reviewed-projection.ts';

const planning = createPlanningServices({
  ...createPlanningResources(async (_context, routine, available) =>
    freezeReviewedRelations(routine, available),
  ),
  schedule: realPlanningSchedule,
});
```

`available` is the complete current published, authorized branch catalog.
Planning freezes only sources plus returned targets and their machines/relations.
The WP03 required schedule interface and all other v1 owner requests remain in
force. Product route/service registration, full WP04 hash acceptance, browser/HTTPS
and final schedule/adherence composition remain with existing owners. No new task
was dispatched and no production activation, provider, paid call or merge occurred.
