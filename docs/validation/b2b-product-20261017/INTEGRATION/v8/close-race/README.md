# Confirmed WP09 v6 immediate-close local data loss

Read-only review reproduction. No tracked source was modified. The temporary
source copy's actual form, hook and IndexedDB store match WP09 commit
`5a727d67c60657d0affdbda38871f9d135eed07e` byte-for-byte; hashes are in
`source-verification.json`. Contracts/domain/UI dependencies came from root
`bb2a2d414f9043c2f5bfcbb9908fa4dd9e88360a`. No login, provider, actual user data,
network sync or production operation is part of this test.

## Result

The actual `ProductTrainingSession` loses a captured correction-reason edit
when its real `Volver` button unmounts it while a prior local write is pending.
The earlier in-flight notes write commits after unmount; the queued reason edit
does not reach the store. Opening a fresh native IndexedDB store confirms loss.

| Case | Durable notes | Durable correctionReason | Generation |
| --- | --- | --- | --- |
| Same edits; allow queue to finish | Notes entered before slow storage | Final reason entered before close | 2 |
| Same edits; close while first write held | Notes entered before slow storage | empty string | 1 |

Both assertions passed; no page errors. `result.json` and `container-run.log`
retain the complete write-start/commit/close sequence. The close case has no
write-start for the reason at generation 2.

## Test mechanics

`probe.tsx` renders the real producer form, uses the real `IndexedDBWorkoutStore`,
and wraps its first notes edit CAS in a manually released promise. It does not
alter producer code, fake a successful write, or replace IndexedDB with memory.
The first local edit is held before commit to model slow storage. Playwright
fills the actual reason textarea while the edit queue is blocked. In the failing
case Playwright clicks the actual `Volver` button and the authorized parent
callback unmounts the component. Then the harness releases the write and reads
the document through a fresh store instance.

`integrationAccepted=false` disables network synchronization. The control and
close case use identical storage gating and field interactions.

Built with existing Vite 8.3.1 and React 19.3.0. Browser test uses existing
Playwright driver 1.63.0 against cached sandboxed Chromium 151.0.7922.34 in the
workspace's existing `klisteni-browser:1.62.0` image, as nonroot `pwuser`, with the
pre-existing seccomp profile and no-new-privileges. No no-sandbox flag, TLS bypass
or security setting change was used. This establishes a local form/hook/storage
race; it is not the complete QA browser/runtime matrix.

## Cause and minimum producer amendment

- `ProductTrainingSession.tsx:110–112` calls `props.onClose` synchronously.
- `useProductTrainingSession.ts:152–164` serializes edits and skips a queued task
  if its captured epoch differs from `generation.current`.
- Cleanup at `:135–139` increments that generation on unmount.
- Therefore an edit queued behind the delayed IndexedDB write is discarded on
  normal close. The first write may commit, making the document look partly saved.

Add a producer-owned awaitable `flushLocalEdits`/`requestClose` seam. Normal Close
must stop new edits, drain all already captured edits, verify local persistence
and durable selection succeeded, and only then call the parent close callback.
Do not wait for network sync, change completion state, overwrite a CAS conflict,
or let a stale context continue writing. Storage failure should keep the form
available for retry/export instead of reporting a successful close.

Merely awaiting `tasks.current` is insufficient if its tasks swallow persistence
errors; the flush must surface the hook's unsaved/storage-conflict state. Root
can use an exposed flush registration for other ordinary route departures;
authorization revocation/account change must still invalidate private UI promptly.

Producer regression should reproduce the control/failing pair with a delayed
store and cover delayed failure/CAS conflict, rapid typing then close, double
close, and context cancellation while flushing. Parent owns dispatch and root
composition; this harness adds no application implementation.

## Harness setup attempts retained

- Initial build lacked the unmerged alternatives dependency; added that dependency
  from the pinned root only in the temporary source tree.
- Library build needed an explicit CSS filename and production NODE_ENV define.
- Host Chromium failed its existing sandbox configuration; `host-run-failed.log`
  retains the failure. Used the already configured container instead.
- The first container bundle attempt timed out before the NODE_ENV definition;
  `container-run-before-define.log` retains that failure. Only the final
  `container-run.log`/`result.json` are the successful reproduction.
