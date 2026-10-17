# WP03 v5: retired assignment acceptance

This additive receipt verifies the parent-reported retirement defect against the supplied integration snapshot. Earlier v1-v4 receipts remain unchanged. It also replaces v4's temporary-export and stale shared-North-expectation limits with ordinary native checks on the integrated source; historical failures remain recorded for their original heads.

## Exact inputs

- Frozen feature base: `0b611064a91b87b3a17274cabca5415bcf1d7d55`.
- Amendment source: `c5f2dfdea3a984013cfb670694ef671e8a797c89`.
- Supplied integration snapshot: `4954accaf0e4a0c88f8179b949886b1fcece8fa7`.
- Disposable local tested composition: `c8fdd48f55df64e050b9691435349a4aca66d795`.
- Plan: `447d77ebb5587e319018e7b56003f0ef7299bb6c`; Atlas: `ce45d206a2ed4035f8003a3303abd1fff98e09b8`.

All 24 owned source/test files were byte-compared between the feature branch and disposable composition. `source-files.sha256` binds those exact files; `composition.json` records runtime, dependency hashes and composition pins. The feature branch remains isolated on its frozen base. This amendment changes only sessions/index.ts and a dedicated retired-assignment-sessions.test.ts; its evidence follows as a separate commit. Shared service/access/context, DTOs, SQL, manifests, exports, legacy training, browser specs and the shared North test were not edited by WP03.

## Verified behavior

Fresh draft, partial and completed legacy sessions require an active assignment and an unarchived program. Denials create no session, revision, receipt or partial audit. Existing own session corrections and first corrections of a verified original legacy execution remain allowed after retirement, preserving original linkage, revision zero and original stored JSON. A forged or nonexistent legacy execution cannot bypass fresh-record eligibility.

Assignment acceptance takes a shared row lock through the authorized transaction. Real PostgreSQL lock-wait assertions exercise both race orders: a retirement committed before acceptance denies the fresh record, while acceptance committed first makes retirement wait and retains the accepted record and receipt. Later fresh records are denied. Exact replay returns its original accepted receipt, including after a later correction, but still requires current user session/membership/branch authorization first; membership revocation denies replay and further corrections. Historical reads retain their existing authorization rules.

## Actual validation

Node 24.19.0 and declared pnpm 12.7.0 with a successful frozen install; no lockfile/manifest changes. Ordinary public exports and integration registration are used. No resolver/load hook, source/fixture rewrite, injected timestamp, assertion substitution or TLS bypass was used. PostgreSQL 17.11 runs in a disposable synthetic container bound only to 127.0.0.1:55433; per-test schemas are disposed. No real user or health data is involved.

| Check | Actual result | Evidence |
| --- | --- | --- |
| Full native integrated API | **205 passed / 0 failed / 0 skipped** | api.log |
| New retired-assignment PostgreSQL cases | **5 passed / 0 failed / 0 skipped** | retired-assignment.log |
| Owned ledger/schedule/catalog-race PostgreSQL cases | **27 passed / 0 failed / 0 skipped** | owned-records.log |
| Client / domain / contracts | **27 / 34 / 22 passed**, zero failures/skips | respective logs |
| Ordinary lint / TypeScript | **14 of 14 tasks passed** each | lint.log, typecheck.log |
| API-only lint / TypeScript and complete B2B formatting | Passed | api-lint.log, api-typecheck.log, format.log |
| Frozen dependency install | Passed; unchanged manifests/lockfile | frozen-install.log, composition.json |
| Owned-source equality / source hashes / evidence hashes / authored-text diff | Passed | manifests and composition.json |

Diff whitespace checks exclude raw tool logs: Turbo emits trailing spaces and a terminal blank line, preserved exactly in lint.log/typecheck.log. Authored source and documentation pass the check.

The full API run includes the new retirement cases, current HTTP registration/current authorization checks, the real planning callback, reviewed-target races and the integrator-owned North identity assertion. The focused and standalone runs overlap the full suite; their counts are not added together. No failed, cancelled or skipped case is counted as passing. The synthetic PostgreSQL container and its anonymous volumes were stopped and removed after validation.

## Reproduction and remaining gates

In the stated disposable composition, activate Node 24/pnpm 12.7, run `pnpm install --frozen-lockfile`, then set `B2B_TEST_DATABASE_URL` to a disposable synthetic local PostgreSQL and run `pnpm --filter @klisteniapp/b2b-api test`. No NODE_OPTIONS import is needed. The owned run uses `node --test --test-concurrency=1` on retired-assignment-sessions, session-revisions, training-operation-races, weekly-adherence, production-schedule, catalog-selection-races and reviewed-session-selections test files. Native checks are `pnpm lint`, `pnpm typecheck`, and the client/domain/contracts package tests.

The old North expectation is already corrected by the supplied integration snapshot; WP03 did not edit that shared test. Native public exports and HTTP registration also come from that snapshot. This receipt makes no new shared-file wiring request. Preserve the existing frozen withdrawal transport mapping (409 INVALID_INPUT plus an unavailable field issue); no new target-dose interface or wire enum is introduced.

[owner-requests.md](owner-requests.md) gives the parent integration handoff. Parent retains final composition and main-merge authority. Existing Astra review, QA browser/mobile/HTTPS/physical acceptance and full composed build/release gates remain outside this receipt. No main merge, deployment, activation, Cloud dispatch, paid/provider call, credential change, real data access or force push occurred. On publication, v5 is immutable; later changes need a new receipt.
