# Amendment 011: durable local workout departure

WP09 PR26 `fb9954a3b299d1edb7a64f5d1ae9a02359077f7f` supplies the local
flush implementation `0a85a8d1d0f2cf8a99937ceec1187cb846b30f0d`. Root integration
binds that owned seam into actual application routing. This amendment adds no
API, shared DTO, schema, migration, dependency or lockfile changes. Amendment 010
and the SSE lifecycle repair at `00b9f855` remain unchanged.

## Producer contract

`ProductTrainingSession` receives the existing `contextSignal` and a stable
`registerLocalFlush(flush)` callback. Registration returns cleanup that only
unregisters the same editor instance. `FlushLocalWorkout` resolves only after all
captured local edits and the durable selected-workout pointer have succeeded in
the current lifetime. Failure leaves captured values visible for explicit local
retry/export. Network synchronization and workout completion are independent.

Successful flush freezes the producer. An ordinary successful departure must
unmount or remount that visit; it cannot keep a frozen form as the active editor.
Logout, identity/realm/branch/role changes and revocation invalidate immediately
through existing authority cancellation. They never await local flush.

## Application navigation

The root navigation store publishes an accepted location only after the scoped
guard flushes the current editor. Section links, delegated application links,
the shell brand link and native Back/Forward share that gate. Guard identity,
authority signal and the actual registered editor are checked again after await.
Replacement/unregistration cancels pending route intent; a request queued during
history restoration is also fenced to its requesting authority epoch.

Repeated application clicks share one departure and keep the first requested
destination. Repeated native Back/Forward share one flush and retain the latest
native destination, so the browser URL and accepted view agree. During native
traversal the original editor stays mounted. A failed flush restores the original
indexed history entry with `history.go`, preserving both entries and unrelated
history state. Only a newly observed traversal can require another restoration;
abort and guard replacement do not queue duplicate history movements.

No-op and hash-only navigation leave the editor live. Native hash entries receive
their own index when the browser supplies null or cloned history state. An explicit
section reset can flush and remount even when its URL is unchanged, without adding a duplicate
history entry. Delegated links preserve modified/new-tab/download behavior and
native in-document scrolling. Hash comparison uses both accepted and actual
locations, which can differ while a native traversal is awaiting persistence.

Existing URL-local consumers still receive a committed navigation event.
Invitation token consumption uses an injected router replacement, preserving the
history index for both query and fragment tokens. It publishes that replacement
before marking the completed acceptance state. It never signals a new native
hash entry for a URL that was replaced in place.
No invitation grant, admission or credential behavior changes.

After successful departure, root clears any immutable-routine overlay and resets
the workout visit before publishing the destination. Failed navigation retains
the form and honest durability feedback; the producer's explicit retry/export
controls remain available. A failed route intent is not silently retried later.

## Explicit offline revalidation

Reopening an offline-bound workout for a fresh server check is an ordinary local
departure. Root flushes first, then remounts the complete selected-workout loader.
No new editable form appears until that load settles. This prevents a transition
in sync eligibility from cancelling queued edits. A failed read can return to
history with the already-persisted document, or reopen the retained offline
binding under the existing rules. A retained form never exposes an unguarded
error-panel Close button.

## Verification limits

INTEGRATION/v9 records permanent navigation state regressions and actual root
view/router/form/native-IndexedDB browser cases at mobile and desktop widths.
Those composed local tests use synthetic typed read responses; they do not replace
QA's live authenticated application, full browser/HTTPS or physical acceptance.
An asynchronous SPA gate cannot guarantee a hard browser/tab/process exit, and
does not introduce offline cold-start authorization or service-worker behavior.

No main merge, production activation/migration/deployment, real-user or external
health access, trust change, quota relaxation or history rewrite is authorized by
this amendment. Prior milestone and failed-run evidence remain immutable.
