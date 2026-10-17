# WP09 retained correction bindings and controlled input proof, v6

Feature source `0750ca7ece06fd7a72c3d69aace9dfc78681d591`; frozen implementation
base `0b611064a91b87b3a17274cabca5415bcf1d7d55`. Isolated dependency composition:
`efbed2dd1c7ed06092463a3eec4531c2a3e10075`, amendment007, plus exactly the owned
files in `source-files.json` and v4's validation-only direct `@noble/hashes` 2.4.0
registration. Every inventoried source byte was compared with the tested worktree.
No dependency code, API, DTO, migration, root/navigation, manifest, lockfile,
history, calendar, programs, health or QA browser-spec changes are committed.
Atlas remains `ce45d206a2ed4035f8003a3303abd1fff98e09b8`; PLAN remains
`447d77ebb5587e319018e7b56003f0ef7299bb6c`.

## Published modules

- Independent urgent input commit `1371477205ec1a767bcfac21ae9de1c973a65619`
  captures correction reason, notes and performed-at strings synchronously before
  serialized edits. This preserves React-controlled input and immutable pending
  requests; no optimistic CAS bypass or queue replacement is introduced.
- `createWorkoutClient.sessionBinding(id, signal)` calls the exact named endpoint
  and rejects foreign originals/accepted IDs. `loadSessionWorkout` validates owner,
  branch, origin, assignment, execution, immutable program/version/schema and the
  authoritative prescription union. It refreshes binding metadata under CAS;
  local actuals, pending operation IDs/hashes/bytes and original evidence remain.
  A newer different server revision produces an explicit conflict. An exact
  already-accepted pending operation remains an exact receipt retry.
- First correction retains the actual original record separately, accepted null,
  same session/execution/assignment IDs and schema1 reference. Supported source
  actuals retain original units/load/notes. Original completed status never
  supplies completion intent. Reason is required before initial queue/autosync.
  Unsupported manual variants get no invented reviewed segment: original evidence
  stays visible and exportable; corresponding correction actuals must be entered
  and explicitly confirmed before first send. Unrepresentable entries remain
  blocked with original evidence rather than silently discarded.
- The form consumes explicit `SessionPrescriptionBinding`; compatibility with
  unspecified load is never cast to `RoutineVersionV2`, reclassified as bodyweight
  or presented as a trainer/laterality confirmation. Reviewed alternatives retain
  their own target doses; compatibility has no reviewed alternatives. Accepted
  old source segments retain the binding selected by the server after later global
  supplement adoption. Conflict recovery accepts its matching binding too.
- Stored optional binding metadata is strict, owner-linked and additive to local
  document schema2. Original revision zero cannot be dropped or replaced. Owner
  recovery export includes retained original/binding as separate unconfirmed work.
  Offline editing can use only a previously persisted bound document, under the
  exact current owner/branch/realm; it grants no fresh authority or automatic replay.
- An already-valid immutable correction can replay while later local edits remain
  unfinished. An old revision-zero payload lacking reason remains byte-for-byte
  preserved and is rejected locally before any save call. The durable-selection
  callback must finish successfully before sync; failed pointer/storage writes
  remain visible until explicitly retried. Context cancellation aborts binding CAS.

## Executed checks

Node 24.19.0, pnpm 12.7.0, frozen resolutions. On the declared composition:

- Web unit tests: **216 passed, zero failures/skips**, including 13 new legacy
  binding/replay cases. `web.log` and `results.json` record final owned source.
- Full API: **236 passed, zero failures/skips**, using only disposable synthetic
  PostgreSQL 17.11 at task-local port55439/database `klisteni_b2b_test`.
  `api.log` records exact efbed API inputs. No API code changed during UI followups.
- Two standalone real PostgreSQL UI/domain/service workflows: **2 passed, zero
  failures/skips** (`integration-final.log`, `workoutLegacy.integration.ts`). First
  correction/retry commits one receipt/audit; original raw SQL data stays exact;
  later reviewed adoption and assignment retirement preserve the old compatibility
  correction. Competing actual correction returns CAS conflict, preserves pending
  bytes, and needs an explicit successor choice.
- All **14 root typecheck tasks**, all **14 lint tasks**/formatting, boundaries
  and B2B build pass. Final commands are in `checks.py`/`results.json` and raw logs.
- Exact native Playwright1.63.0/Chromium153.0.8010.12, sandbox enabled, real IndexedDB,
  fictitious insecure HTTP and real typed client requests to a synthetic HTTP
  receipt server: complete through the actual form, wait for accepted completion,
  type reason character by character, edit notes/date, retain original operation
  bytes and accept a successor. Manual legacy correction makes zero requests
  before reason, zero after reason alone, zero after entry alone, exactly one
  after explicit confirmation; original revision zero and accepted revision one
  remain distinct. `native-browser-captured.log` is the successful result;
  `probe.tsx`, `run.mjs`, `probe-build.log`, `built-handler-check.log` retain inputs.
  Cached 1.62 image supplies OS libraries only; mounted exact1.63 driver/binaries
  supply runtime. Browser runner Node24.18.0, no security/property/online/TLS shim,
  no sandbox disable, no external targets/providers or published ports.

The native proof is owned form/storage/typed-HTTP evidence, **not** the real full
application login, actual PostgreSQL HTTP authorization or QA browser matrix.
Real PostgreSQL semantics are separately tested as above. QA owns real SYNC-010
and the composed Chromium/WebKit/viewport/brand/HTTPS acceptance.

## Failed attempts and limits

The initial standalone test was temporarily under web/tests and imported API
internals across a workspace boundary. Static checks correctly failed; the
validation-only cross-application harness now lives here, outside shipped app
source. It requires its declared isolated workspace and disposable database;
there is no new product cross-workspace import or boundary exception. Test-only
scope types were made strict via existing schemas. A first install with the
wrong default metadata cache failed offline; frozen online installation reused
all existing packages with no lockfile resolution update. No install failure
is relabelled as a pass.

Native launch first failed task-directory read permissions, then a polling
observation read null. After explicit awaited host-side polling, a subsequent
run correctly reproduced empty correction input because a stale validation copy
still had the old event handlers. These failed logs are preserved. Correcting
the copied source and verifying the built `correctionReason: value` handler gave
the successful stronger typing result. No second input defect was established.
The task executor remained reachable. No failure or skipped case is counted as
an acceptance pass. All earlier v1-v5 evidence remains untouched. Source-only
whitespace checks pass; raw tool-log whitespace is intentionally preserved.

## Parent integration and QA requests

`root-recovery-and-binding.patch` is an exact proposal against efbed root files,
verified by `git apply --check`, not applied and not claimed root-typechecked.
It supersedes v5's pointer-only patch and covers durable owner/realm selection,
awaited editor callback, revision-zero navigation with original IDs and accepted
session binding. It removes current-global-alternative substitution from retained
sessions. Applying it alone deliberately blocks the old silent-new legacy path;
parent must finish explicit chooser navigation below. Replay remains default-off
in the feature; parent owns the actual accepted WP06/root replay gate.

1. Instantiate `useSelectedWorkoutRecovery(store, context)` from actual current
   bootstrap/access/native origin/context signal, including branchless inactive
   discovery. Use its fresh owner exporter in WP11. Pass `recoveryWorkoutScope`
   into every owned document and await `onDocumentReady={recovery.remember}`.
   Never remember a merely computed session ID before a durable row exists.
2. For every existing/accepted edit and resume, call `loadSessionWorkout` with the
   actual issued origin/id and `readBinding: io.sessionBinding`. Pass its explicit
   `prescription` and `initial` to the editor; bind conflict loading via
   `loadRemoteBinding: () => io.sessionBinding(id, currentSignal)`. Keep actual
   null accepted for original-only records. No current global supplement or
   mutable planning projection can replace the server's retained binding.
3. Retain the actual `legacyAssignments` DTO from `onStartLegacy`. Load its exact
   issued routine discriminator, and only a validated reviewed supplement when
   starting genuinely new work. Render owned `LegacyWorkoutEntryChoice` with
   `{ store, context, assignment, routine: verifiedRoutineOrNull, onSelected }`.
   Its `onSelected(document)` provides one real durable id/origin, not a newly
   generated id on each open. A new executionId-null document without accepted
   content is a fresh local draft; a missing sessionBinding (actual404 only) may
   use its exact verified issued routine. A denied or existing accepted binding
   must never take that fallback. A pending uncertain send first checks binding
   and retains exact receipt retry. Actual v1 browser bytes go through the owned
   preserved legacy source/export path, never a rewritten transport.
4. Old realm-less documents require `findUnboundWorkout` plus explicit
   `UnboundWorkoutRecoveryChoice`; original source and operation bytes remain.
   Previously bound offline documents can use `restoreOfflineSessionWorkout` only
   in current matching authenticated active context. No global scanning, guessed
   scope, automatic adoption, cold-start promise or unrestricted replay.
5. QA scenarios: actual completed→synced→reason fill/fast typing→correction;
   original-only first correction with same IDs/reason gate; manual variant
   explicit entry/confirmation; reload and response-loss retry; newer conflict
   before explicit local/server choice; old compatibility correction after later
   real trainer adoption; explicit legacy resume/new; inactive direct reload and
   owner export; account/realm/retired grants with no replay. Browser specs stay
   QA-owned; trainer supplement-adoption UI remains its separate owner.

No production deployment, real user/health data, external providers, credential or
security changes, paid calls, force push, main merge or new task dispatch occurred.
At source0750ca7 GitHub reported draft PR26 open, unmerged, no commit statuses or
workflow runs, and mergeable=false. Parent owns composing/integrating its frozen
base rather than changing this branch's implementation base. Hosted CI, root
navigation, actual authorization and complete browser acceptance remain gates.
