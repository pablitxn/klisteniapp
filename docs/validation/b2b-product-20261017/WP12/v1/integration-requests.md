# WP12 requests to CONTRACT / INTEGRATION

Date: 2026-10-17. Preparation base `d65261d18de4522fb9a66104aabb5750104fb8b8`.
Plan `447d77ebb5587e319018e7b56003f0ef7299bb6c`. No shared files are changed here.

## Contract and seed binding

1. CONTRACT returns its accepted immutable WP00 SHA, ADR, negotiated identity and
   v1/v2 route envelopes, operation/CAS receipts, effective-segment and per-side
   fixtures, week/period impact fixtures, health consent generations and export
   manifest. QA will consume those exact interfaces, never infer replacements.
2. INTEGRATION registers a product seed adapter in its shared harness startup.
   Input is `buildTopology(runKey)` from the isolated fixture directory; output
   maps logical brand/branch/actor keys to actual server IDs in a task-local
   fixture map. Include baseline legacy publication/assignment/execution/audit/media
   snapshots for upgrade tests, plus v2 resources from CONTRACT's accepted fixtures.
   Legacy admins must be seeded before migration; new admins after migration.
3. Retain dedicated loopback b2b/test DB checks, randomized per-project schemas,
   task-owned media/builds, teardown on partial startup and rejected unsafe URLs.
   Preserve `seedWhiteLabelDemo`'s two brands/four branches. Its current demo
   membership/assignment defaults do not implement the additional role/race cases.
   A cover coach must have a branch grant and no coach-student assignment. Mixed
   role and dual-brand inactive/active actors require explicit matching grants.

## Exact config registration request

Create product-specific configs (or equivalent explicitly returned owner paths):

- `apps/b2c-web/playwright.b2b-product-unified.config.ts`: unified HTTP harness,
  `testMatch: 'b2b-product-*.spec.ts'`.
- `apps/b2c-web/playwright.b2b-product-wl-http.config.ts`: existing isolated HTTP
  integration harness and restricted fictitious-host proxies; same testMatch.
- `apps/b2c-web/playwright.b2b-product-wl-https.config.ts`: valid-trust HTTPS and
  Secure-cookie acceptance; same testMatch, no certificate bypass/trust changes.

Each config must register six isolated engine/viewport projects: Chromium and
WebKit at 320x740 and 430x932 (`isMobile: true`, `hasTouch: true`) and 1440x1000
desktop. Use `workers: 1`, `fullyParallel: false`, `retries: 0`, trace retained on
failure, and per-project schema/API/media/origin or proxy isolation. Include
truthful `metadata.b2bProduct = {mode, engine, width, height, touch}` using the
mode names in `scenarios.json`, for exact report/discovery validation.

The unified baseline already matches `b2b*.spec.ts`; it needs exact six-project
coverage rather than extra testMatch registration. Member QA matches only
`member-qa.spec.ts`; trainer matches only `b2b-trainer.spec.ts`; WL matches
`white-label*.spec.ts`; integration HTTP has a fixed role-to-testMatch map.
None currently registers a product-specific WL flow. Trainer narrow widths are
360/390, and its WebKit projects lack wide/desktop. New QA specs stay exclusively
with WP12; feature workers own unit/API tests.

Do not inherit the baseline WL `--ignore-certificate-errors-spki-list` argument.
Member QA filters it; raw WL does not. Keep `ignoreHTTPSErrors: false`. Existing
HTTP integration proves functional behavior only. Valid-trust HTTPS remains a
separate blocked gate unless existing provisioned trust can pass unchanged.

## Runtime request and supported safe path

The requested `/workspace/shared/browser-support/README.md` does not exist in
this task. Current startup instructions and supported helpers are at
`/workspace/.onboarding/browser-support/start.md`; the authoritative local report
is its `REPORT.md`. Both engines freshly passed its cached-image local smoke.

The app is locked to Playwright 1.63.0, Chromium revision 1243 (153.0.8010.12) and
WebKit revision 2359 (26.6). The supported smoke image is 1.62.0, Chromium 1234
(151.0.7922.34), WebKit 2336 (26.5). Native cache contains WebKit 2359 but no
matching Chromium; cache presence does not establish a supported native launch.
Do not substitute the 1.62 smoke harness into the 1.63 full matrix.

Safe proposed fix before final acceptance: have the environment/integration
owner prepare a task-scoped matching locked 1.63 image/runtime using the reviewed
nonroot, Chromium sandbox, official seccomp and no-new-privileges pattern, cached
before acceptance and run sequentially. Keep existing helper files untouched.
Provide a full-stack test transport confined to the task's synthetic harness;
the current local-smoke relay intentionally supports GET/HEAD only, and cannot
prove authenticated POST flows. Prefer the full harness inside the isolated test
environment over broadening host/network privileges. No host networking,
privileged container, sandbox bypass, credential mount or TLS exception is a fix.

## Resume input

Parent returns the exact accepted combined dependency head and WP00-WP11/WP13
input SHAs, registered seed/config paths, supported app runtime, and whether
trusted HTTPS can run unchanged. QA then binds the reserved scenario IDs to
executable specs and performs final feature acceptance. No elapsed time or
unaccepted moving branch substitutes for that receipt.
