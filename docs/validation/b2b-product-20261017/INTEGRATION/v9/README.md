# Integration v9: durable workout departure on the actual route

Immutable executable candidate: `7dcf45753591da83ee0bfbde2e2c50dca218ff9b`, on
`integrate/b2b-product-v1`, draft [PR21](https://github.com/pablitxn/klisteniapp/pull/21).
This receipt is a later evidence-only commit. Source hashes are in
`source-inventory.json`; artifact hashes are in `evidence-sha256.json`.

Main remains `d65261d18de4522fb9a66104aabb5750104fb8b8`. Consulted Atlas remains
clean at `ce45d206a2ed4035f8003a3303abd1fff98e09b8`. No main merge, production
activation/migration/deployment, paid service, credential change, real-user data,
external health access, trust change, quota increase or history rewrite occurred.
Parent retains Cloud dispatch and final acceptance. Local agents reviewed source
and prepared the isolated browser runtime; root owns the implementation below.
Earlier milestone and evidence versions, including the failing v8 Close proof,
remain intact.

## Exact inputs and implementation

WP09 [PR26](https://github.com/pablitxn/klisteniapp/pull/26) input
`fb9954a3b299d1edb7a64f5d1ae9a02359077f7f`, implementation
`0a85a8d1d0f2cf8a99937ceec1187cb846b30f0d`, was merged normally at
`8864a59bcf495b2fd43db2dedd8592e3e5a8537a`. All four producer-owned source/test
files exactly match its published SHA-256 inventory; all 31 WP09/v7 evidence
manifest entries match. See `producer-verification.json` and the frozen
[producer receipt](../../WP09/v7/README.md).

Other normal-merge inputs remain the v8 owners: WP07 PR29 `59d195de`, WP01 PR30
`a4636288`, WP08 PR25 `f96db71d`, and WP12 PR31 `baa8e5a1`. The SSE repair at
`00b9f855746a7dd8c8ddfc97991e3a2163fa5ac8` remains unchanged. API, shared contracts,
client, schema, dependency manifests/lockfile and stream quota policy have no
changes in this amendment.

[Amendment 011](../../../../contracts/b2b-product-v2/amendments/011-local-workout-departure.md)
binds the producer's awaitable local flush through the actual
`ProductViews → ProductWorkoutHistory → SelectedWorkout → ProductTrainingSession`
composition. The central accepted-location store guards section navigation,
shell/delegated links and native Back/Forward. It keeps the editor mounted until
captured edits and the durable selected-workout pointer succeed. Failed native
navigation restores the original indexed entry; explicit retry and export remain
available with captured values. Concurrent CAS conflicts never overwrite another
writer's actuals. Failed intent is not silently replayed later.

Repeated clicks coalesce, stale editor registration and authority lifetimes are
fenced, and same-view resets remount after successful flush. No-op and native hash
navigation leave the editor live. Native fragment entries receive correct indices
when Chromium supplies null or cloned state. Invitation token scrubbing uses an
explicit router replacement for both query and fragment tokens, preserving the
index and successful acceptance UI. Offline revalidation flushes and remounts the
complete selected-workout loader before another editable form can appear.

Logout, realm/account/organization/branch/role replacement and revocation still
invalidate immediately; they never await local flush. Network synchronization,
local persistence and explicit workout completion remain separate. Partial
records stay partial, the original binding stays intact, and departure creates
no completion or sync operation.

## Final validation

All data and invitation responses are synthetic and local. The browser harness
imports the actual root views, router, shared Shell, delegated App link helper,
Invitation, workout form and native IndexedDB store. Only typed read transport,
context authority and deliberate local-write delays/failures are test fixtures.
It does not mount the complete authenticated ApplicationProvider or establish
live authorization. The separate composed HTTP tests use actual built consumers,
password admission, bootstrap/access, SSE, planning/adaptation writes, metadata,
history and export-only access in isolated synthetic PostgreSQL schemas.

| Check | Result | Evidence and qualification |
| --- | --- | --- |
| Full B2B web | 299 pass, 0 fail/skip | `web-299.txt`; final source |
| Permanent navigation controller | 8 pass, 0 fail/skip | `navigation-8.txt`; included in 299, not additive |
| Root typecheck | 14/14 tasks | `root-typecheck.txt`; final source, normal unchanged-task cache reuse |
| Root lint, boundaries and formatting | 14/14 tasks | `root-lint.txt`; final source |
| Root build, both consumers | 16/16 tasks | `root-build.txt`; final source |
| Native composed route | 21 cases, no page errors | `native-route/native-fragment-replace.log`, `native-results.json`; final source |
| Composed unified/WL HTTP | 2 pass, 0 fail/skip | `composed-http-2.txt`; both final built consumers |
| Actual-HTTP SSE lifecycle | 4 pass, 0 fail/skip | `stream-lifecycle-4.txt`; current unchanged source |
| Stream client guard/retry | 4 pass, 0 fail/skip | `stream-client-4.txt`; included in full web; unchanged source |
| Producer integrity | Four source hashes and 31 evidence hashes match | `producer-verification.json` |

No overlapping totals are added. The full API 243, client 31, contracts 22 and
React 19 results remain the separately qualified v8 runs; they were not rerun or
relabeled as a full final-head suite here. Existing build chunk-size warnings,
the prior Yoga preview failure and deferred model/Blender/physical acceptance
remain unchanged. No preview or physical gate was rerun or promoted.

## Native browser cases

Final exact runtime: Playwright Core **1.63.0**, Chromium **153.0.8010.12**,
sandbox enabled, nonroot UID 1001. Tests use a native insecure HTTP fictitious
domain (`isSecureContext === false`) and native IndexedDB. No crypto, storage,
secure-context, authentication or certificate-trust shim is installed.

The 21 cases cover:

1. Section departure at 320px and 1440px, explicit same-view reset, shell brand,
   delegated public link, native Back at 320px and Forward at 1440px (seven cases).
2. Native hash/no-op actions keep the editor editable; hash Back preserves its
   index; rapid native Back/Forward shares one flush and accepts the latest target
   (two cases).
3. Local quota failures during section, Back and Forward preserve captured values,
   export and history entries; explicit retry saves them (three cases).
4. A slow durable selection blocks departure; failed selection permits explicit
   retry; a CAS conflict preserves the other writer's actuals and stays on the
   current editor (three cases).
5. Context revocation during section and Back hides private UI immediately and
   prevents held/queued stale writes or navigation (two cases).
6. Offline-to-online revalidation drains captured edits and remounts a live form;
   a failed revalidation can close with all captured edits preserved (two cases).
7. Actual invitation acceptance with query and fragment tokens removes the token,
   synchronizes the accepted route, preserves the index and success UI, then
   survives a failed two-entry Back traversal with all history entries intact
   (two cases, synthetic acceptance endpoint).

Fresh native store reads verify both queued edits, generation 2, unchanged
`partial` status, `explicitCompletion: false`, unchanged revision-zero original
notes, and zero added synchronization/completion operations. Successful departures
occur after the durable pointer. The transport's access promise deliberately
never settles if background synchronization asks; local departure still finishes.
Revocation cases prove generation zero remains after releasing the held write.

## Reproduction and retained failures

See `commands.md`, `native-route/{probe.tsx,build.mjs,run.mjs,run.sh}` and
`runtime/README.md`. Build the harness against the immutable candidate. The Docker
image `klisteni-browser:1.62.0` supplies OS libraries/Node only: its built-in older
browser is not used. The exact 1.63 driver and revision-1243 Chromium cache are
mounted read-only from the scoped `/tmp` runtime. Docker uses no external network,
existing seccomp, no-new-privileges and nonroot sandboxing. Public fixture bundle
files alone receive read permissions for the nonroot runner. No global permissions
are changed. Generated bundles/browser caches are omitted; final bundle and browser executable
hashes are recorded in `native-build-inventory.json`.

The environment injects proxy variables into containers. Domain-specific
`NO_PROXY`/`no_proxy` for `route-proof.test,127.0.0.1,localhost` and a loopback host
mapping make the fictitious local origin reachable; the proxy variables stay set.
No global proxy, sandbox or trust setting changes. A failed diagnostic with
`--no-proxy-server` is retained but is not used in successful evidence.

Retained setup/validation failures are labeled separately:

- The initial Node-only test used constructor parameter-property syntax unsupported
  by Node's strip-only loader. Explicit private-field assignment fixed it.
- An unactivated fallback pnpm attempted to use an unavailable home cache and failed
  before checks. Sourcing the existing onboarding activation selects installed
  pnpm 12.7.0; subsequent checks pass without dependency or lockfile changes.
- Initial native runs failed on scoped fixture permissions and fictitious-domain
  proxy routing. Runtime smoke and the final exact command document their fixes.
- The first reached browser assertion incorrectly expected `draft`; actual saved
  partial records correctly remain `partial`. The original runner is preserved.
- Native hash navigation exposed Chromium's null history state. The routing fix
  indexes that new entry. A rebuild again produced unreadable fixture files; the
  final build script grants read access only to its public output.
- The initial 20-case pass covered query-token acceptance only. Read-only review
  found fragment-token scrubbing was incorrectly inferred as a new history entry.
  The explicit router replacement and two token variants with failed multi-step
  Back are covered by the final 21-case run. `before-fragment-*` logs and
  `native-complete.log` remain evidence of the earlier, narrower revision.

Raw stdout is preserved, including terminal trailing whitespace. Authored code,
Markdown and structured artifacts pass the scoped whitespace check; raw logs are
not rewritten to silence mechanical diagnostics.

## QA handoff and remaining gates

QA should pin `7dcf45753591da83ee0bfbde2e2c50dca218ff9b`, build both consumers, and use fresh,
activated synthetic schemas. Start with the minimal disconnect reproduction plus
INACTIVE-011/ROLES-001, then exercise actual authenticated new/resume/correction,
normal Close and all ordinary departures with slow local persistence, revocation,
offline revalidation, invitations with query/fragment tokens, history at 320px and
staff adoption. Verify both values after reopening storage and do not infer
completion from local-save or sync success. A true local failure must keep values
available for explicit retry/export.

The independently reproduced normal-Close loss and root route binding blockers
are resolved by this candidate's local evidence. Full WP12 browser/authenticated
matrix acceptance is still pending, including unified/WL modes, additional
engines/viewports, trusted HTTPS and physical acceptance. Older R11/R12 failures
remain separately versioned; all 88 authored IDs remain, and discovery is not
execution. ALTERNATIVES-007 must perform the actual adoption UI/write rather than
read a preseeded supplement. Do not bypass TLS or request credentials to fill an
unavailable cell. Supported JSON and the health adapter boundary remain; other
formats are honestly unsupported.

An asynchronous SPA gate does not guarantee persistence across hard browser/tab
closure, process death or power loss. This amendment adds no offline cold-start
authorization or service worker. Parent retains the final acceptance and merge
decision; PR21 stays draft and main is unchanged.
