# WP02 v1: draft routines and revisioned goal programming

Date: 2026-10-17. Status: owned modules tested and ready for composition; product
HTTP/authentication and production schedule/relation composition remain pending.
This receipt is immutable after publication. Corrections require v2 or an amendment.

## Revisions and authority

- Repository: `pablitxn/klisteniapp`, branch `feat/b2b-goal-programs-v1`.
- Frozen implementation base / PR15: `0b611064a91b87b3a17274cabca5415bcf1d7d55`.
- Validated implementation: `5476de948722f11e6acf9e93ce87834c9bb58795`.
  Checks ran on the identical source/test tree immediately before that commit;
  `source-hashes.json` binds every changed source/test file to the committed bytes.
  The subsequent receipt commit changes only this evidence directory.
- Exact plan fetched/read: `447d77ebb5587e319018e7b56003f0ef7299bb6c`, including
  the plan, work-packages and full WP02 prompt. The base includes WP00 and WP13.
- Atlas: `ce45d206a2ed4035f8003a3303abd1fff98e09b8`. Both root AGENTS, Atlas
  AGENTS, actual `.agents/skills/atlas-navigate/SKILL.md`, plan-required maintenance
  skill and policies/standards were read. Atlas was not edited.
- Product authority: [October 17 minutes](https://github.com/pablitxn/sysadmin-workspace/blob/ce45d206a2ed4035f8003a3303abd1fff98e09b8/atlas/entries/2026-10-17-klisteni-b2b-product-definition.md),
  original source and owning A00-A08 roadmap. WP02 implements A02/A03's API slice.
- Frozen owner contracts: `docs/contracts/b2b-product-v2/README.md`, endpoint
  inventory, ADR `docs/adr/b2b-training-v2.md`, executable product schemas and
  actual migrations 001-006. No schema, migration or contract amendment was made.

## Delivered modules

`apps/b2b-api/src/planning/index.ts` exports `PlanningModule` and the bound
`createPlanningServices` registry. It implements all 13 frozen PlanningServices
entrypoints: routine list/read/save/publish/archive, member goals/save/archive,
enroll/end, continuity and period preview/apply. `resources.ts` provides current
branch catalog/publication/inventory checks and requires WP04's explicit relation
resolver. `schedule-change.ts` defines WP03's deterministic plan/apply dependency.

Incomplete drafts retain null/empty fields. Publication checks completeness and
returns structured step/field issues; it freezes fixed/range targets and catalog
snapshots without a balance score. New rows explicitly use schema version 2.
Legacy draft projection preserves unknown load/laterality and requires explicit
confirmation before new publication; original v1 version/assignment/actual rows
are never rewritten. Existing strict legacy readers retain their 426 format gate.

Goal, enrollment and stage revisions append snapshots. Stable routine/version
references are reused across stages and same-day slots. New enrollment binds the
exact saved complete goal revision and explicit IANA timezone; gaps are allowed.
Archives prevent new selection; existing issued lineage survives. Continuity
returns separate current/past/future arrays in each enrollment's local timezone,
including simultaneous enrollments and explicitly unscheduled legacy assignments.

Every mutation reuses ACCESS's transaction, locks its resource, checks expected
revision, appends a scoped audit and persists the exact operation response.
Authorization precedes receipt lookup. Exact replay returns the original response
after successors; different content under the same operation ID conflicts. Current
target membership is rechecked for planning versus retained historical access.

Period preview binds actor, scope, proposed content, enrollment revision, all
occurrence snapshots (including accepted date overrides) and linked latest session
heads. It expires at the end of the current 15-minute server-clock bucket.
Apply recomputes the fingerprint under locks, rejects stale/expired previews and
persists enrollment/stage revisions with reconciliation and audit atomically.
Planning contains no actual-log/outbox mutation or adherence counter.

## Actual validation

Environment: Node `24.19.0`, pnpm `12.7.0`, PostgreSQL `17.11`. Dependencies were
installed with `pnpm install --frozen-lockfile --store-dir
/workspace/.onboarding/pnpm-store`; existing package versions and lockfile were
preserved. PostgreSQL ran in a dedicated task-owned container on loopback port
55402 with ephemeral storage. Each API fixture used a disposable random schema.
All data was synthetic. No existing database credentials were read or changed.

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm --filter @klisteniapp/b2b-contracts test` | 22 passed, 0 failed, 0 skipped | `contracts.log` |
| `pnpm --filter @klisteniapp/b2b-domain test` | 13 passed, 0 failed, 0 skipped | `domain.log` |
| `B2B_TEST_DATABASE_URL=<disposable local synthetic DB> pnpm --filter @klisteniapp/b2b-api test` | 111 passed, 0 failed, 0 skipped | `api.log` |
| `pnpm typecheck` | 14/14 successful, uncached | `typecheck.log` |
| `pnpm lint` | 14/14 successful; 13 prior unchanged-package cache hits; boundary and full B2B formatting checks passed | `lint.log` |
| `git diff --check` | Passed | `checks.json` |
| Atlas effective identity guard | Passed: both roles Pablo Coronel, approved address | `identity.log` |
| Atlas engineering instruction check | Passed on unchanged Atlas checkout | `atlas-engineering-content.log` |
| Atlas commit and prepared PR text helpers | Passed; helper's `commits(applicationRoot, frozenBase)` explicitly selects this repository | `commits.log`, `pr-text.log` |

The B2B API total includes the retained migration new-install/001-005 upgrade/
repeat/race tests, legacy training tests and immutable-history integration cases.
The WP02 additions contribute 19 PostgreSQL tests. New domain tests contribute four.
No failed or skipped test is counted as a pass. Initial development failures were
fixed before this source freeze; the listed logs are the final successful runs.

## Acceptance coverage and limits

| Acceptance | Dedicated evidence |
| --- | --- |
| Empty/incomplete draft save/reload; exact publication issues; bodyweight/unspecified/zero external load; rest default | `goal-programs.test.ts`; domain `prescription.test.ts` |
| Range minima/maxima, units and retained bounds; reps/timed/per-side modes; no balance grading | Domain `prescription.test.ts`; fixed/range publication test |
| Stage order/overlap, partial dates, duplicate slot identity, explicit gaps/timezone, two slots/day, routine reuse and archived selection | `goal-programs.test.ts` |
| Stale trainer CAS, concurrent exact retry, actor/branch audit, payload reuse, revoked target before replay | Both new API files; real concurrent PostgreSQL transactions |
| Preview before/after logged work; linked sessions; schedule/date override/session correction/actor/proposal/expiry invalidation | `period-history.test.ts` |
| Preserved v1 serialized JSON and IDs, v2 immutable snapshots, append-only goal/enrollment/stage history and exact receipt replay | Both API files; retained product migration and training suites |
| Period apply rollback with no receipt/audit/revision leak; current/past/future and local-day classification | `period-history.test.ts` |

The dedicated `tests/wp02/fixture.ts` constructs the frozen authorized context and
uses a deliberately limited **synthetic WP03 schedule adapter**. These tests verify
planning's seam, state binding, transactional persistence and history preservation;
they do not establish the production occurrence allocator, same-week overrides,
completion eligibility or four/three/one adherence. Those remain WP03/composed QA.
The test relation resolver deliberately returns no reviewed links; WP04's complete
relation provenance/dose acceptance remains its own package.

No shared HTTP/service/context/access file was edited. Product routes are therefore
not registered by this patch. Final end-to-end authorization acceptance waits WP01;
production schedule/relation composition and shared registration wait their owners.
No browser scenario, UI build, full integration build, HTTPS/device/provider test,
preview/Yoga check, production migration/activation, deployment or merge was run or
claimed. Existing historical gates and owners remain unchanged. See
`owner-requests.md` for exact integration requests and browser scenarios.
