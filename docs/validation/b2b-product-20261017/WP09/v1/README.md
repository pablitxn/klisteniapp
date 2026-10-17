# WP09 immutable implementation receipt v1

Date: 2026-10-17. Status: **owned modules ready for integration; composed acceptance pending**.
Parent retains dispatch, monitoring, shared wiring and main-merge authority.
No production, provider, real-user/health, credential or security-setting changes.

| Input | Exact revision |
| --- | --- |
| Frozen implementation base | `0b611064a91b87b3a17274cabca5415bcf1d7d55` |
| Tested feature source | `f123dfb717774b88eba78291af2386fde60dd28b` |
| Plan | `447d77ebb5587e319018e7b56003f0ef7299bb6c` |
| Atlas | `ce45d206a2ed4035f8003a3303abd1fff98e09b8` |
| WP03 records | `d12b56b92304764f988b051350b6211b7f1e38ba` |
| WP04 alternatives | `04b2e036e6d9b5d8987c6d228ab92bf1a48827d1` |

The final PR head also contains this evidence-only commit; its immutable head/base
are recorded in PR metadata. [source-files.json](source-files.json) identifies all
19 owned implementation/test files and verifies byte equality with the isolated
validation worktree. [composition.json](composition.json) records dependency paths,
validation-only export wiring and the toolchain. No dependency source or shared
manifest is included in the feature diff. No Atlas files were changed.

## Implemented behavior

The app-local v2 session editor consumes the frozen DTO/access interfaces and
pinned WP03/WP04 domain rules. It offers truthful actual values, fixed/range dose,
per-side sets, RPE, rest and notes; explicit partial/completion/void actions;
revisioned corrections and local/server conflict choices. Target changes retain
source actuals and use independent target dose/load. Rest never records work.
Current-catalog withdrawal remains a recoverable input error, without logout.
Unaccepted rejected targets can be explicitly archived into owner recovery after
selecting another retained target; accepted segments cannot be removed that way.

IndexedDB version 2 retains version-1 stores, backs up exact legacy bytes, performs
atomic local CAS and keeps immutable outbox payloads/receipts. Uncertain responses
retry the exact operation. Later edits remain editable during delivery and create
successors bound to accepted revisions. Background sync uses bounded retries with
backoff. Storage failures are visible and retain the on-screen copy for export.
Fresh occurrence identities survive reload/two tabs/devices; legacy IDs and POST
retry payloads retain their original strict transport and linkage.

Every replay requires injected active owner/branch access and fresh discovery;
changed access blocks explicit recovery. Account/brand/branch/access changes cancel
requests and hide departed state. Export-only/revoked rendering exposes local
owner recovery/export controls. Recovery exports are clearly separate from
server-confirmed records. No health cache, service worker or offline-start promise.
`integrationAccepted` is false by default; this branch does not activate replay.

## Executed validation

Commands used Node **24.19.0**, pnpm **12.7.0**, frozen dependencies and synthetic
PostgreSQL **17.11**. The container smoke used Node 24.18.0, still within Node 24.
Commands and limits are in [results.json](results.json) and the linked logs.

| Check | Actual result |
| --- | --- |
| `pnpm --filter @klisteniapp/b2b-web test` | **78 pass, 0 fail, 0 skip**: [log](web.log) |
| `pnpm --filter @klisteniapp/b2b-contracts test` | **22 pass, 0 fail, 0 skip**: [log](contracts.log) |
| `pnpm --filter @klisteniapp/b2b-domain test` on pinned composition | **30 pass, 0 fail, 0 skip**: [log](domain.log) |
| `pnpm --filter @klisteniapp/b2b-api test`, disposable local PostgreSQL | **109 pass, 0 fail, 0 skip**: [log](api.log); includes migrations, compatibility, receipt/catalog races |
| Direct WP09 replay-to-WP03 services probe | **7 checks pass, 0 fail, 0 skip**: [log](workout-api-probe.log), [source](workout-api-probe.mjs) |
| Native IndexedDB / isolated component smoke | Matching **Playwright 1.63.0 / Chromium 153.0.8010.12**, 320x740; upgrade/backup/reopen/CAS/immutability and development StrictMode autosave/actual retention pass: [log](native-storage-probe.log) |
| `pnpm check:b2b:boundaries` | Pass: [log](boundaries.log) |
| `pnpm lint` | Pass, including formatting: [log](lint.log) |
| B2B-web and unified B2C-web `typecheck` | Both pass: [B2B](web-typecheck.log), [unified](unified-typecheck.log) |
| `pnpm build:b2b` and unified B2C-web `build` | Both pass; existing chunk-size warning: [B2B](build-b2b.log), [unified](unified-build.log) |
| Root `pnpm typecheck` | **Blocked** by absent WP02 `planning/schedule-change.ts` through WP03 bridge: [log](typecheck.log) |
| Frozen feature branch without owner export patch | Expected missing dependency subpath errors: [log](frozen-base-web-blocked.log); not a passing result |
| `git diff --check`, guarded Git identity, canonical commit text check | Pass; [commit check](commits.json) |

The seven direct-service checks cover zero-set draft, server commit/response loss,
exact replay, successor CAS revision, immutable earlier receipt, stale-device CAS,
and server membership suspension with retained queue. Access discovery is injected;
this does not establish WP06 HTTP authorization acceptance.

The native smoke uses [probe source](native-probe.tsx), [runner](native-probe-run.mjs)
and [build config](native-probe.config.mjs). It bundles the owned source plus pinned
public fixtures. The cached 1.62 image supplies OS libraries only; the executed
browser and playwright-core are the exact **1.63** versions from the unchanged
lock/download. It runs as pwuser with Chromium sandbox enabled and an argv guard
rejecting `--no-sandbox`, no-new-privileges, the existing seccomp profile, read-only
public mounts and an internal task-only network without published ports. The
container/network were removed. No TLS exception or trust change was used.
The official 1.63 image pull returned Forbidden; its [log](browser-image.log) is
retained. The official direct matching browser [download](browser-download.log)
succeeded. Host sandbox launch failed; the unchanged container sandbox worked.
Earlier task-local harness setup errors were corrected before this final smoke.

The smoke is **not product browser acceptance**. It uses a synthetic in-page
transport, not HTTP auth. QA's composed Chromium/WebKit viewport/brand matrix,
trusted HTTPS/Secure-cookie, physical-device and release gates remain unexecuted.
No skipped/blocked case was counted as a pass; old QA totals were not reused.

## Ownership, remaining work and reproduction

[owner-requests.md](owner-requests.md) supplies exact export patch, stable session
identity, client adapter, context cancellation, legacy adoption, WP11 export and
Astra review requests. [browser-scenarios.md](browser-scenarios.md) maps 18 requested
QA scenarios to unit/API evidence and remaining browser obligations.

Reproduce from the frozen base in an isolated worktree, restore only the pinned
WP03/WP04 paths in composition.json, add their requested domain exports there,
copy the 19 owned files byte-for-byte and install with
`COREPACK_HOME=/workspace/.cache/corepack corepack pnpm@12.7.0 install --frozen-lockfile --ignore-scripts`.
Run the commands above. The service probe accepts `WP09_VALIDATION_ROOT` and uses
only a guarded disposable `B2B_TEST_DATABASE_URL`. It creates/drops isolated schemas.
The native probe's actual task paths and command are preserved in the config and
composition receipt; no binary/package cache is committed. Root typecheck needs
the parent's accepted WP02 dependency. Do not invent it or edit another owner's
planning module to obtain a pass.

Read application/Atlas AGENTS, local Atlas navigation/maintenance skills, policies,
October 17 source/minutes and A00-A08, pinned plan/full WP09 prompt, contract README,
ADR, schemas, endpoint inventory, SQL, dependency implementations/receipts and
startup instructions. Product strings retain Spanish localization; authored tests,
comments, docs and commits are English. The Atlas helper CLI is tied to Atlas;
the official `commits(root, base)` function was used for the application commit.
The PR metadata checker is run through its ordinary CLI.

Outstanding: INTEGRATION exports/workspace and current-access injection; WP06
composed authorization before enabling replay; QA matrix; Astra protocol review;
parent's merge decision. No main merge, activation or deployment occurred.
This v1 evidence is frozen at publication; follow-up corrections use v2.
