# INTEGRATION request: inactive White Label unknown-route availability

Observed application `bd30eab5b2a33c3f3e8a7692649632ec85103431`, QA
`1374b94ed441365789d2756742afa8306022c0a0`, active run R35 White Label HTTP,
B2BP-INACTIVE-003 at Chromium320. This is a failed real authenticated browser
cell; its original result remains failed and the full run continues unchanged.

## Exact reproduction and boundary

1. Sign into the real primary-branch member workspace on `atlas.b2b.test`.
2. A separate authenticated authorized staff context deactivates that member.
3. Reload and visit the real programming/history/health/people/reports deep links.
   Each correctly shows restricted export/invitation. Back and Forward do too.
4. Hard-navigate to `/unknown-wp12-route` while still authenticated/export-only.
5. The document returns 200, then actual `/api/b2b/context` returns 403. Instead of
   the application's existing `Esta página no existe` heading, the shell shows
   `Tu cuenta permite descargar tus registros.` and only a retry control.

No session-history or health panel is displayed. The failure is public-route
availability, not a demonstrated private-data disclosure. Unified R34's same
Chromium320 scenario passed. Other White Label contexts remain pending; no
historical browser or broader-engine reproduction is invented.

## Source-supported cause

`ApplicationProvider.tsx` enables the session controller after a workspace route
is needed. A hard load on `notFound` is public, so no product bootstrap is started.
The actual inactive `/context` request is denied by the HTTP access guard.
`App.tsx` returns the generic brand-error shell before its `notFound` route can
render, because `session.bootstrap` is absent and only workspace route kinds
bypass that error branch. The trace and captured shell match this source path.

The relevant App/provider/HTTP source paths are byte-unchanged from a1ade612;
this receipt does not attribute the issue's introduction to v11 or claim a
previous-source browser result. It is first observed here by broader mode coverage.

## Concrete owner action

Preserve the server's export-only/private API denials. Allow the resolved public
unknown route to render its existing 404/fallback shell despite unavailable brand
context, with the normal header return to `/app` and restricted export. The
attached one-condition [proposal](public-notfound-proposal.patch) demonstrates the
narrow frontend route exception; it is an owner-review suggestion, not an applied
patch or a passing implementation claim. INTEGRATION should retain any required
invalid-domain/public-brand error policy while fixing this inactive known-brand
case. No operational inventory, health, auth or cookie rule should be loosened.

Do not change the existing QA 404 or private-region assertions to obtain a pass.
The complete unchanged INACTIVE-003 must pass in both HTTP modes and all six
contexts on the exact accepted owner fix head. QA will not edit shared App/API
implementation without reassignment. Parent retains orchestration.

[Sanitized route timeline](sanitized-route-network.json), original encoded error
context, screenshots, task-local trace hash and exact source proofs accompany
this request. No headers, cookies, query tokens, request bodies or private trace
bytes are published. Both full matrices continue on their original pinned source;
there is no current infrastructure blocker and no completed test is restarted.
