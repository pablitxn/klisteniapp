# WP02 v3: immutable effective time and production reconciliation

Date: 2026-10-17. Additive amendment requested by the parent; v1/v2 evidence stays
unchanged. This revision supersedes their synthetic-scheduler and missing-end-time
limits. It does not claim a green full integration or ordinary export wiring.

## Exact source and dependencies

- Frozen implementation base: `0b611064a91b87b3a17274cabca5415bcf1d7d55`.
- Previous PR18 head: `c6825101d6ac798437599062481adf2a79ac5f69`.
- Final owned source: `39ae769ec63932a11dd1eb32bfab57d15263895e`.
- WP03 PR19: `d12b56b92304764f988b051350b6211b7f1e38ba`; read its v3 README/
  owner requests, actual production adapter/domain reconciliation and v2 proposed
  effective-time/production-fixture patches before applying the owned changes.
- Other accepted producer pins: WP01 `af1fef78f912d746f79a00c52c261f03b58b4fe9`,
  WP04 `04b2e036e6d9b5d8987c6d228ab92bf1a48827d1`, as accepted in WP03's handoff.
- Plan `447d77ebb5587e319018e7b56003f0ef7299bb6c` and Atlas
  `ce45d206a2ed4035f8003a3303abd1fff98e09b8` remain the authority.

## Owned implementation

Only four source/test files change in this amendment: planning `index.ts`,
`schedule-change.ts`, `tests/wp02/fixture.ts` and `tests/period-history.test.ts`.

`ScheduleChange` now requires readonly `effectiveAt`. Enrollment supplies its
immutable server-created instant. End supplies the precise current server instant
once for that operation; the production adapter receives the same value for pure
planning and atomic apply. Callers cannot supply this internal metadata through
the strict end request. Exact accepted replay returns the original receipt without
recomputing cancellation at a later clock time.

The proposed literal wall-clock insertion also affected period preview hashing:
different milliseconds between preview/apply would make every live preview stale.
Period changes therefore bind `effectiveAt` to the start of the existing 15-minute
preview bucket; expiry derives from that same anchor. No new wire field/schema is
introduced. Server time advancing inside the bucket preserves a valid preview;
expiry and current enrollment/occurrence/session changes still invalidate it.
WP03 only uses precise effective time for `reason: end`; its interface/algorithm
needs no further change.

The fixture defaults directly to pinned `createPlanningSchedule()`. The synthetic
ledger implementation has been removed. The explicit rollback test wraps the real
adapter and injects only its expected write failure. Slot replacement now checks
that every old impact ID is retained/cancelled and exactly two distinct new-slot
obligations remain required, rather than cancelling the entire resulting ledger.

The positive end test invokes the real `PlanningServices.endEnrollment` handler,
not repository/adaptor calls with hand-invented end metadata. It captures the
handler's server instant, forwards it unchanged to production plan/apply, verifies
determinism, retains past/today obligations and cancels only future local dates.
The chosen instant is October 8 UTC but October 7 in New York, exposing a UTC/local
date mistake. All issued IDs/original links and accepted legacy/session JSON and
earlier occurrence snapshots survive. A later exact retry produces one audit/
receipt and no new cancellation. A separate positive test advances server time
between period preview and apply. These are service-handler/database tests using
the frozen authorized fixture context, not new HTTP/host authentication acceptance.

## Actual validation

Node 24.19.0 / pnpm 12.7.0, frozen dependencies and PostgreSQL 17.11 in a new
loopback-only ephemeral synthetic container with disposable schemas. No real data,
existing credentials, production activation, provider call, deployment or merge.

| Check | Actual result | Evidence |
| --- | --- | --- |
| Four WP02 API files with production default adapter | **26 passed / 0 failed / 0 skipped** | `focused-final.log` |
| Contracts / domain / client suites on composed producer sources | 22 / 34 / 25 passed; zero failures/skips | respective logs |
| Full composed B2B API | **156 passed / 2 failed / 0 skipped** | `full-api.log` |
| API TypeScript with three pending exports mapped to actual source | Passed | `api-typecheck.log`, `api-validation.tsconfig.json` |
| Package ESLint | 14/14 passed, 13 unchanged-package cache hits in final run | `package-lint.log` |
| Full B2B formatting | Passed after one test indentation fix | `format-final.log` |
| Ordinary root typecheck | Blocked by pending exports: 12/14 successful; API failed and web check interrupted | `ordinary-typecheck.log` |
| Ordinary root lint/boundaries | Blocked by unregistered schedule/sessions/alternatives public exports | `ordinary-lint.log` |

`resolve-production-exports.mjs` resolves only those three pending public subpaths
to their actual pinned files. It has no load hook and does not inject a scheduler,
timestamp, fixture, DTO, SQL or assertion. The fixture's production default and
handler metadata are real owned source changes. No proposed owner patch was
applied during validation. Ordinary checks without this temporary resolution remain
unaccepted until INTEGRATION registers the exports.

The first attempted focused run started before installation finished linking:
three files failed module loading (two tests passed, three file failures, zero
skips). It is preserved in `setup-attempt.log` and is not counted as feature
acceptance. Final focused execution ran after installation and passed all 26.
The initial formatting diagnostic is preserved separately; only an indentation
line was corrected, and final formatting/focused checks were rerun.

## Immutable local validation composition

These validation-only merges are local, unpushed and outside PR18 ancestry. They
compose the exact published producer pins above without authored producer edits.

| Run | Commit / tree |
| --- | --- |
| Full API, contracts/domain/client and initial static runs | `690615f4dc0a28e0501833789b1e7786f5b1ecfb` / `2a70ee2a355d8355f4961ce2c8e1e8c1aa9599ee` |
| Final focused/API typecheck/format/package lint | `ac2f8b71acb9e9f8f035881a561e6fae9768c5c1` / `540d9530933fc975e59398d77bfc397ed9171a66` |

The only difference is one indentation-only test line; every production byte and
test assertion is unchanged. `source-hashes.json` verifies all owned source/test
bytes against the final tree and all production bytes against the full API tree.

Reproduce with `pnpm install --frozen-lockfile`, set `B2B_TEST_DATABASE_URL` to a
disposable local synthetic database, `WP02_VALIDATION_ROOT` to the composed Git
root and `NODE_OPTIONS='--import <receipt>/resolve-production-exports.mjs'`. Run
the API test script or `node --test --test-concurrency=1` on the four WP02 files.
For the temporary TypeScript check, update the recorded absolute composed-root
prefix in `api-validation.tsconfig.json` and run `pnpm exec tsc -p <config>`.
Log copies normalize trailing whitespace/final empty lines only; original output
SHA-256 hashes are retained in `checks.json`.

## Exact owner requests and unaccepted cases

The full suite is **not green**. Its two failed owner expectations are:

1. WP03 `production-schedule.test.ts:84` still expects the normal repaired end
   handler to reject missing metadata. It now correctly succeeds. WP03's own
   handoff requests moving this negative case to deliberately malformed adapter
   input after accepting the timestamp amendment. See the apply-checked,
   **unapplied** [WP03 guard request](wp03-negative-guard-owner.patch). The new
   positive handler test here is independently accepted; the old test's assertions
   after its failed rejection are unexecuted.
2. Shared `white-label-training.test.ts:371` still expects zero North assignments
   despite the explicit North coach grant. INTEGRATION retains the unchanged,
   apply-checked [v2 exact North identity request](../v2/integration-test-expectation.patch).
   Its assertions after that failure are unexecuted.

[integration-required-exports.patch](integration-required-exports.patch) is the
apply-checked, unapplied minimum package export request for ordinary resolution.
Only INTEGRATION may reconcile/apply it after composing producer sources; the
optional prescription/root-barrel requests in earlier receipts remain unchanged.
No shared manifest/barrel/lockfile/access/HTTP/contract/migration or WP03-owned
source/test was edited in this amendment. No additional Cloud task was dispatched.

The production schedule service seam is now supplied/tested; final shared service/
HTTP registration, ordinary checks without the export hook, owner test amendments,
independent review, browser/mobile/HTTPS/device and full composed build acceptance
remain with existing owners. No blocked case is treated as a passing result.
