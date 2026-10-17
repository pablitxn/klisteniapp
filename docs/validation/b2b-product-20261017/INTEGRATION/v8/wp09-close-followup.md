# WP09 amendment: await durable local edits on normal departure

Parent-owned dispatch; suggested model GPT6.1 Sol, high effort, fast service.
Suggested isolated branch `feat/b2b-workout-local-close-flush`. Start from root
`00b9f855746a7dd8c8ddfc97991e3a2163fa5ac8` after reading AGENTS.md and the current
WP09 contract/amendments. Parent retains orchestration; do not spawn duplicate
development tasks. Root owns final composition, shared contracts/schema and
lockfiles. Preserve all existing source and immutable evidence.

## Goal and proven defect

Drain every edit already captured by the actual training form into local durable
storage before an ordinary user-requested Close or route departure unmounts it.
The attached `close-race` reproduction at producer `5a727d67` uses the actual
form/hook and native IndexedDB: hold the first notes CAS, type a final correction
reason, click real `Volver`, release storage, reopen. Current code commits notes
at generation 1 but drops the queued reason; the no-close control stores both at
generation 2. Cleanup increments the epoch before the queued task executes.

## Ownership and implementation boundary

Own the training form/hook/local lifecycle module and their tests under
`apps/b2b-web/src/features/training/` and `apps/b2b-web/tests/`. Keep work confined
to the local edit/flush lifecycle. Do not edit root `app/`, shared DTOs/API,
schema/migrations, package manifests/lockfiles, QA-owned specs, Atlas or old evidence.
If root route composition is needed, provide an exact additive typed seam and
integration patch/request; root alone applies it after review.

Expose an awaitable local flush/requestClose or flush-registration seam. Normal
departure must stop accepting new edits, drain already captured edits, surface
local write/CAS/conflict failure, await durable selection/onDocumentReady, and
only then call the parent close callback. Awaiting a queue that internally
swallows errors is insufficient. On persistence failure retain the form and
captured values for retry/export, with honest user feedback. Double-close must
coalesce safely. Never overwrite a CAS conflict or silently force success.

Keep authorization/account/realm/context revocation prompt and fail closed; a
normal-close flush cannot authorize stale-context writes or hold private UI open
after revocation. Do not await network synchronization, change status/completion,
regenerate operation IDs, replace retained bindings, or conflate autosave and
completion. Preserve explicit new/resume, pre-realm original bytes, bound offline
recovery, exact retries and current-controlled input behavior.

## Acceptance and exact tests

- Actual form with delayed first local write: rapid notes/reason edits then Close
  preserves both values and the expected generation after reopening fresh storage.
  Close callback occurs only after final persistence and durable selection.
- Delay/fail the final write and separately produce a CAS conflict: Close remains
  pending/failed honestly, captured values remain recoverable, no false saved
  message and no successful parent close callback.
- Slow/failing onDocumentReady/durable pointer: same failure behavior; storage
  success alone cannot authorize an unsafe departure.
- Double Close and rapid repeated edits: one coherent flush/close, no skipped or
  duplicate logical edits; network sync stays disabled throughout the test.
- Context revocation/account switch during flush: stale completion cannot commit
  further queued edits, invoke success/close in a new context, or expose private
  data; owned guards still invalidate immediately.
- Mobile-first 320px and desktop actual form checks, plus appropriate existing
  hook/storage/correction/offline/replay regressions and focused typecheck/lint.

Publish an English Conventional Commit draft PR/evidence version with exact source
SHA, raw results, retained initial failures, runtime qualification and a self-contained
root integration request. Do not mark complete browser or production acceptance.
No production deploy/migration, paid service, external health/user data, credentials,
TLS bypass, guard relaxation or history rewrite.
