# Integration v8: complete owner composition and event-stream repair

Immutable application source: `00b9f855746a7dd8c8ddfc97991e3a2163fa5ac8`,
published and remotely verified on `integrate/b2b-product-v1`, draft
[PR21](https://github.com/pablitxn/klisteniapp/pull/21). Composition commit
`0da4ff8f7c9a38dde4a48aee9a8397e177f314bb` is followed by the final initial-frame
backpressure cleanup regression/fix. This receipt changes evidence only.

Main remains `d65261d18de4522fb9a66104aabb5750104fb8b8`; consulted Atlas remains
clean at `ce45d206a2ed4035f8003a3303abd1fff98e09b8`. No main merge, production
activation/migration/deployment, real-user data, external health access,
credential changes, TLS bypass, quota increase or history rewrite occurred.
Prior milestones and all earlier evidence versions remain intact. Parent owns
Cloud producer dispatch and final acceptance; local agents performed read-only
review/reproduction only.

## Exact producer inputs and root composition

All of these inputs are ancestors of the immutable source via normal merges.

| Owner | PR | Immutable input | Integrated behavior |
| --- | --- | --- | --- |
| WP07 | 29 | `59d195de9a84029f7fd3a83524147e9aef12a933` | Actual staff legacy-assignment picker, explicit adoption and saved-version/supplement refresh |
| WP09 | 26 | `5a727d67c60657d0affdbda38871f9d135eed07e` | HTTP-origin hashing, controlled correction input, durable selection, retained bindings, explicit legacy entry and recovery |
| WP01 | 30 | `a46362883313244652fa6784ed8ca0134f02bbd9` | Full invitation grant arrays with authorized archived-branch metadata |
| WP08 | 25 | `f96db71de51813be4eafb552381c0ff579247c45` | Actual 320px history wrapper fix, preserving prior issued-period detail |
| WP12 | 31 | `baa8e5a1ac312b50c23d87d764e34b20f0cea310` | Bounded diagnostics, corrected fixtures/selectors and honest unavailable adoption acceptance |

Root implementation is specified in amendments
[009](../../../../contracts/b2b-product-v2/amendments/009-invitation-metadata-and-recovery-composition.md)
and [010](../../../../contracts/b2b-product-v2/amendments/010-event-stream-lifecycle.md).
Root binds actual session identities through `sessionBinding`, preserves
revision-zero original evidence separately, and never substitutes current routine
content for accepted history. New legacy sessions require the explicit resume/new
chooser and one durable identity. Pre-realm work requires explicit copying;
offline reopening requires a persisted authoritative binding and current matching
owner context. Offline reopening enables neither new work nor replay. Inactive
accounts can discover/export their own selected local work without operational
reads. Normal transient stream suspension no longer destroys the local editor.

The additive invitation metadata endpoint requires the ordinary selected
organization/branch/session transaction plus active effective admin/superadmin
and `manage-people`. Archived metadata does not grant authority. Actual invitation
creation/acceptance still revalidate branch status. The API and typed consumer
reject foreign scope and duplicate rows. No schema migration is added here.

Native `crypto.getRandomValues` supplies UUIDv4 operation identities on ordinary
HTTP origins, where `crypto.randomUUID` is unavailable. No weak randomness or
authentication shim is introduced. The existing locked `@noble/hashes` 2.4.0
becomes a direct web dependency: lockfile delta is exactly three importer lines;
package resolution/integrity are unchanged. Frozen installation passed.

## Confirmed SSE failure and repair

QA's original reproduction at its prior candidate left one, two and three
upstream responses after successive gateway disconnects. Independent actual-HTTP
probes at root `c10cc3d398aba821d53a59b248c09090b0110992` reached eight retained
listeners and then the real unchanged 429 limit through both proxy paths. Direct
API disconnects released every listener. The proxy listened only for abortion of
the already-complete GET request, which does not signal later response closure.

Gateway and white-label HTTP test proxy now destroy upstream request and response
when the downstream response closes. Post-header errors terminate the stream.
API entry rejects a transport that already died during preceding authentication;
initial ready-frame backpressure also returns before creating a heartbeat timer.
Healthy stream lifetime, periodic authorization and caps of eight per actor and
128 globally are unchanged.

Client reconnect uses bounded exponential backoff, a five-second floor for 429,
and longer `Retry-After`. Visibility/offline events cannot shorten an existing
deadline. Only authorized readiness resets retry. Departed stream frames cannot
invalidate a replacement; simultaneous same-context focus/ready authorization
checks coalesce while explicit context changes still supersede them.

On the final source, the preserved probes report:

- Direct API, gateway, and complete HTTP proxy chain: ten sequential 200 responses
  each and **zero** remaining hub listeners after disconnect.
- Delayed API entry after client departure: aborted/destroyed transport and
  **zero** listeners.
- Exact adapted QA reproduction: direct `0`, proxied `[0, 0, 0]`.
- Permanent actual-HTTP regressions: sixteen transitions per path, eight healthy
  concurrent streams, ninth denied, independent actor admitted, released slots
  reusable, delayed-entry cancellation; **four passed**.

The `stream-probes` directory preserves baseline source copies, before/after
stdout, executable probe text and provenance caveats. The adapted QA probe only
changes its root-relative import and obsolete source label. These tests use real
Node sockets and actual stream/proxy modules with synthetic LISTEN/authority;
they do not establish browser or complete authenticated product acceptance.

## Validation and exact qualifications

All checks use local/dev synthetic data. Database checks use isolated disposable
schemas on loopback PostgreSQL 17.11; full API and composed HTTP use separate
synthetic databases. Normal admission/authentication/authority checks stay active.
The composed harness uses both real built consumers and actual password admission,
bootstrap/access, SSE readiness, branch-scoped planning/adaptation save/publish,
history, invitation metadata and inactive export-only reads in both modes.

| Check | Result | Attached log / source qualification |
| --- | --- | --- |
| Root typecheck | 14/14 tasks | `root-typecheck.txt`; before final retry-deadline and ready-backpressure follow-ups |
| Root lint, boundaries and formatting | 14/14 tasks | `root-lint.txt`; same qualification; changed files received focused checks below |
| Root build, both consumers | 16/16 tasks | `root-build.txt`; source `0da4ff8`; final later change is API guard/test only |
| Full B2B web | 285 pass, 0 fail/skip | `web-285.txt`; before final one-line retry-deadline preservation; focused final four below |
| Shared client | 31 pass, 0 fail/skip | `client-31.txt`; final client bytes unchanged |
| Contracts | 22 pass, 0 fail/skip | `contracts-22.txt`; final contract bytes unchanged |
| React session controller | 19 pass, 0 fail/skip | `react-19.txt`; final controller bytes unchanged |
| Gateway/harness/lifecycle group | 13 pass, 0 fail/skip | `gateway-harness-lifecycle-13.txt`; includes earlier four lifecycle cases, not an additive total |
| Final stream guard/retry | 4 pass, 0 fail/skip | `stream-client-4.txt`; final client bytes, including repeated offline/hidden failure after `Retry-After` |
| Full API | 243 pass, 0 fail/skip | `api-243.txt`; before late already-dead-entry and ready-backpressure guards; do not label this a full final-head suite |
| Invitation metadata API | 3 pass | `invitation-metadata-api-3.txt`; included in the 243, not additive |
| Final API stream tests with PostgreSQL | 7 pass, 0 fail/skip | `stream-api-7.txt`; final API bytes, includes long-lived stream/notification authorization and backpressure timer regression |
| Final actual-HTTP lifecycle | 4 pass, 0 fail/skip | `stream-lifecycle-4.txt`; final source; overlaps the group above |
| Actual composed unified/WL HTTP | 2 pass, 0 fail/skip | `composed-http-2.txt`; after main composition, before final one-line ready-backpressure guard |
| Root selection and People focused | 15 pass | `root-and-people-15.txt`; included in full web, not additive |
| Frozen dependency install | Pass | `frozen-install.txt`; only direct importer entry added |
| Final changed API/retry/harness static checks | Pass | `stream-api-{typecheck,eslint,format}.txt`, `final-followup-{eslint,format}.txt` |

No totals are summed across overlapping groups. `source-inventory.json` hashes
the final scoped tracked source/test files. `evidence-sha256.json` hashes this
receipt's artifacts. Existing build chunk-size warnings remain. No preview/model
or old physical acceptance claim is upgraded by these checks.

Raw terminal logs preserve their original trailing spaces and blank lines. The
unfiltered evidence diff reports those whitespace diagnostics; authored source,
Markdown and structured artifacts pass the scoped whitespace check. Logs were
not rewritten to make that mechanical check silent.

Initial failed checks are preserved, not silently replaced: network-error
classification had two selection-test failures; one old People mock hung because
the new metadata read awaited a mutation-only deferred response; new catch code
first omitted an error cause required by lint; and the composed foreign-scope
assertion first expected 403 in both modes. The actual White Label domain guard
intentionally returns 404, while unified returns 403. Each was corrected and
the relevant checks passed. Only the hung task-owned test process was terminated.

## Browser acceptance status and required order

WP12/v5 remains evidence on older application `2d0df279`, not this final source:
R11 has 5 passed, 4 failed and 18 unrun cells; R12 has 13 passed, 8 failed and
7 unrun cells. Repeated 57/58 SSE 429 responses blocked useful navigation. Their
raw artifacts and corrected selectors remain immutable. All 88 authored case IDs
remain; discovery is not execution. Producer task-local traces are unavailable in
this checkout. No full browser matrix, trusted HTTPS or physical result exists
for this head.

1. QA pins `00b9f855746a7dd8c8ddfc97991e3a2163fa5ac8`, builds both consumers,
   and starts fresh activated synthetic schemas in ordinary unified HTTP and WL
   HTTP. Run the minimal disconnect reproduction and INACTIVE-011/ROLES-001
   first, recording actual statuses and navigation, before broadening coverage.
2. Resume affected role/inactivity transitions, live invalidation, actual staff
   adoption, explicit new/resume, legacy/manual correction, offline recovery,
   full invitation grants and exact 320px history journeys. Report each run/head
   separately. ALTERNATIVES-007 stays unavailable until it drives the actual
   adoption UI/write; a preseeded or merely read supplement cannot satisfy it.
3. Parent dispatches the WP09 normal-close amendment below. Root binds its
   awaitable local flush to ordinary departures only after the producer return.
4. Merge that owned amendment normally, rerun the close regression and affected
   application flows, then return a new immutable candidate for final QA.

Do not request credentials or bypass TLS to fill unavailable trusted-HTTPS cells.
Unsupported health import formats remain explicitly unsupported; supported JSON
and the adapter boundary are preserved.

## Open producer blocker: normal Close can lose a captured local edit

Read-only browser reproduction against exact WP09 `5a727d67` confirms that the
actual form's `Volver` unmount skips a correction reason queued behind a slow
IndexedDB notes write. Control persists generation 2 and both edits; immediate
Close persists generation 1 and only notes. Reopening a fresh native IndexedDB
store confirms loss; no page error or network synchronization is involved.

See [close-race/README.md](close-race/README.md), its source hashes, actual
interaction harness and result sequence. This deliberately delayed storage test
uses Playwright driver 1.63 with cached Chromium 151 from the existing 1.62
container, sandboxed as nonroot; it is a diagnostic race proof, not the supported
full QA runtime matrix. Failed host/setup attempts are retained separately.

The root wrapper cannot drain the producer's private queue: there is no exposed
flush seam. This remains a producer-owned acceptance blocker, not a reason to
withhold the independently fixed SSE candidate. No duplicate Cloud task has been
created. The [ready-to-dispatch prompt](wp09-close-followup.md) defines owner scope,
root composition boundary and exact required regressions.
