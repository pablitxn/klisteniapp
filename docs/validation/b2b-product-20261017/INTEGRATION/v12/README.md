# Integration v12: inactive public recovery and programming owner handoff

Published root executable: `22310c7ee29423e7672a8e74dc801557adab53e9`, branch
`integrate/b2b-product-v1`. It builds on v11 source `bd30eab5` and evidence
`89409dcdbd4faedccfeec8ee236932191c6195d3`. This candidate repairs INACTIVE-003.
The separately owned planning CSS fix is diagnosed and ready for parent dispatch;
it is **not applied** to this candidate.

## Exact QA inputs

Read QA branch `9307b69418d3c8feb6dd9d0df2d954bb62154313`: WP12/v21 owner
request, proposal and sanitized route evidence; v27 programming request; v28/R39
and v30/R40 reports and native viewport measurements. The two focused waves each
remain3passed/2failed. Their prior functional checks pass, then PROGRAMMING-004
and008 exceed the unchanged320px viewport predicate. Original full matrices run
on appbd30eab5 / QA1374b94; focused diagnostics use QA5442ab4. None of those
snapshots, results, assertions or running processes was changed here.

Original requests: [inactive route](https://github.com/pablitxn/klisteniapp/pull/21#issuecomment-6240581927)
and [programming layout](https://github.com/pablitxn/klisteniapp/pull/21#issuecomment-6240983532).

## Root repair and privacy boundary

`useBrandContext` now retains the response's structured status/code alongside its
existing error message. Success and the explicit WHITE_LABEL_DISABLED legacy
fallback clear that metadata. App bypasses its brand-error screen only when the
route is notFound and the response is **403 CONTEXT_REVOKED**. No localized text
comparison is used. Other host/session/network/service errors stay on the denied
screen; the QA proposal's blanket notFound exception was intentionally narrowed.

For this exact `/context` response, server host resolution and session-realm
binding have already succeeded before the inactive operational guard denies the
request. The public404 needs no private data or eager bootstrap. Its existing
header `/app` link starts the normal session controller and reaches restricted
export access. Once bootstrap exists, ProductWorkspace and MembershipAccessBoundary
still govern public destinations and Back navigation. Home/public-brand errors
remain unchanged. No server allowlist, auth, tenant, export restriction, schema,
seed, contract, dependency or lockfile was modified.

## Targeted validation

- **24 native browser records pass**,12each in Chromium153.0.8010.12 and
  WebKit26.6 with Playwright1.63. Two records reproduce the frozen baseline;
  22exercise patched behavior. Actual App, ApplicationProvider, brand/session
  hooks, ProductWorkspace and MembershipAccessBoundary run with synthetic HTTP/SSE.
  At320and1440, fresh unknown-route load sends only public `/context`, displays
  404 without private panels, and the existing `/app` header reaches export-only
  UI. Back retains the membership boundary. Negative421,401,other403,missing-code,
  502,other404 and native network-failure cases stay denied without bootstrap.
  Home denial is unchanged; retry uses the new response and clears legacy errors.
  [Chromium log](public-route/chromium-2.log), [WebKit log](public-route/webkit-2.log).
- **Three real composed HTTP/API/PostgreSQL tests pass**, zero failed/skipped.
  Both modes retain branchless export-only bootstrap/access, export200, and exact
  operational routines/history/health/people403. White Label context gives bound
  inactive403, anonymous known-host200, unknown-host421 and foreign/alias/unbound
  session401. A test-only removed binding is restored with every original column.
  Existing duration fixture, history preservation and inactive-foundation coverage
  remains. [Receipt](http/README.md), [final log](http/composed-final.log).
- **19 React and299 web tests pass**, zero failed/skipped. Root typecheck14/14,
  lint14/14 plus formatting/boundaries, and build16/16 pass. Cached unaffected tasks
  and existing chunk-size warnings remain explicit in raw logs. Both consumer
  builds execute. Owned formatting/ESLint/whitespace checks pass.

The native producer uses a readonly mounted synthetic fixture, nonroot pwuser,
existing seccomp/no-new-privileges, Chromium sandbox and exact browser binaries.
The cached1.62 image supplies OS libraries only. Native loopback secure-context
classification and real clock are untouched. An initial directory traversal
permission caused MODULE_NOT_FOUND before browser startup; making only the
synthetic harness directory traversable fixed setup. Both failed startup logs are
retained. No sandbox/TLS/credential relaxation or private trace promotion occurred.

These are composed UI and separate actual HTTP boundary proofs, not a completed
real-authentication INACTIVE-003 browser scenario. QA should rerun that unchanged
scenario in both HTTP modes/all six contexts on this exact candidate. Earlier
v11 passes and active full-matrix counts are not transferred or summed into it.

## Planning diagnosis and ready-to-dispatch task

The actual PeriodImpactEditor and two-stage GoalProgramEditor reproduce WebKit's
**371px document width and51px real horizontal scroll range** at320px. The selected
published-routine label propagates an automatic minimum through its immediate
`.field` grid child. Native select bounds fit, explaining the empty right-edge
only diagnostic list. Select ellipsis/clipping does not fix the page.

The task-local single rule `.programming-grid > * { min-width: 0; }` changes both
editors to **320px and0px horizontal scroll range**, preserving values/options and
without page clipping. This is an isolated diagnostic CSS injection, not a source
fix or a passing QA004/008 result. Planning source bytes remain unchanged from
bd30eab5. [Measurements](planning-diagnosis/summary.json) and full native runs are
retained with actual-component harness sources.

[Self-contained WP07 request](planning-diagnosis/owner-request.md) gives exact
scope, suggested GPT6.1 Sol high/fast model, isolated branch, dependencies,
reproduction and acceptance. Parent should dispatch the planning owner for the
one-rule change in `programming.css`; root will normally integrate its exact
returned code/evidence head. The producer should validate native controls, long
routine names and preserved versions across mobile/desktop; QA then reruns
unchanged004/008 in both HTTP modes, starting with WebKit320. No product decision
or contract change is needed. Root did not duplicate or dispatch that development.

## PR lifecycle and remaining work

Read-only GitHub metadata confirms PR32 closed without merge at19:48:41UTC,
with null state_reason and no explanation in its comments. Its frozen PR head is
d4a9a9b; the evidence branch still exists at9307b694 and was fetched directly.
The direct timeline API returned Forbidden. QA's PR-body lifecycle audit reports
accountpablitxn closing it and deleting the head ref at19:49:23UTC; that timeline
is attributed to QA rather than independently attested here. Rationale is unknown.

The authorized candidate push reported a new remote integration branch. Subsequent
metadata confirmed PR21 also closed without merge at19:48:58UTC, frozen at89409dc.
The push recreated `integrate/b2b-product-v1` at22310c7 without rewriting history.
Both PRs remain closed; no replacement PR, reopening or metadata update was made.
[Lifecycle snapshot](pr-lifecycle.json) records observations and their limits.
Parent must resolve the intended review lifecycle; candidate/evidence publication
and testing remain available by exact branch/SHA.

Remaining: dispatch/integrate the owned planning fix, authenticated revalidation
of the affected scenarios, ongoing full-matrix results, and previously qualified
trusted HTTPS/physical acceptance. Main remainsd65261d18de4522fb9a66104aabb5750104fb8b8;
Atlas remainsce45d206a2ed4035f8003a3303abd1fff98e09b8. No main merge, production
activation/migration/deployment, real-user/external health access, paid service,
credential/trust change or history rewrite occurred. Parent retains orchestration.
