# Amendment 006: live workspace lifetime

This supersedes amendment005's 45-second stream lease. It changes no DTO,
historical row, migration006, lockfile or producer receipt.

## Stream and authorization

All concurrent subscribers await completed LISTEN initialization. A process
allows at most128 streams and8 per actor across sessions. Startup is bounded to
10seconds. Healthy streams remain open with five-second authorization heartbeats;
the browser watchdog remains10seconds. Server shutdown closes the event hub
before draining HTTP connections. A listener failure or committed relevant change
still invalidates subscribers immediately.

Target-health heartbeat authorization checks current actor, explicit trainer
grant, active target membership/grant and live consent under the existing lock
order. It does not read health records. Actual health GET retains its complete
guarded projection and dispatch revalidation.

Readiness belongs to the actual connection instance, not a reusable serialized
scope. Trainer-health disconnect, hidden/offline state, timeout or invalidation
aborts the disclosure lifetime and removes the projection; retry creates a fresh
lifetime before any new data may appear.

## Draft continuity and request suspension

Ordinary focus validation preserves the exact workspace, access object and
client lifetimes only when fresh bootstrap and complete selected access match.
Its explicit verification outcome distinguishes success from transport failure
and supersession. Changed authority, explicit selection, session event and logout
still synchronously abort the departed authority.

Temporary root-stream loss retains already-loaded owner-local editors. A stable
request guard immediately aborts pending network requests and rejects new ones.
Reconnection requires fresh stream authorization and successful bootstrap/access
verification before enabling requests. Unknown access never becomes successful
validation. Local saving and synchronization remain separate from completion.
No offline cold-start or durable planning-draft promise is introduced.

Public and invitation navigation remains available to an active identity. The
restricted-membership boundary remains above every route once identity is known.
Fresh public entry continues to read public data without initiating private
session discovery. A validated return to legacy mode clears stale product state.

Session storage retains only an optional organization/branch/role preference,
keyed by authenticated user and opaque realm lifetime. Fresh server choices must
authorize that exact preference before reuse. Logout removes it. It is neither
an access grant nor an authentication credential.

## QA binding

The activated synthetic fixture advertises actual planning, history, health,
trainer-health, people and report URLs. Workout entry is the real `Abrir sesión`
button inside `#scheduled-occurrence-ID`; no test-only route is introduced.
Readiness flags attest implemented composition paths for QA to exercise, not
browser acceptance. All notification, stale-response, offline and viewport
journeys remain subject to the final combined candidate's QA run.
