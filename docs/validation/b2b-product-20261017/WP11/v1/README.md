# WP11 restricted membership UI receipt v1

Date: 2026-10-17. Status: **owned modules ready; shared composition and final QA
acceptance pending**. Parent retains dispatch, monitoring and main-merge decisions.

| Input | Immutable revision |
| --- | --- |
| Plan | `447d77ebb5587e319018e7b56003f0ef7299bb6c` |
| Foundation | `0b611064a91b87b3a17274cabca5415bcf1d7d55` |
| Exact branch base / WP06 PR24 | `fd138190e18ba84dcf47c1fc81ad535d051d8ff4` |
| Atlas consulted (read only) | `ce45d206a2ed4035f8003a3303abd1fff98e09b8` |
| WP09 adapter read, not merged | `3217cadb9148d0772b3bc68bd0abc0a64bb85140` |
| Tested implementation / harness | `35b63a0536242515920aeae80fca8e58bdaab12e` |
| Read-only integration checkpoints | `4954accaf0e4a0c88f8179b949886b1fcece8fa7`, then `31eb421064c215463d2999777520164c52845ddc` |

Branch `feat/b2b-inactive-member-ui-v1` starts at the exact assigned producer base.
The source commit changes nine owned membership/test files only; see
[source-files.json](source-files.json). Subsequent receipt commit adds only this
immutable evidence. No shared path, API/store implementation, schema, DTO,
migration, manifest, lockfile, export barrel, session provider or route is edited.
Both repositories' AGENTS, actual Atlas navigation skill, product source/minutes,
A00-A08, plan C01-C08, complete WP11 prompt, ADR, frozen schemas/inventory, actual
foundation SQL and WP06/WP09 owner handoffs were read. No additional worker or
Cloud task was dispatched. Model/effort/service controls for this existing turn
are not exposed; no substitution or new dispatch is claimed.

## Delivered behavior

- A fail-closed matching-identity access boundary and restricted screen with own
  server export, truthful version/inclusions/omissions disclosure, progress,
  error and retry. Inactive children never render; pending/foreign/malformed
  access hides protected children. Current access refresh delegates to the owner
  and never creates grants/consent or converts accounts.
- A separate paid B2C invitation lookup on user action. Safe configured external
  HTTPS link, no credentials/query/fragment, no-referrer/no-opener; no conversion,
  billing, transfer or cross-product request from the component. Null config is
  explicit. A normal external click is navigation, not an application API action.
- A lossless pure interchange archive adapter with strict-version/field rejection
  and nested owner/tenant/branch checks. Entire original data survives, including
  legacy revision zero, all accepted corrections and period/schedule revisions,
  historical branches, ranges, units, additional target segments and provenance.
  Schema transforms do not normalize historical strings. Unsupported B2C import
  fields remain in the archive; no flattened B2C store import is claimed.
- Optional injected WP09 recovery consumes its exact published string/null return
  without importing storage internals. It checks current access/cancellation and
  published envelope identity, then downloads unchanged local bytes separately.
  The UI labels one selected unsynchronized device copy and provides empty/error
  states. Actual provider/store binding remains with INTEGRATION.

## Actual validation

Host Node **24.19.0**, pnpm **12.7.0**; frozen-lockfile install succeeds and the
tracked dependency files remain unchanged. Disposable PostgreSQL **17.11**, image
`sha256:79bd7c99e923138f136f8009d6bffa66e21e9d4fda5c0c561b00fc9c90cfe537`,
local `klisteni_b2b_test`, task-only container/loopback port, synthetic identities.
No persistent development database or private environment file was used.

| Check | Actual result |
| --- | --- |
| New `restrictedAccess.test.ts` + `trainingInterchange.test.ts` | 11 pass, 0 fail/skip/cancel |
| Entire B2B web unit suite | 73 pass, 0 fail/skip/cancel (includes the 11 above) |
| Frozen contracts / domain unit suites | 22 / 22 pass, 0 fail/skip/cancel |
| B2C web unit regression | 204 pass, 0 fail/skip/cancel |
| Full B2B API on ready disposable PostgreSQL | 188 pass, 0 fail/skip/cancel |
| Root typecheck | 14/14 tasks pass |
| Root lint, boundary and format check | Pass |
| B2B build | Pass; existing large-chunk warning remains |
| Git diff, effective identity, source commit text and prepared PR text | Pass; see logs and reproduction |
| Atlas instruction/content allowlist | 176 checked; read-only Atlas check, not a language audit of application files |
| Isolated owned component Chromium 153 / Playwright 1.63 | 3 viewport cases pass, 42 named check groups, 0 fail/skip |
| Isolated owned component WebKit | Blocked at runtime launch; 0 cases executed, 3 viewport cases unexecuted |
| Full composed inactive HTTP/browser matrix | Unexecuted; eight exact QA scenario groups in owner requests |

Logs are under [logs](logs/). Source production/test bytes were unchanged during
successful final checks. Typecheck/lint use ordinary frozen workspace resolution;
there are no dependency overrides. The API run covers existing producer behavior,
including WP06's 15 cases, migrations/repeat/compatibility/races; this branch adds
no API tests. It does not prove missing HTTP bindings work.

## Browser and accessibility limits

[chromium.json](chromium.json) records 320x740, 430x932 touch and 1440x1000 desktop.
The [owned probe](reproduction/owned-ui-probe.mjs) exercises this branch's real
React component with synthetic injected callbacks, not application auth/routes.
Checks include no request on render, main/heading/button semantics, keyboard focus,
44px control minimum, 320px overflow, export progress/error/retry and decoded
JSON, configured/unconfigured invitation, referrer/opener attributes, normal
external-link navigation intercepted locally, unchanged cookies/no mutation calls,
reactivation/restriction/foreign identity hiding, and separate WP09-shaped recovery.
Pure tests also cover late-response cancellation and local null/foreign/cancel
states. [Screenshots](screenshots/) at all three widths were captured; mobile and
desktop were visually inspected. The harness includes owned CSS only, so final
branded/global CSS still needs QA inspection.

Exact frozen **Playwright 1.63.0**, Chromium **153.0.8010.12** and WebKit downloads
were acquired through the official installer under `/tmp/wp11-runtime`, without
changing dependencies. The exact official 1.63 image pull failed with Forbidden
on blobs, although its index/amd64 manifests were readable. Chromium ran using
the retained official Noble **1.62 OS image**
`sha256:50cbb76d250a50002045a95f484c5f40573cde831adbe40c784052c037e36118`,
with the exact 1.63 package/binaries mounted read-only. This is an explicit runtime
composition, not an assertion that the old helper's 1.62 browser passed. Container
Node is 24.18.0. Browser runs as pwuser UID1001, network none, no-new-privileges,
default Docker capability bounding set and official seccomp profile hash
`cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849`;
Chromium launches with `chromiumSandbox:true`. No `--no-sandbox`, TLS exception,
trust change or external provider is used. Normal invitation navigation is
fulfilled inside the network-isolated test; no external site receives it.

WebKit 1.63 fails dependency validation in that older OS image. Its launch log and
image-pull failure are retained. It was not replaced with cached 1.62 WebKit and
no dependency validation was bypassed. Parent/QA's matching 1.63 image remains the
appropriate final matrix environment. These component results do not certify
real cookies/authentication, HTTPS, Secure-cookie, Safari/iOS or physical devices.

## Iteration failures and resolved setup

The first offline install lacked pnpm metadata; ordinary online frozen install
succeeded without lockfile edits. Initial test Vite options were corrected for
Vite 8. The first API attempt used an internal-container IP/name incompatible with
the existing health-fixture guard; it was stopped. The next run raced initial DB
startup and ended 184 pass / 4 cancelled / 0 skips (ECONNRESET). After explicit
`pg_isready`, the complete final run passes all 188 with zero skips/cancellations.
No test case or guard was disabled to obtain that result.

Component harness iterations corrected missing production-mode definition in
library bundling, UTF-8 page metadata and public temporary-file readability before
the final Chromium pass. These were harness setup issues; failed attempts do not
count as passes. One test-harness unused parameter lint error was corrected before
final lint/typecheck. The first commit-check invocation targeted the Atlas helper's
own repository and failed on the app base; the final check explicitly supplies the
application root to the helper's unchanged commits function. The helper's regular
176-file content check applies only to Atlas. `gh` API requests were forbidden;
the authorized GitHub connector handles PR metadata/publication instead.

## Integration gates and preservation

Exact [owner requests](owner-requests.md) cover root gate/provider freshness,
WP06 HTTP/session binding, frozen client's missing `/self` prefix, WP09 current
scope/session injection, optional CONTRACT-selected pure shared promotion, and
QA-only browser scenarios. The client prefix issue is present in both the assigned
base and read-only integration checkpoints 4954acc/31eb421; no raw-fetch workaround was added.

No browser acceptance of deep-link/back/stale provider, real offline replay,
multiple-membership cookies, consent restoration or actual WP09 store is claimed.
No unsupported B2C field is silently imported; full paid onboarding is outside the
batch. No production activation/deployment, real health/user data, provider/paid
call, credentials/security change, force push or application-main merge occurred.
Legacy snapshots/log IDs and historical evidence remain unchanged. Yoga/preview,
physical/Blender/provider/backup/release gates retain their existing owners; full
build/check:all were not claimed. This v1 evidence freezes at publication; any
future correction requires a successor receipt.
