# Isolated workspace loading regression

This suite serves the actual Vite production build of `apps/b2b-web` from a
dedicated local HTTP server. The browser uses the real login form, session
controller, workspace, lazy modules, navigation and access/consent guards.
Authentication, organizations, people, permissions and SSE are synthetic fixtures;
there is no database, real account, provider or production data. Passing this suite
is fixture regression evidence, not end-to-end verification of real authentication
or server authorization and not acceptance of the full product matrix.

Run from `apps/b2c-web` with existing dependencies and installed Playwright Chromium:

```sh
node node_modules/@playwright/test/cli.js test --config playwright.workspace-loading.config.ts
```

The config has two Chromium profiles (430 x 932 and 1440 x 1000), one worker, zero
retries, a 30-second test timeout and five-second expectations. Chromium sandboxing
is enabled. Use a runtime that supports its sandbox; do not disable sandboxing to
make this suite pass. The fixture asserts the browser's actual online and visible
state before login, without overriding either value. A container with only
loopback networking can report `navigator.onLine === false`, preventing the real
workspace admission guard from starting its event stream. Use an isolated runtime
whose network interfaces accurately report online, such as an internal container
bridge. No existing acceptance helper, config, test or deadline is
modified. The server invokes the checked-out Vite CLI with Node, without installing
packages or invoking package-manager metadata updates. Its disposable build goes
under `/tmp` and is removed at server shutdown.

`B2B_WORKSPACE_LOADING_DIST` can point to an existing immutable production build;
the server then only reads it and does not build or modify it. This supports a
baseline negative control with the same fixture/spec. The unrelated-chunk test
must fail when an eager workspace dependency holds the shell. Baseline builds can
coalesce feature modules into the workspace chunk, so a chunk-specific selected
feature scenario is only applicable when that build emits the named entry chunk.

Other optional environment variables:

- `B2B_WORKSPACE_LOADING_PORT`: dedicated loopback server port (default 4298).
- `B2B_WORKSPACE_LOADING_RESULTS`: Playwright artifact directory (default
  `/tmp/klisteni-workspace-loading-results`).
- `PLAYWRIGHT_BROWSERS_PATH`: existing browser installation owned by the caller.

The seven scenarios cover an unrelated blocked chunk, selected feature delay and
release, selected chunk rejection with navigation recovery, a branch/role change
during delay, consent revocation during shared-health delay, initial consent denial,
and inactive export-only access. Gates verify the named chunk exists in the served
build's actual asset inventory before intercepting its hashed production URL and
release only on explicit test actions. Native browser module evaluation and two
rendering frames are awaited after consent revocation, then the current denial UI
is asserted again; no guessed settling sleep, retry, or enlarged deadline
is used. Synthetic successful responses are validated against the application DTO
schemas. Unmodeled API requests fail the test, including any unexpected health read.

Each test attaches `synthetic-request-phases` JSON containing chunk hold/release
markers, semantic UI readiness, browser request/header/body-finish/failure events,
browser network timing and synthetic server arrival/finish/close events. Observer
timestamps use test-runner epoch milliseconds; server timestamps use server epoch
milliseconds. Browser `Request.timing()` has its documented browser timing origin.
These separate observations are not a measured cross-process latency decomposition,
and body completion alone is not credited as visible feature readiness.
