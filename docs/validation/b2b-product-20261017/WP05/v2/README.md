# WP05 effective selected-role amendment

Status: owned role reconciliation ready; composed HTTP/auth/browser acceptance
still belongs to the integration owners. A reproduced shared audit-index issue
also needs CONTRACT's successor migration before full inactivity acceptance.
Date: 2026-10-17.

This additive receipt supersedes v1's statement that `context.role` is always
the organization product role. All 15 tracked v1 evidence files remain unchanged.
The frozen implementation base remains `0b611064a91b87b3a17274cabca5415bcf1d7d55`;
no dependency branch was merged or rebased into this worker branch.

| Revision | SHA |
| --- | --- |
| Prior PR17 head | `b5715612f989b66327a2f89d7df94813bbebf98a` |
| WP01 PR20 reviewed | `af1fef78f912d746f79a00c52c261f03b58b4fe9` |
| WP05 effective-role implementation | `0b81981cfdfac7763ec6d9974f4cfd8a99ef3b8d` |
| Final tested source/test snapshot | `4302914f38f8fc152711e37cecd66cec3c5ade3b` |
| Plan / Atlas | `447d77ebb5587e319018e7b56003f0ef7299bb6c` / `ce45d206a2ed4035f8003a3303abd1fff98e09b8` |

The subsequent receipt commit adds evidence only. Its final PR17 head is recorded
in live PR metadata and the parent handoff; no force push or main merge occurs.

## Reviewed contract and change

Read WP01's `WP01/v2/README.md`, `health-effective-role.patch`, actual
`auth/product-policy.ts` and `service.ts:productOrganization` at the pinned head.
`productBranchScope` returns the effective selected branch role; capabilities
derive from that role. It can differ from the current organization product role.
Neither selecting an organization member's live coach grant nor selecting a
superadmin's live member grant is a membership-role mismatch.

Only `apps/b2b-api/src/health/access.ts` changed in production code. It adopts
WP01's proposed administrative-role reconciliation and adds an explicit fence
against trainer disclosure from a selected member context, including one with
stale/overbroad capability metadata and a separate live coach grant.

| Selected context | Current authority required |
| --- | --- |
| superadmin | Organization superadmin |
| admin | Organization admin, or explicit superadmin-to-admin selection |
| coach | Live selected-branch coach grant, regardless of organization role |
| member | Live selected-branch member grant; owner health only |
| Trainer disclosure | Non-member selected context, current read capability, live branch coach grant, current target membership/member grant and active scoped consent |

All existing identity/access-revision, activity, entitlement, branch, live grant,
target and consent checks/locks remain. Highest organization authority never
restores capabilities removed by selected member mode. No DTO, migration,
shared auth/route/client/manifest, browser fixture or foreign owner's file changed.

## PostgreSQL privacy and regression evidence

Node 24.19.0 / pnpm 12.7.0; the existing frozen dependency installation is
unchanged. Tests use the same dedicated local synthetic PostgreSQL test database,
random disposable schemas, READ COMMITTED and separate connections as v1.
No real data, providers, credentials, deployment or product activation is used.

| Execution | Actual result |
| --- | --- |
| Focused four health files, `node --test --test-concurrency=1` with private test env, before final TypeScript-lib-compatible barrier rewrite | 30 passed / 0 failed / 0 skipped / 0 cancelled / 0 todo |
| Initial full B2B API test (before adding the last audit assertion case) | 120 passed / 1 failed / 0 skipped / 0 cancelled / 0 todo |
| Isolated `anonymous-public.test.ts` recheck | 4 passed / 0 failed / 0 skipped |
| Intermediate full API rerun (after adding the audit case) | 121 passed / 1 failed / 0 skipped / 0 cancelled / 0 todo |
| Full API after explicit two-context barrier, before the TypeScript-lib-compatible rewrite | 122 passed / 0 failed / 0 skipped / 0 cancelled / 0 todo |
| Final `pnpm --filter @klisteniapp/b2b-api test` | 122 passed / 0 failed / 0 skipped / 0 cancelled / 0 todo |
| `pnpm typecheck` | 14 tasks passed; 13 cached, changed API task uncached |
| `pnpm lint` including boundaries and B2B formatting | 14 tasks passed; 13 cached, changed API task uncached; boundaries/formatting passed |
| First explicit barrier helper API typecheck | failed TS2550; replaced with standard Promise constructor |
| Identity guard, Conventional Commit/PR template checks and whole-range `git diff --check` | passed; final publication metadata rechecked separately |

The 30 health tests are included in the final full API run, not additional
unique tests. Other package/B2C tests were not rerun for this API-only role
amendment; their v1 results remain scoped to their original revision. No browser,
build, full root test, HTTPS/provider or composed WP01 execution is claimed.

The initial full run's sole failure was `anonymous-public.test.ts:129`: foreign
brand media returned 500 where the test expected 404. That unchanged HTTP/media
path does not load WP05 health services. Its isolated recheck passed without a
source change. Both initial failure and subsequent results are retained rather
than silently discarding a failed run. The transient failure's root cause is
unresolved; this amendment does not claim to fix media behavior.

The intermediate run passed the media case but exposed a nondeterministic WP05
test barrier: `queued import and captured owner export context lose operational
authority after inactivity` waited for only one of its two connections to queue.
The second connection could capture a fresh inactive context after commit, which
correctly permits owner export, contrary to the test's stale-context assertion.
The owned test now explicitly waits until both pre-transition contexts have been
captured before releasing the deactivation transaction. Fresh inactive export
remains separately asserted as allowed. This is a test setup correction; product
export/inactivity behavior and the hook implementation were not changed.

The first explicit barrier used `Promise.withResolvers`, which runs on Node 24
but is absent from this repository's frozen TypeScript library target. Its API
typecheck failed with TS2550. The final helper uses a standard Promise constructor
and propagates setup failures, without changing tsconfig/dependencies. Final
repository typecheck and lint pass; the failed compiler output is retained.

`health-effective-role.test.ts` adds eight real-DB cases:

1. Organization member selects live branch coach: own health and consented target
   reads succeed; absent consent and another branch remain denied.
2. Superadmin selects member: owner health succeeds; trainer health stays denied
   even with a separate coach grant and overbroad capabilities; selecting coach
   with its live grant permits the consented read.
3. Administrative equality and explicit superadmin-to-admin downgrade work;
   member/admin escalation and missing selected member/coach grants fail.
4. Revoked coach/member selections fail even if another role remains and an
   external caller did not advance the membership access revision.
5. Organization downgrade invalidates captured access revision; a fresh coach
   selection still requires its live retained grant, and revocation denies it.
6. Missing current capability and inactive membership deny selected coach access.
7. Queued effective coach read observes committed selected-grant revocation.
8. One inactivity hook call revokes two branch grants in its membership transaction,
   with two bounded audit references; retry produces no duplicate snapshots/audit.

The context builders exercise the actual feature SQL with the observed WP01
effective-role/capability convention. They do not substitute for WP01's real
session/host/activation transaction. Current authority is never supplied by a
transport body.

## Reproduced CONTRACT blocker: branch-scoped consent IDs and audit uniqueness

An additional synthetic diagnostic, separate from the 122-test suite, grants
the legal ID `same-consent` in two branches. The frozen audit operation index
omits `branch_id`, while consent identity includes branch. Inactivity correctly
uses one parent operation for both branches, so the second audit insert violates
`b2b_product_audit_operation` with 23505. The whole transition rolls back: target
membership remains active and both consents remain active. There is no partial
revocation, but valid same-ID branch grants prevent the inactive transition.

[audit-branch-probe.js.txt](audit-branch-probe.js.txt) reproduces the failure and
then validates a candidate branch-aware index only in its disposable schema.
Run from `apps/b2b-api` with the private synthetic test env loaded using
`node --input-type=module < ../../docs/validation/b2b-product-20261017/WP05/v2/audit-branch-probe.js.txt`.
The temporary index permits both grant revisions and exactly two audit references
under the one parent operation; repeating the hook adds none. All fixture DDL
and data are removed afterward. This candidate validation does not count as an
applied migration or acceptance against the frozen schema.

Exact request to CONTRACT: register a successor migration/readiness requirement
without editing 006 or historical rows, review existing nullable-actor audit
duplicates before applying the stricter NULL semantics, and replace the index:

```sql
DROP INDEX b2b_product_audit_operation;
CREATE UNIQUE INDEX b2b_product_audit_operation ON b2b_audit
  (organization_id, actor_id, operation_id, action, branch_id, resource_id)
  NULLS NOT DISTINCT WHERE operation_id IS NOT NULL;
```

Retain branchless retry uniqueness and explicit system/nullable-actor semantics;
if existing anomalies require another index design, CONTRACT must freeze it
before consumers change. Add real-DB migration tests for same consent ID across
branches, same-branch retry uniqueness, null-branch audit identity and rollback.
The exact candidate above passed the disposable probe but is **not** edited
into reserved SQL/registry files by WP05. This shared contract issue remains a
blocker for complete inactivity acceptance, beyond the passing listed suite.

## Integration handoff

Use WP01's effective role directly. Do not replace it with organization role or
the highest role across branches. No shared patch is required for this owned fix.
WP01's registration proposal can bind the amended health factory under its
current-authority transaction once the real producers are composed.

`revokeHealthForInactiveMembership` and its storage/audit implementation are
byte-unchanged from v1. INTEGRATION must **replace** WP01's provisional
`revokeMembershipConsents` implementation with delegation to this hook; do not
call both. Pass the accepted v2 operation ID (or explicit server request ID for
a legacy transition) after setting the target inactive, in the same authorized
organization write transaction. The hook must own the grant-revision/audit path.
Do not call it during reactivation. Existing rollback coverage and the new
single-path audit assertion both pass.

V1's remaining body-limit/no-store/final-dispatch, WP06 owner-export, WP10 view
clearing and process-local preview limitations remain. Astra boundary review and
composed browser/auth acceptance are pending; no product activation is authorized.

## Evidence format

`source-sha256.txt` pins all current WP05 source/test bytes; `amendment-files.txt`
lists the three amendment files. Logs remove trailing horizontal whitespace and
extra empty EOF lines only; names, failures, values, counts and timings remain.
Initial failed and final passing runs are separate files. This v2 directory is
frozen at publication; future corrections require an additive receipt revision.
