# Matching Playwright 1.63 transport preparation

This is a synthetic runtime/HTTP transport probe. It does not import application
contracts, create B2B DTOs, seed a database, load a feature screen, or satisfy any
of the 88 reserved product scenarios. The parent authorized task-local runtime
preparation after the v1 receipt. Installed 1.62 helpers remain unchanged.

The official image, Node 24, matching npm packages and synthetic HTTP server run
inside one nonroot container. `--network none` permits only container loopback:
there is no host relay, published port, external egress or Docker socket mount.
Chromium explicitly enables its sandbox; both engines use official seccomp,
no-new-privileges and Docker's existing default capability bounding set. The
probe verifies its UID, zero effective capabilities and no-new-privileges. It
observes browser processes and rejects a Chromium `--no-sandbox` argument.

The tiny server intentionally uses `/auth/session` and `/transport/*`, unrelated
to B2B schemas. It checks HTTP request bodies, same-origin cookies and origin/host
headers; accepted-write response loss and exact retries; conflicting updates;
HEAD, range responses and DELETE. State is in memory and dies with the container.
The HTTP cookie is HttpOnly/SameSite=Strict and deliberately lacks Secure: this
is local HTTP evidence, never HTTPS/Secure-cookie acceptance. TLS bypasses, trust
changes and provider/production requests are not involved.

## Prepare a task-owned directory

From the app root, use a new `/workspace/wp12-runtime-*` or `/tmp/wp12-runtime-*`
directory. Do not run npm against the application or installed helper tree.
The exact successful task directory was `/workspace/wp12-runtime-v2`.

```sh
mkdir -p /workspace/wp12-runtime-v2
python3 - <<'PY'
import json
from pathlib import Path
Path('/workspace/wp12-runtime-v2/package.json').write_text(json.dumps({
    'private': True, 'type': 'module',
    'dependencies': {'@playwright/test': '1.63.0'}
}, indent=2) + '\n')
PY
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install \
  --prefix /workspace/wp12-runtime-v2 \
  --cache /workspace/wp12-runtime-v2/npm-cache \
  --ignore-scripts --no-audit --no-fund
curl --fail --location --proto '=https' --tlsv1.2 \
  https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/utils/docker/seccomp_profile.json \
  --output /workspace/wp12-runtime-v2/seccomp_profile.json
DOCKER_HOST=unix:///var/run/docker.sock docker pull \
  mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27
```

The downloaded package integrities for `@playwright/test`, `playwright` and
`playwright-core` must match the app's unchanged pnpm lockfile. All three did in
this task. The probe independently asserts each package version is 1.63.0 from
the isolated mounted module tree, avoiding globally installed runtime fallbacks.
The official seccomp SHA-256 is
`cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849`.
The run script verifies that hash and uses `--pull=never` with the immutable image.

## Execute sequentially

```sh
bash apps/b2c-web/e2e/fixtures/b2b-product/runtime-v2/run-probe.sh \
  /workspace/wp12-runtime-v2 chromium
bash apps/b2c-web/e2e/fixtures/b2b-product/runtime-v2/run-probe.sh \
  /workspace/wp12-runtime-v2 webkit
```

Each engine runs 320x740 and 430x932 touch/mobile plus 1440x1000 desktop and emits
JSON only after all its checks pass. Browser/server/context cleanup runs even on
failure; the wrapper removes only its named task container. Containers run
sequentially because this environment uses a disk-intensive VFS Docker driver.
No image pull, package install or permission/security fallback happens during
the probe. File readability changes affect only public task-owned runtime files.

## Final candidate transport handoff

The proven architecture is browser plus HTTP frontend/API in the same isolated
environment, rather than broadening the old GET/HEAD host relay. For the actual
combined candidate, INTEGRATION must run its accepted Node 24 harness and browser
runner together, retain one disposable schema/media/origin per project, and
provide the selected synthetic PostgreSQL. A task-only internal network with an
unpublished disposable database is the proposed extension if a separate DB
container is needed. No host networking, privileged mode, browser sandbox bypass
or credential mount is required. That DB/composition is not executed by this probe.

The existing unified and WL proxy servers/configs can share container loopback
with their browsers. Their seed/config registration stays with INTEGRATION.
Run the accepted candidate's own `@playwright/test` 1.63 and locked dependencies;
the synthetic probe is not a replacement for the final scenario runner. Trusted
HTTPS remains a separate gate using existing valid trust without exceptions.
Cached-image readiness is proven in this task, not saved-environment publication
or persistence into another task; prepare by the same immutable references there.
