# WP09 HTTP content hashing amendment v4

Date: 2026-10-17. Urgent QA blocker response. Source:
`39e026440f1231feea4509b934af0bf8e5130143`; dependency candidate:
`591feb1fd6a29306b5dc08a70ae5335a0ce01422`. Earlier v1–v3 evidence is unchanged.
Durable realm/legacy-choice work remains a separate additive amendment.

## Cause and change

`workoutRequestHash` and `occurrenceWorkoutId` used `crypto.subtle.digest` for
**deterministic content/idempotency hashing**, not credentials, signatures,
encryption, authentication or random generation. SubtleCrypto is unavailable on
QA's fictitious non-trusted HTTP white-label origin. These helpers now use pure
SHA-256 from the existing locked `@noble/hashes` **2.4.0** package, importing
`sha256` from `@noble/hashes/sha2.js` and UTF-8/hex helpers from its `utils.js`.
Their async interfaces, canonical input strings, UTF-8 bytes, lowercase full
request hash and first-40-hex stable occurrence-ID suffix are unchanged.
No dependency implementation was copied into WP09.

`crypto.randomUUID` is also secure-context-only. Owned training ID callers now
use `newWorkoutId`: native `crypto.getRandomValues`, RFC UUIDv4 version/variant
bits and ordinary hex encoding. No Math.random/time fallback exists. Missing
CSPRNG support throws an actionable error; a new record/operation is not faked.
No browser security property, TLS trust, credential/auth crypto or sandbox was
modified. This is not authorization to use real credentials over plain HTTP.

## Exact integrator requests

[Dependency patch](integrator-dependency.patch) adds direct runtime dependency
`"@noble/hashes": "2.4.0"` to `apps/b2b-web/package.json` and the matching
specifier/version under that app's lockfile importer. Package version, integrity
and snapshot already exist transitively in the frozen lock; no package upgrade
or new resolution is needed. This patch was applied **only** in the isolated
validation worktree; shared manifests/lockfile remain untouched in WP09.

[Small root patch](integrator-root-random.patch) imports `newWorkoutId` into
root-owned `ProductWorkout.tsx` and replaces its two workout ID-generator calls.
The root must consume this helper too; WP09 did not edit the root. Existing
account/auth/session cryptography is outside this change. The integrator was
notified on PR21 before claiming the browser reproduction passed.

## Actual checks

Node 24.19.0, pnpm 12.7.0, frozen install against the declared candidate plus only
owned source and the requested direct dependency registration. All seven source
files byte-match the source commit: [inventory](source-files.json).

- **189 composed UI tests pass, zero failures/skips**. New checks include three
  standard SHA-256 vectors; Unicode/emoji/CJK and malformed-surrogate UTF-8;
  binary and million-byte parity against Node and WebCrypto; exact request-envelope
  and occurrence-ID parity; CSPRNG UUID bits and absent-randomness rejection.
- Web typecheck, web lint, boundary checker and B2B build pass: [results](results.json).
- **Actual HTTP browser reproduction passes** using Playwright 1.63.0 / matching
  Chromium 153.0.8010.12 at `http://wp09-http.test` in an isolated internal network.
  Native observations before and after the test: `isSecureContext === false`,
  `crypto.subtle === undefined`, `crypto.randomUUID === undefined`, and
  `getRandomValues` exists. The owned workout form opens and autosaves through the
  real typed client to a tiny synthetic HTTP server. Its independent Node SHA-256
  oracle agrees on UTF-8 payload/hash. A commit-then-dropped-response produces two
  requests with the **same operation ID/body/hash**, one accepted operation and
  no completion. See [browser log](http-browser.log) and preserved probe sources.

The probe runs nonroot pwuser with Chromium sandbox true, an argv guard rejecting
`--no-sandbox`, no-new-privileges, the existing seccomp profile, read-only public
mounts, an internal network and no published ports. DNS maps only the fictitious
probe host to container loopback; NO_PROXY/bypass is limited to that hostname.
The initial environment-proxy routing failure was corrected with this task-local
loopback route. No global proxy setting, TLS/security property or trust was changed.
The browser still reports a native insecure context; no mocks shim its crypto.
Container/network were removed after execution.

This is a deterministic-hashing/editor/HTTP transport reproduction, **not** full
B2B authentication, actual API database, QA matrix, valid-trust HTTPS or release
acceptance. The real root binding and direct dependency registration remain with
INTEGRATION, and QA owns the full actual-app scenario rerun. No skipped or blocked
case was counted as passing. Main remains untouched; no deployment occurred.
