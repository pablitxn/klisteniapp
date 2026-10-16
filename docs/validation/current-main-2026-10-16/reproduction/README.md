# Executed harness overrides

These files preserve the exact external wrappers/queue used by this Cloud run.
They are environment-specific records, not a new generic test framework. Paths
refer to this run's `/workspace/klisteniapp`, `/workspace/qa-20261016` and existing
`.onboarding` support. The wrapper adds no test retries or assertion exclusions.
Its only coverage expansion is two brand-admin WebKit projects.

`executed-run-remaining.sh` waited for the initial demo visitor report, then ran
instance visitor, six self-service core/extra profiles, B2C administrator and four
B2B roles, serially. `executed-rerun-visitors.sh` queued the corrected WebKit visitor
runs after the initial role attempts. Those B2B attempts failed before discovery because
the external wrapper directory lacked a module declaration. An external
`package.json` containing only `{"type":"module"}` fixes config loading;
`executed-run-b2b-fixed.sh` then repeats the full demo WebKit matrix and runs all B2B roles after the
instance visitor retry. The module change happened during the first demo retry: 18
passed, two worker loads failed and 34 did not run. No in-flight configuration is
changed after this correction; those attempts remain in the case evidence. Both initial visitor configurations were loaded before
the executable-path correction, so their 108 launch failures remain retained.
The generator shown here is the corrected version used by later configurations.

Prerequisites: Node 24.19+, pnpm 12.7.0, locked app dependencies, disposable local
PostgreSQL 17 with separate B2C/B2B databases, a matching sandbox-capable browser
environment. Do not use real `.env` or production databases. The run's private
`environment.sh` sets only local disposable test URLs, the existing activation
script, `QA_INTEGRATION_USE_BUILT=1`,
`PW_TEST_CONNECT_WS_ENDPOINT=ws://127.0.0.1:47163/` and
`PW_TEST_CONNECT_EXPOSE_NETWORK=<loopback>`. No provider keys or real credentials
are required or included here.

The container runs the app's own `playwright-core@1.63.0/cli.js run-server`.
Its `--unsafe` API switch permits the client launch option `chromiumSandbox:true`
and explicit matching WebKit executable; actual launches use no sandbox bypass.
For B2C the service was published on loopback only. B2B then uses the task-owned
internal Docker bridge and its private browser WebSocket address, without published
ports. Both run as nonroot UID 1000 with
no-new-privileges and the official existing seccomp profile. System libraries come
from cached image `sha256:fb70e03db1c00327d2a5626fa6eea50ef9adc333e90c415b104722bb53df58d5`.
Only application node_modules and browser caches are mounted read-only. No host
networking, privileged container, TLS exception or trust-store change is used.

On another machine, resolve those paths to the actual checkout and artifact root,
use matching installed Playwright browsers, and retain sandbox/TLS requirements.
The owning configs and test specs remain the canonical fixture/viewport contracts.
Run the same commands against these wrappers after checking the selected suite,
role, DBs, ports and output directory. A browser launch failure is blocked
execution, not a functional product failure or passing coverage.

## B2B proxy adaptation

`executed-b2b-configure.mjs` is the later wrapper version: only the explicit HTTP
proxy hostname changes to the private bridge gateway, preserving each fixture
port, origin, test and assertion. `executed-fixture-relay.py` forwards those six
ports to the unchanged loopback proxies and permits only the browser IP and host
gateway IP. `executed-relay-controls.mjs` checks allowed traffic and rejects
external hosts, HTTPS, other ports, URL credentials and an unlisted source IP.

The module-corrected member run first recorded 96 proxy-connection failures before
reaching the UI. Its queue was stopped before the other three roles ran. The
one-case QR/login probe then passed. `executed-run-b2b-relay.sh` runs the four full
roles serially with `environment-b2b.sh`: the original private environment plus
`PW_TEST_CONNECT_WS_ENDPOINT=ws://<private-browser-ip>:47163/` and
`QA_FIXTURE_RELAY_HOST=<private-gateway-ip>`. The external package declaration is
frozen before these executions. No configuration file is changed mid-run.

An initial relay setup read an empty container default gateway (expected for an
internal network); the final relay reads the network IPAM gateway instead. Docker
omits published ports for that internal network, so the host uses the private
WebSocket address. An initial control request ran after the short probe fixture
had shut down and got a connection reset; the recorded controls run against the
live full-matrix fixture. These diagnostics establish no product failure or pass.


## Final queue and evidence collectors

The relay queue was stopped after member export assertions failed remotely;
trainer, anonymous and full brand-admin did not execute in that attempt. After
commit `c4fb918498d07b3d7bd43cf0adec8c65983ddb4d`,
`executed-run-b2b-final.sh` verifies the targeted member export report, executes
the two brand-admin export probes and runs all four complete roles serially.
`executed-record-run.py` captures each actual checkout HEAD, the pinned test-source
revision and test/config/relay hashes before execution. Later documentation
checkpoints can advance HEAD without changing those inputs.

`executed-summarize.py` preserves every case attempt and per-run report metadata.
`executed-package-evidence.py --final` requires all expected unique cases to pass;
latest cases are keyed by role, engine/viewport project, spec filename and title,
not line numbers, which changed with the import fix. Serial run timestamps decide
which repeated execution is latest. Setup reports that fail before discovery
remain separate from case counts.

`executed-archive-evidence.py` freezes new role-specific local archives only after
that assertion. It refuses to overwrite its destination, records file and archive
hashes and reads each gzip stream to verify integrity. Private environment files
are excluded. These collectors are executed environment-specific records; inspect
paths and output ownership before reproducing them elsewhere. Neither fresh local
archives nor these scripts establish recovery of missing historical bundles or
remote retention.


## Final verification and shutdown

After the final role report, `executed-cleanup-environment.py` queries only the
two disposable DBs, then removes exact task-owned containers, their anonymous DB
volume, relay and empty internal network. It checks pinned image IDs first and
preserves existing development resources and browser caches.

`executed-verify-final-evidence.py` verifies the 1218 latest passes, retained case
records, fixture/provenance input hashes, log and capture hashes, all raw file and
archive hashes, report hashes, authored relative links and the two-file source
delta. `executed-validate-intake.rb` checks the nine required YAML fields and enum
values against the mounted Atlas schema. These are targeted evidence/intake
checks, not a substitute for the canonical Atlas consistency suite; no shared
Atlas canonical content was edited. Their JSON results are linked from the QA
receipt.
