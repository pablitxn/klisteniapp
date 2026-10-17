# Reproduce WP12 v4 diagnostics

Application candidate: `591feb1fd6a29306b5dc08a70ae5335a0ce01422`.
QA source: `896ae6be0c51819af0de6c2202b6e5555d493449`.
The matching frontend was built from the candidate source in a tracked-source
snapshot. All QA source bytes in the runtime matched the source ledger.

Use the existing official Playwright1.63 image pinned in
[the v2 runtime receipt](../v2/runtime-receipt.json), the unchanged official
seccomp profile and the locked application dependencies. Use the supported
Node24/pnpm12.7 activation. No native browser override or new browser download
is required.

The task used `/workspace/wp12-runtime-v4/candidate591` as a clean tracked-source
snapshot, created with `git archive` and no `.git` or private environment file.
Dependency links and the public installed dependency tree were copied to that
task directory and made readable by nonroot `pwuser`; original dependency
permissions were unchanged. Build output and evidence were writable only in the
task runtime/container. The actual build command inside that snapshot was:

```sh
cd /task/candidate591/apps/b2b-web
node node_modules/vite/bin/vite.js build
```

A task-named Docker bridge used the same normal networking model as the
installed supported smoke helper. The browser container used `--user pwuser`,
`--init`, `--security-opt no-new-privileges`, the pinned seccomp profile and1GiB
shared memory. Chromium config explicitly enables its sandbox. There was no
host networking, published port, privileged flag, added capability, secret/host
socket mount, TLS exception or trust mutation. Normal bridge outbound capability
is not described as an internal-only firewall.

A pinned cached PostgreSQL17.11 container joined the browser container's network
namespace (`--network container:wp12-v4-browser`). Its database lived in tmpfs;
application, gateway, proxy, control endpoint and PostgreSQL shared loopback.
Set a task-owned `B2B_TEST_DATABASE_URL` privately to that disposable database,
with both `b2b` and `test` in the database name. Never print it or persist it in
a tracked file. The app's normal DB guard and per-project schema cleanup remain
active. Never share this database with concurrent API migration suites.

For each command below, set these environment variables in that container:

```sh
B2B_PRODUCT_TEST_ACTIVATE=1
B2B_PRODUCT_USE_BUILT=1
B2B_PRODUCT_OUTPUT=/tmp/<fresh-run-directory>
PLAYWRIGHT_JSON_OUTPUT_NAME=/task/evidence/<run>.json
```

Pass the privately set database variable into the container as an environment
variable without copying its value into source/evidence. From
`/task/candidate591/apps/b2c-web`, the executed CLI subsets were:

```sh
# R6: source1ad4038; initial new-candidate diagnostic.
node node_modules/@playwright/test/cli.js test \
  --config playwright.b2b-product-unified.config.ts \
  --project product-chromium-320 --project product-webkit-320 \
  --grep 'B2BP-(PROGRAMMING-003|HEALTH-001|HEALTH-004|WEEK-001|SYNC-010|INACTIVE-001|INACTIVE-008)' \
  --timeout 45000 --reporter=list,json

# R7: source88cb270; committed-consent reconciliation and real admission pacing.
node node_modules/@playwright/test/cli.js test \
  --config playwright.b2b-product-unified.config.ts \
  --project product-chromium-320 --project product-webkit-320 \
  --grep 'B2BP-(HEALTH-004|WEEK-001|INACTIVE-008)' \
  --timeout 45000 --reporter=list,json

# R9: source896ae6b; real import reconciliation, all six original projects.
node node_modules/@playwright/test/cli.js test \
  --config playwright.b2b-product-wl-http.config.ts \
  --grep 'B2BP-(HEALTH-001|INACTIVE-001|PROGRAMMING-003|WEEK-001)' \
  --timeout 45000 --reporter=list,json

# R10: source896ae6b; >91-second editor continuity, then actual trainer conflict.
node node_modules/@playwright/test/cli.js test \
  --config playwright.b2b-product-unified.config.ts \
  --project product-chromium-desktop --grep 'B2BP-PROGRAMMING-009' \
  --timeout 180000 --reporter=list,json
```

R8 used R9's subset at source88cb270 and was interrupted deliberately after the
old import-response wait was diagnosed. Its completed/interrupted/unrun cells
are retained separately. Other older attempts used application04ac103 and are
qualified in the receipt; do not substitute them for the commands/heads above.

The selected diagnostics do not invoke or satisfy the final runner. Final
acceptance needs the parent's immutable complete head, clean Git checkout and
accepted WP00–WP11/WP13 ancestor manifest, all88 IDs without filters, all six
projects, all required modes, and no missing/skipped/unavailable/failed cell.
Trusted HTTPS requires the already-approved certificate/key and browser trust;
this task had neither configured and did not create them. Physical devices and
release/provider/production checks remain separate.
