# WP09 ordinary Close persistence amendment, v7

Published source `0a85a8d1d0f2cf8a99937ceec1187cb846b30f0d`, additive to draft
PR26. Its frozen implementation base remains
`0b611064a91b87b3a17274cabca5415bcf1d7d55`; prior head/evidence
`5a727d67c60657d0affdbda38871f9d135eed07e` and v1-v6 remain unchanged.

The amendment was implemented and tested in an isolated branch/worktree starting
at the parent's exact current source `00b9f855746a7dd8c8ddfc97991e3a2163fa5ac8`,
following `INTEGRATION/v8/wp09-close-followup.md` at evidence
`5865824f8baefeb38cd97951f6a4b43d7c5506d2`. Only the four owned files listed
in `source-verification.json` were applied to PR26. Their bytes match the tested
worktree; no integrated dependency code is copied into the feature amendment.
The two frozen baseline producers match source5a727d67 and root00b9f855 exactly.

## Defect reproduced and corrected

The actual frozen form captures notes and correction reason while its first
notes CAS is held. Real Volver immediately unmounts, invalidates the epoch and
drops the queued reason. Fresh native IndexedDB then has generation1/notes only.
The no-close control has generation2 and both values. The retained baseline
source/build and native run reproduce this concrete difference.

The owned form now requests a local departure barrier instead of calling its
parent synchronously. It freezes new producers immediately, coalesces double
Close, drains every already-captured local edit and awaits successful durable
selection/onDocumentReady before calling the parent. Flush explicitly checks
write and selection failures even though the general form queue catches errors.
It never waits for network synchronization, marks completion, regenerates IDs,
replaces frozen pending payloads or authorizes another account/context.

On failure the form remains available, shows a local durability error, preserves
all captured values and offers explicit retry/export. A retry retains the original
failed-write CAS base, including later captured edits, and never overwrites a
concurrent actuals change. The existing explicit local reload/archive action
remains available for a genuine conflict. A slow or failed durable pointer also
prevents successful departure even if workout persistence itself succeeded.

Authorization/account/realm cancellation stays immediate. Existing identity/epoch
checks are checked before writes and close completion; the additive contextSignal
cancels the local IDB lifetime and hides the private form on revocation. No flush
is installed in React cleanup. Access refresh was moved outside the local queue,
so even a never-resolving network operation cannot hold local Close. Autosync
preparation/replay cannot start new work after the departure barrier freezes.

## Exact typed seam

The existing `ProductTrainingSession` export remains. Its options add:

```ts
contextSignal?: AbortSignal
registerLocalFlush?: (flush: FlushLocalWorkout) => void | (() => void)
```

`FlushLocalWorkout` comes from owned `sync/localWorkoutFlush.ts`:

```ts
type LocalWorkoutFlushOptions = { retry?: boolean }
type FlushLocalWorkout = (options?: LocalWorkoutFlushOptions) => Promise<void>
```

The hook also exposes `flushLocal(options?)`, `requestClose(close, options?)`,
`closing`, and `closeError`. The owned normal Volver button already uses the
coalesced, guarded requestClose path. `{ retry: true }` is an explicit retry of a
previously surfaced local failure, never a conflict overwrite or a fresh server
request. Promise fulfillment means local writes and selection succeeded in the
same still-current lifetime; it says nothing about server sync or completion.

## Executed validation

- Node24.19.0, pnpm12.7.0, exact frozen root dependencies. Install reused the task
  store; no source manifest/lockfile changed. `install.log` retains the result.
- Full composed web unit suite: **291 passed, zero failed/skipped** (parent's285
  plus six lifecycle regressions), `web-release.log`. Relevant existing storage,
  draft/correction/offline/immutable replay/selection tests run in that suite.
- Focused composed web typecheck and ESLint pass; owned formatting and repository
  B2B boundary checker pass. Raw commands/results are in their named logs.
  Native Vite builds pass for frozen and patched actual producer sources.
- **15 native cases pass**, `native-browser-release.log` and `result.json`, using
  matching Playwright1.63.0 / Chromium153.0.8010.12 with sandbox enabled, nonroot
  pwuser, real IndexedDB and fictitious native insecure HTTP. Cached1.62 image
  supplies only OS/Node libraries, not its browser or driver. Runner Node24.18.0;
  exact1.63 driver/matching browser cache are mounted read-only. No crypto, online,
  secure-context, TLS/trust or sandbox shim. No exposed ports or external targets.
- Cases: frozen data-loss reproduction and no-close control; normal double Close
  with delayed first write at320px and1440px; delayed final write at320px; final
  quota failure and explicit retry; earlier swallowed write failure with a later
  captured edit; CAS conflict with visible/exportable local values and no remote
  overwrite; slow final pointer; failing pointer and explicit retry; slow initial
  pointer with queued edits; four rapid edits/generation4; context revocation and
  account switch during flush; never-resolving in-flight network work.
- Fresh store reads prove normal Close retains notes+reason at generation2.
  Parent close occurs after the final pointer. Failed cases call no successful
  parent close. Retries preserve operation ID/hash/body bytes. Revocation/account
  switch commit no stale held/queued edits, hide private values, and never close a
  new context. The network case closes without resolving its held access refresh.
  All native cases made **zero API requests**; core edit/flush cases disable sync.
- API/database/auth/complete browser matrix was not rerun: no API/schema changes
  are part of this amendment. This is actual owned form/hook/storage evidence,
  not full application navigation, real login/authorization, WebKit, HTTPS or
  production acceptance. Those remain parent/QA composed-head gates.

`probe.tsx`, `run.mjs`, `build.config.mjs` and before-source files retain exact
reproducers. The only failed new attempt, `native-browser-initial.log`, reused a
DB name across before/after bundles; the expected first held write never began
because the after case recovered the old record. Distinct before/after DB names
corrected that fixture issue. Successful rerun/final/release logs are retained
at their actual inputs, not relabelled as initial success. Parent's original
host/container failures remain in its immutable v8 evidence, not rewritten here.

## Root handoff and remaining gate

`integrator-route-flush.patch` is an exact additive proposal against root00b9f855,
verified with `git apply --check`, **not applied or claimed root-typechecked**.
It threads the actual contextSignal and stable local-flush registry through
ProductWorkoutHistory/SelectedWorkout, guards ordinary internal section departure,
and remounts the workout visit after successful departure (including a same-view
history navigation). It unregisters only the matching instance. Failure retains
the route/form and honest feedback; the owned session button performs explicit
retry/export. Parent alone applies/reviews root `app/` changes.

Parent must use the same awaited bridge at every other ordinary SPA route action
that unmounts an active workout. Guard the context again after await; coalesce
repeated navigation. Do not install an await in unmount cleanup, replace the auth
controller, or await flush on logout/account/branch/realm/access revocation.
Those paths invalidate/hide immediately. Callbacks must be local-only durable
selection operations. Do not turn a flush success into a server-saved/completed
message. An async barrier cannot guarantee a hard browser/tab/process close;
no service-worker or offline cold-start guarantee is added.

QA handoff: real typed form edits followed immediately by owned Volver or an
integrated ordinary section route, with final notes/reason recovered after reopen;
repeat at320px/desktop, with slow/failing local write or pointer, CAS conflict,
double-close and authorization/account departure during the barrier. Keep actual
root navigation/authorization acceptance separate from this producer proof.

No root/shared API/DTO/schema/migration/export-barrel/manifest/lockfile, history,
calendar, programs, health, QA spec or Atlas changes. No real user/health data,
providers, paid calls, credential/security changes, deployment, force push, main
merge or new dispatch. Atlas instructions/context remain the prior frozen receipt.
Parent retains monitoring, composition and merge decisions.
