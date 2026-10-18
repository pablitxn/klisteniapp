# Exact browser runtime setup

Scoped runtime setup only. No product, manifests, lockfiles, test source, credentials, sandbox policies, or trust stores changed.

- Driver: `/tmp/b2b-route-browser-setup/driver-playwright-core` (Playwright Core 1.63.0, copied from pre-existing retained exact driver).
- CLI: `/tmp/b2b-route-browser-setup/driver-playwright-core/cli.js`.
- Browser cache: `/tmp/b2b-route-browser-setup/browsers`.
- Chromium executable: `browsers/chromium-1243/chrome-linux64/chrome` (153.0.8010.12).
- Headless shell: `browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell` (153.0.8010.12).
- Existing seccomp: `/workspace/.onboarding/browser-support/seccomp_profile.json`.
- Existing image: `klisteni-browser:1.62.0`, used for OS libraries and Node only. Its built-in Chromium 151 cache is not used.

Reproduce the runtime smoke with:

```bash
/tmp/b2b-route-browser-setup/run-runtime-smoke.sh
```

The runner mounts this directory read-only, sets `PLAYWRIGHT_BROWSERS_PATH=/harness/browsers`, uses pwuser (UID 1001), `--network none`, the existing seccomp, `--security-opt no-new-privileges`, and `--shm-size=1g`. Chromium is launched with `chromiumSandbox: true`. `--enable-automation` permits CDP inspection of launch arguments; no `--no-sandbox` flag is present. No external network is needed after download.

Final runtime smoke completed with exit code 0. `runtime-smoke.log` records exact driver/browser/Node versions, UID 1001, native IndexedDB write/read success, and absence of `--no-sandbox`. The smoke uses native HTTP loopback (which Chromium treats as a secure context); it makes no secure-context, crypto, IndexedDB, network, or trust shims.

This establishes a matching runnable runtime, not product-route acceptance. The root-composed ProductViews/ProductWorkout harness must import this exact driver and use this mounted cache. Avoid bare app-level resolution of `playwright-core`, which previously resolved a different global installation.

Download and setup commands: `setup-command.txt`. Download output: `install.log`. Smoke source: `runtime-smoke.mjs`. Safe docker command: `run-runtime-smoke.sh`.

## Scoped fictitious-domain routing

`run-proxy-diagnostic.sh` completed with exit code 0. `proxy-diagnostic.log` records a sanitized environment summary (proxy credentials/values are not printed), effective Chrome routing arguments, and successful native requests to both loopback and `route-proof.test`. The fictitious domain returned `isSecureContext: false`.

Although the image's declared environment contains no proxy variables, the running container receives HTTP/HTTPS proxy variables. For this local proof only, set both `NO_PROXY` and `no_proxy` to `route-proof.test,127.0.0.1,localhost` on `docker run`. Keep the existing host resolver mapping and domain-specific Chrome proxy bypass. Do not add `--no-proxy-server`. HTTP/HTTPS proxy variables remain present; no host/global environment, Internet proxy, sandbox, credentials, or trust configuration changed.
