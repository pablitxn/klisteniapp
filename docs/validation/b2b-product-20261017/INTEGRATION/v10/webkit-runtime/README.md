# Matching native WebKit runtime

Working runtime smoke: `./run-loopback-smoke.sh`; final exit code 0. Evidence: `smoke-loopback.log`.

- Exact existing driver: `/tmp/b2b-route-browser-setup/driver-playwright-core/index.mjs`, Playwright Core 1.63.0.
- Matching WebKit: version 26.6, revision 2359, Ubuntu24 x64 artifact.
- Actual cache: `/tmp/b2b-route-browser-setup/webkit-ubuntu24-cache`.
- Executable: `webkit-2359/pw_run.sh` inside that cache.
- Existing image: `klisteni-browser:1.62.0`, used for OS libraries and Node only; image's built-in old WebKit is unused.
- Existing seccomp: `/workspace/.onboarding/browser-support/seccomp_profile.json`.

The runner uses UID1001 pwuser, existing seccomp, `no-new-privileges`, `--network none`, 1GB shared memory, and read-only runtime/harness mounts. It does not set a WebKit sandbox-disable environment variable or change trust. Docker isolation remains enabled; no separate claim about internal WebKit sandbox implementation is made.

`webkit.launch({headless:true})` with this mounted cache successfully loaded native `http://127.0.0.1:<port>`, reported version26.6 and viewport width320, and completed a native IndexedDB transaction/write/read. WebKit classified this native loopback context as secure (`isSecureContext:true`). No crypto, context, network, IndexedDB, or security shims were added. No product route/component behavior is validated by this runtime-only smoke.

The original fictitious-domain smoke is retained in `smoke.log`. A second attempt preserving the existing HTTP proxy and explicitly passing its local-domain bypass is retained in `smoke-explicit-proxy.log`. Both failed WebKit resolution of route-proof.test. `host-diagnostic.log` confirms the Docker-only hosts entry and Node dns.lookup resolve that name to127.0.0.1, so root authorized native loopback for narrow layout validation. The working runner keeps domain-scoped NO_PROXY/no_proxy; no external proxy variables are removed or printed.

`install-ubuntu24.log` records the correct artifact download. The CLI reports missing dependencies on the host; it does not install them. Execution uses the existing Ubuntu24 image, where the smoke passed. `install.log` records the unused host-native Debian13 download in a different cache. Download/setup commands are retained in `setup-commands.txt`. No product, manifests, lockfiles, global permissions, sandbox policy, credentials, or trust stores changed.
