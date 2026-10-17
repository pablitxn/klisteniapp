# WP12 v5: real HTTP diagnostics and blocking gateway disconnect leak

Status: **bounded diagnostics completed; further broad execution blocked by a
shared gateway lifecycle defect**. Parent retains orchestration, application
fixes, acceptance and merge authority. No complete product acceptance is claimed.

| Input                                                       | Immutable revision                         |
| ----------------------------------------------------------- | ------------------------------------------ |
| Executed application candidate                              | `2d0df2797d7876070372bc7808d582604ca3bbf0` |
| Initial R11 QA source                                       | `8c191c0c86c3ce2a7f39ba017b20469e8f0998f4` |
| R12 QA source with real idle-window admission pacing        | `ad488a02d7e3ab16e5c7278825c748f777903ada` |
| Prepared corrections and detail actions, statically checked | `e3dc9ae7ad6d3a72c1ba44b10f022f5610268d9a` |
| Newer integrated fixture context, not executed here         | `6a479f00f6941e0ec7fb89cc399a7569e3b08e04` |
| Previous immutable WP12 checkpoint                          | `1aa6b375149a3da90a56fe833fbfd953ee745d8b` |

The pinned plan remains 447d77ebb5587e319018e7b56003f0ef7299bb6c;
Atlas remains ce45d206a2ed4035f8003a3303abd1fff98e09b8. Parent supplied the exact
candidate after its API 240/web 220/React 18/harness 2 checks. Those owner results
are not added to QA counts. No application code was fixed in this QA branch.

## Actual completed runs

Both runs used actual built application, disposable SQL, real password UI,
accepted ProductEndpoints and real DOM in Chromium at 430x932, unified HTTP. They
are independent runs, not one accepted matrix.

| Run                                           | Pass | Fail | Unrun | Qualification                                                                                   |
| --------------------------------------------- | ---: | ---: | ----: | ----------------------------------------------------------------------------------------------- |
| R11 history/planning/roles selection          |    5 |    4 |    18 | Four real sign-in 429 failures; QA stopped between completed cases to repair idle-window pacing |
| R12 remaining roles/health/inactive selection |   13 |    8 |     7 | Five assertion failures plus three timeouts; configured eight-failure cap stopped the run       |

Neither report contains a skipped test result; Playwright's top-level `skipped`
statistics here count unrun cells with empty results arrays. R12 also contains
one runner-level `Testing stopped early after 8 maximum allowed failures` stop
diagnostic, not a ninth failed test. [Per-cell ledger](runs.json) retains raw
statuses/errors/annotations, exact heads and original JSON/log hashes. The
initial R11 CLI selection error occurred before feature execution and is saved
separately; its corrected command is the R11 run above.

R11 passed continuity, routine/session bidirectional links, inactive staff
history, immutable later-edit preservation and legacy history presentation.
These are qualified source obligations; original broader variants listed in
[coverage](coverage.md) remain. Later prepared detail assertions have not run.

R12 passed absent-consent denial, scoped consent grant, import deduplication,
organization-specific consent revocation, keyboard/account switching, provider
request absence, inactive endpoint denial, owner export lineage/health,
cross-brand isolation, separate B2C invitation, download/retry, foreign/private
export exclusion and lossless ranged interchange. Its failed cells are
HEALTH005/008/009, INACTIVE003/006/011 and ROLES001/002. No unsuccessful assertion
was removed or converted to a synthetic pass.

## Blocking result and required owner action

The actual gateway leaks upstream SSE responses when a browser disconnects.
INACTIVE-011's trace recorded 57 event429s; ROLES-001 recorded 58. The API's active
subscription cap remains eight per actor. A bounded actual-gateway transport
probe left 0 connections after direct disconnect, then 1, 2, 3 after three proxied
disconnects. See [status diagnostics](event-status-diagnostics.json),
[raw reproduction](gateway-disconnect-probe.json) and
[exact owner request](owner-requests.md). The transport-only producer is not a
feature response, provider or fabricated product acceptance fixture.

INTEGRATION must propagate downstream response closure to upstream cancellation
without truncating healthy streams or weakening limits. QA did not edit the
shared gateway/configuration. Remaining planning/role cells and corrected
history/privacy/recovery cases are pending the exact composed fix head. No
passed diagnostics were restarted merely because a newer fixture head arrived.

The existing WP09 queued-input bug also emptied session notes in INACTIVE-006;
its returned owner patch covers those values. WP09 HTTP hashing/correction and
WP08 width fixes remain queued for original-case browser reruns after parent
composition. Owner component tests do not resolve these failures in this receipt.

## Prepared source and checks

Owned source corrections bind real consent revalidation, exact rejection status,
exact account-mismatch denial, actual deep links, named audit dialogs and a
truly ambiguous mixed-role branch request. Admission pacing reserves at most
nine real requests then honors the real library's idle-minute expiry. New
current/original period detail actions inspect issued dates/goal/timezone/actor
and distinguish immutable old from revised current periods. ALTERNATIVES-007 is
explicitly unavailable until the actual reviewed UI adoption action executes;
retained supplement/export reads cannot pass it. ALTERNATIVES-005's actual
integrator adaptation fixture is merged but not browser-executed here.

[Checks](checks.json) bind the exact prepared source: B2C TypeScript, ESLint on
all eight owned specs/three helpers, boundaries, formatting, whitespace and
effective Git identity passed. All 911 expected tracked executed application
files match the candidate [byte proof](application-source-proof.json). The
[actual R12 QA source ledger](candidate2d0-r12-source.json) has 24 matching files
and zero mismatches. Current source corrections are statically checked, not
retroactively attributed to earlier runs. Hosted CI was not established.

## Environment, recovery and preservation

Executor remained reachable; both bounded runs completed and result/trace copies
were retained before cleanup. The pinned official Playwright 1.63 image, nonroot
pwuser, original seccomp, no-new-privileges, Chromium sandbox and task Docker
bridge were reused. No security/TLS relaxation or helper modification occurred.
The shared-browser README path was absent; the installed supported startup and
smoke helpers were read under `.onboarding/browser-support`.

PostgreSQL 17.11 used a task-only tmpfs database, loopback listener/password
admission and the browser network namespace. An initial unused trust-configured
container was replaced before application execution. No credential, private
host environment, Git metadata or host socket was mounted into the browser.
All application traffic/data was synthetic. The normal schema guard and cleanup
remained active; zero browser schemas remained after both runs. Task containers
and the task network were removed after artifacts were copied.

Raw JSON and base64 exact logs are committed; retained browser trace/screenshot copies
remain task-local under `/workspace/wp12-runtime-v5/evidence/`. These artifacts
are not a cross-environment persistence promise. Previous v1-v4, the original
inventory/final runner, shared contracts/configuration/seeds/manifests/lockfile
and application source are unchanged by QA-authored commits. Shared changes
arrived only through exact parent merges. Original Yoga, physical/release and
provider qualifications remain. Trusted HTTPS inputs are absent and that gate
is blocked separately; no trust/TLS bypass was attempted.
