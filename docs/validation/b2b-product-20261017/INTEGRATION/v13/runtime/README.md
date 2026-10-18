# Exact native runtime for integration v13

Prepared exact installed Playwright Core1.63.0 driver and matching Chromium1243/WebKit2359 caches. Smoke passed both engines at320/1440 with real native IndexedDB. See runtime-proof.json and smoke.log. This is runtime readiness, not product acceptance.

Host root: /tmp/b2b-integration-v13/browser-runtime
Driver: driver-playwright-core/index.mjs
Browser cache: browsers/
Mount the root readonly as /runtime, import /runtime/driver-playwright-core/index.mjs, set PLAYWRIGHT_BROWSERS_PATH=/runtime/browsers for either engine.

Run the retained proof:

```sh
bash /tmp/b2b-integration-v13/browser-runtime/run-smoke.sh
```

That command uses cached image klisteni-browser:1.62.0 only for Ubuntu24 OS libraries/Node24.18, original seccomp, pwuser UID1001, no-new-privileges, networknone,1GiB shared memory, readonly runtime. Chromium launch uses chromiumSandbox:true; CDP verifies --no-sandbox absent. No TLS exception or trust mutation. Container is automatically removed. Use the same isolation when mounting an actual component bundle in an additional readonly /harness mount.

Native loopback http://127.0.0.1 is classified secure by the browsers. Networknone makes navigator.onLine false; this proof supports narrow component/layout execution and cannot establish online/offline/reconnect behavior. The old image's built-in browsers are unused. Playwright type.executablePath reports the full Chrome path; default headless Chromium launch uses the matching headless-shell1243 cache, with both executable hashes recorded.

Preparation commands (already executed; no repetition needed):

```sh
cp -a /workspace/klisteniapp/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core /tmp/b2b-integration-v13/browser-runtime/driver-playwright-core
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 PLAYWRIGHT_BROWSERS_PATH=/tmp/b2b-integration-v13/browser-runtime/browsers node /tmp/b2b-integration-v13/browser-runtime/driver-playwright-core/cli.js install chromium webkit
chmod -R a+rX /tmp/b2b-integration-v13/browser-runtime/driver-playwright-core /tmp/b2b-integration-v13/browser-runtime/browsers
```

Download used the exact CLI's official artifact URLs with ordinary TLS validation. Host dependency warning in install.log is expected for host Linux; no host OS dependencies were installed. Downloaded WebKit README confirms Ubuntu24.04.4LTS, unlike the retained onboarding Debian13 artifact. No host cache was reused or modified.

Host Node24.19, pnpm12.7 available after source /workspace/.onboarding/activate.sh. Default unsourced PATH exposes pnpm11.25; source activation before static commands. Installed TS6.0.3/Turbo2.11.3/Vite8.3.1/React19.3/@noble/hashes2.4 are available. Relevant static tests can use node --test apps/b2b-web/tests/programmingComponents.test.ts apps/b2b-web/tests/goalProgramDraft.test.ts; parent owns running tests against the composed head. Existing stopped integration PostgreSQL volume/55441 was not changed.
