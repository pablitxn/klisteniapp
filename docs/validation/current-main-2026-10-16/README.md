# Current-main role QA - 2026-10-16

This is the follow-up to the seven [role intakes](../../integration/qa-20261013/fichas/)
and the historical integration matrix. Final results are being collected on the
exact main revision below; historical counts are not reused as new passes.

- Application base/tested product revision: `1258642b4543b6acc598d6e72ccf1c50e75b7a67`.
- Test portability fix: `c4fb918498d07b3d7bd43cf0adec8c65983ddb4d`. The final B2B
  runs use this committed test revision; production app/package/asset inputs remain
  identical to main. Earlier B2C and 602-test DB/regression results remain attributed
  to main. Per-run receipts distinguish both revisions.
- Atlas read-only context: `d20e288168ee04177e8864a43c13bd05a864238a`.
- Branch: `qa/current-main-flows-20261016`; both original checkouts were clean.
  Fetch confirmed application main unchanged. Atlas fast-forwarded from
  `ed66d22cd1799e61bd73f9c1e5f12146760b2031`. No discarded changes, worktrees,
  rewritten history, credential or Git identity changes.
- Local synthetic data only: disposable PostgreSQL 17.11, loopback port 54349,
  separate B2C/B2B test databases and fixture UUID schemas/media. SMTP and real
  billing/providers are disabled or injected fakes. Nothing was sent or paid.

See the [structured Atlas intake](../../integration/qa-20261016/intake.md) for the
handoff to existing Atlas gates, including archive/CI and acceptance limits.

## Checkpoint and process continuity

A platform disconnect was reported at 16:14 UTC. In-task execution at 16:21:57 UTC
confirmed that the queue, browser, database and relay remained active and completed
files persisted. No restart or repeat of completed suites was required. Completed
B2C588 and member96 are verified; trainer and the remaining two B2B roles are still
in progress at this documentation checkpoint. [Health receipt](resume-health.json).
Exact role checkout heads are retained in receipts; documentation-only checkpoints
can change HEAD while test source remains pinned to `c4fb918498d07b3d7bd43cf0adec8c65983ddb4d`.

A later durability checkpoint records six completed roles / 1056 unique passes;
full brand-administrator coverage is still pending at that dated snapshot. See
[completed-role checkpoint](completed-role-checkpoint.json). This does not claim
full B2B acceptance before the last role report exists.

## Environment and method

Node 24.19.0, pnpm 12.7.0, app-locked Playwright 1.63.0. The browser server also
uses that exact locked package. The cached `klisteni-browser:1.62.0` image supplies
Ubuntu 24.04 system libraries only; its separate Playwright 1.62 smoke harness is
not used for this matrix. Exact browsers: Chromium 153.0.8010.12 (revision 1243)
and WebKit 26.6 (revision 2359, Ubuntu build). Both run as UID 1000 in a task-owned
container; Chromium sandbox is explicitly enabled, official seccomp and
no-new-privileges retained. Process evidence found seven Chromium processes,
all nonroot and none with `--no-sandbox`.

The initial cached WebKit build targets Debian and cannot launch in the Ubuntu
container. Both initial visitor runs retain 54 launch failures each, alongside
54 Chromium passes each. A separate Ubuntu browser cache fixes that environment
mismatch without replacing the cached Debian build, application dependencies or
security configuration. A rejected platform-override spelling and a no-tests
smoke selection are also retained as setup attempts; neither is product coverage. Four initial B2B attempts also failed before test
discovery because the external wrapper directory lacked `type: module`; an
external package declaration fixes that setup without changing the app config.
Changing that declaration while the first demo WebKit retry was active caused
two worker-load failures and 34 unexecuted cases after 18 passes. That attempt is
retained. Setup is then frozen and the entire demo WebKit matrix is repeated;
the passing earlier 18 are duplicates, not new flow coverage. Member discovery
confirmed 96 definitions after the module correction; discovery is not execution.

The external configuration wrappers preserve the existing server commands,
fixture data and assertions. Two export checks receive the separately committed
portable stream-read correction described below. They set absolute artifact/server paths,
request sandboxed Chromium, select the matching WebKit executable and connect to
a loopback browser server. Playwright's `<loopback>` tunnel reaches only local
fixtures. B2B keeps the restricted fictional-origin proxies and existing UUID
shim; HTTP does not become a secure context. Browser runs are serial. The first member run then records 96 proxy-routing
failures: explicit proxy loopback addresses resolved inside the remote container.
No app flow was reached in those failures. A task-owned internal Docker bridge
and fixed-destination TCP relay make the same six restricted loopback proxies
reachable from the browser. The browser has no published ports on that internal
network; the host connects to its private WebSocket address. The relay permits
only the browser IP and host gateway IP (needed by `route.fetch`), forwarding
only the six existing fixture proxy ports. App proxy host/protocol/port guards
remain unchanged. A targeted QR/login probe passes before full reruns. The failed
member attempt and successful probe remain distinct, without inflating coverage.

The B2B brand-administrator wrapper additionally runs WebKit at 430x932 and
1440x1000, using the fixture server's existing fifth and sixth proxy/schema
slots. The original four profiles retain their dimensions. These are additional
coverage relative to main's four-profile admin configuration, not a product fix.
Inherited specs may intentionally resize a second device; project dimensions
identify the initial viewport, not every screen inside a journey.

## Initial viewport matrix

| Role | Narrow mobile | Wide mobile | Desktop | Engines |
| --- | --- | --- | --- | --- |
| B2C self-service | 360x800, DPR 2 | 430x932, DPR 2 | 1440x1000 | Chromium/WebKit |
| B2C administrator | 360x780 | 430x932 | 1440x1000 | Chromium/WebKit |
| B2C visitor / B2B member | 320x740 | 430x932 | 1440x1000 | Chromium/WebKit |
| B2B trainer / anonymous | 360x800 | 430x932 | 1440x1000 | Chromium/WebKit |
| B2B brand administrator, Chromium | 320x740 | 412x915 | 1440x1000 | Chromium |
| B2B brand administrator, WebKit | 390x844 | 430x932 (added) | 1440x1000 (added) | WebKit |

Mobile projects enable touch/mobile emulation; desktop projects do not. B2B uses
`es-AR` and UTC; B2C also tests explicit account timezones and second-device
contexts. All new flow runs use HTTP loopback. Viewport/touch emulation does not
establish physical-device acceptance.

## Coverage boundaries

The seven source intakes select these journeys:

| Role | Selected coverage |
| --- | --- |
| B2C self-service | Activation/recovery/login, session/account isolation, plan/routine/timezone persistence, strength/cardio/Yoga, health/import/export, expired/paid fixture entitlements, pre/post-commit loss and exact replay |
| B2C administrator | User search/roles, trial/lifetime limits, personal/shareable invitations, revoke/reissue/expiry, double-click guards, late-link hiding, account/session changes |
| B2C visitor | Separate demo/instance local storage, empty states, preferences, routine/strength/cardio/Yoga/health, cancellation, corrupt/quota recovery, durable deletion, import/export and absence of anonymous API writes |
| B2B member | Invitation consent for existing identities, branch QR/context, prescriptions/alternatives/drafts, timed and set-based execution, partial/global history, branch progress, lost responses and brand/account isolation |
| B2B trainer | Authorized routes/branch grants, routine versions, alternatives, assignments, stable replay identity, monitoring, late ACKs, conflicts and revoked permissions |
| B2B anonymous | Two brands/four branches, published/hidden/archived website/catalog/contact/media, QR/login/return context, retries and protected routes |
| B2B brand administrator | Brand roster and branch coaching, slug conflicts, theme/branch drafts and comparison, invitations, batches/QR, publication/media, programs/assignments and ACK-bound navigation |

Self-service includes 120 simulated-transport UI contract combinations in the
six-profile matrix (`health`, `yoga-account`, `account-access`, `forgot-password`).
Real API/PostgreSQL journeys supplement those contracts; the method stays explicit
per case. Visitor storage is local by design. No simulated payment return is
claimed as a paid transaction, and no generic recovery confirmation proves mail.

## Reproduced test defect and correction

The first connected member run reached the app but failed its two executed
history-export checks: `download.path()` requires a browser-local filesystem and
is unsupported with a remote browser. The same assumption exists in the
brand-administrator export check. The member queue was stopped before editing:
21 cases passed, two export checks failed, one case was deliberately interrupted
and 72 cases did not run. All are retained separately from product failures.

Commit `c4fb918498d07b3d7bd43cf0adec8c65983ddb4d` reads complete downloads through
`createReadStream()` and Node's JSON stream consumer in those two specs. Existing
filename, record-count and branch-identity assertions remain. This supports both
local and remote browsers; it changes no app/API behavior, fixtures or entitlement.
The four targeted Chromium/WebKit member/admin export regressions pass. Lint,
types and build are repeated on this test revision before the full B2B matrix.
The earlier formatting/type iteration was corrected before this commit; no
failing test assertion was removed or weakened.

## Yoga provenance

`pnpm previews:check` passes exercise 74 and body 24, then fails closed on Yoga's
stale extraction receipt. This is reproduced on unchanged current-main inputs.
The audit verifies the original source commit, 23 source-proof mappings, original
renderer dependency records, manifest entries and all 128 WebP byte/hash records.

The manifest mixes 47 retained entries (all exactly matching the extraction
receipt) and 17 later entries at the relocation source hash. All 128 image and
animation files match their manifest. The manifest as a whole differs from the
old all-original receipt because of those later captures; that alone is not
corruption. The current source inventory differs from the extraction inventory in
`pnpm-lock.yaml`, `generate-yoga-previews.mjs`, `preview-browser.mjs` and
`preview-capture-state.mjs`. The capture script no longer normalizes to the finite
mechanical extraction proof, while the other 22 source mappings and original
renderer dependencies match. The existing gate therefore remains failed.

No new captures, regenerated hashes, edited receipts, model changes or relaxed
checks were used. A separately reviewed provenance/capture task must establish
acceptance for the retained/new mixture. Full `check`, `check:all` and
`check:release` are not claimed passing. GPU, model/Blender and visual-content
acceptance remain deferred.

## Archive and CI limits

All seven paths in the historical [archive manifest](../../integration/qa-20261013/archives.json)
are absent from this workspace and its shared/scratch mounts. Their expected byte
counts and SHA-256 values are retained in the gap receipt, with `missing` status.
There is no verified retrieval, new hash match or durable archive receipt for those
files. Fresh QA evidence cannot reconstruct the historical failed attempts.

GitHub reads for tested main returned no combined statuses and no PR-triggered
workflow runs on the connector's first page. This is absence of evidence, not
passing CI or proof that all check-runs are absent. CLI `gh auth status` reported
an invalid provisioned token; it was not replaced. Connected GitHub tools supply
PR/status publication and reads. The repository has GitLab pipeline configuration,
but current GitLab jobs were not queried or triggered. Historical pipeline 1252's
Yoga failure remains historical. No CI, branch-protection or security setting was
changed.

## Skipped and untested acceptance

Record browser test skips separately in the case receipt. The following are
**untested scope**, not successful cases: valid-trust local HTTPS and production
Secure-cookie semantics, physical Safari/iOS/Android, camera/printed QR, physical
touch/keyboard/audio/voice, external OAuth/health providers, real SMTP/inbox,
payment/subscription execution, production/infrastructure, scale beyond existing
list limits and GPU/model/Blender/content acceptance. Role suites deliberately
exercise fallbacks and may abort GLBs; visible loading/fallback captures do not
prove 3D rendering. No production data, real messages or payments were used.
