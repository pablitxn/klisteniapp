# Executed validation commands

Working directory `/workspace/klisteniapp`. Source `/workspace/.onboarding/activate.sh`
in each shell: Node24.19.0 and pnpm12.7.0. Preserve unchanged dependencies.

```sh
pnpm install --frozen-lockfile --store-dir /workspace/.onboarding/pnpm-store
node --test apps/b2b-web/tests/restrictedAccess.test.ts apps/b2b-web/tests/trainingInterchange.test.ts
pnpm --filter @klisteniapp/b2b-web test
pnpm --filter @klisteniapp/b2b-contracts test
pnpm --filter @klisteniapp/b2b-domain test
pnpm --filter @klisteniapp/b2c-web test
pnpm typecheck
pnpm lint
pnpm build:b2b
git diff --check
python3 /workspace/sysadmin-workspace/tools/cloud_git_identity.py --repo /workspace/klisteniapp
```

API: a new task-owned ephemeral PostgreSQL image/container was used, with synthetic
local credentials, `127.0.0.1:55411`, database `klisteni_b2b_test`. After
`docker exec wp11-postgres-v2 pg_isready -U wp11 -d klisteni_b2b_test` succeeded:

```sh
B2B_TEST_DATABASE_URL=<disposable-local-connection-url> pnpm --filter @klisteniapp/b2b-api test
```

The fixed existing health-fixture guard requires that exact localhost/database
name. Every test creates/drops its own schema. No shared .env was read. The
container was removed after checks. Do not point this at development/production.

Commit metadata check uses the existing Atlas helper's unchanged explicit-root
function; its CLI otherwise always checks the Atlas repository:

```python
import runpy
from pathlib import Path
check = runpy.run_path('/workspace/sysadmin-workspace/tools/check_engineering_content.py')
errors, count = check['commits'](Path('/workspace/klisteniapp'), 'fd138190e18ba84dcf47c1fc81ad535d051d8ff4')
assert not errors
```

The ordinary `python3 .../check_engineering_content.py check` is an Atlas-only
176-file instruction/provenance check. PR title/body use its ordinary `pr` command.
Both heuristics still need human meaning/English/provenance review.

## Isolated owned component probe

The frozen application Playwright package supplied exact version1.63.0. Task-owned
browser acquisition used the normal official installer, without --with-deps,
version substitution, host package installation or validation bypass:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/wp11-runtime/browsers pnpm --filter @klisteniapp/b2c-web exec playwright install chromium webkit
```

Copy `playwright` and `playwright-core` from the existing frozen pnpm store to
`/tmp/wp11-runtime/node_modules` (resolve symlinks, preserve exact package versions).
Copy the reviewed official seccomp file, verifying SHA256
`cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849`.
Copy `build-harness.mjs` to `/tmp/wp11-build-harness.mjs`, and the probe to
`/tmp/wp11-runtime/owned-ui-probe.mjs`; then:

```sh
node /tmp/wp11-build-harness.mjs
chmod -R a+rX /tmp/wp11-runtime
docker run --pull=never --name wp11-owned-ui-chromium --init --network none \
  --user pwuser --security-opt no-new-privileges \
  --security-opt seccomp=/tmp/wp11-runtime/seccomp_profile.json --shm-size=1g \
  --mount type=bind,src=/tmp/wp11-runtime,dst=/harness,readonly \
  -e PLAYWRIGHT_BROWSERS_PATH=/harness/browsers \
  sha256:50cbb76d250a50002045a95f484c5f40573cde831adbe40c784052c037e36118 \
  node /harness/owned-ui-probe.mjs chromium
```

This explicitly uses the retained 1.62 Noble OS image with newly downloaded exact
1.63 binaries/packages. It is not the unavailable exact1.63 image. Chromium
153.0.8010.12 runs with chromiumSandbox:true; WebKit1.63 dependency validation
fails in that OS image. Run `webkit` only to reproduce the recorded blocker, not
to claim matrix acceptance. No older executable was substituted. Only the public
synthetic task runtime is mounted; there are no private repository/env mounts.
The local HTTP server binds container loopback and network none prevents external
access. Normal external invitation navigation is intercepted and locally fulfilled.

Screenshots were copied from the stopped task container using `docker cp`, before
removing it. The successful Chromium log is `chromium.json`. All exploratory setup
failures and WebKit's unexecuted cases are explained in README.md.
