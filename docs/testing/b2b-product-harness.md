# B2B product baseline harness

INTEGRATION owns these configs, disposable seed adapter and runtime. This is the
initial composition of accepted WP00/WP13 and WP12 preparation, with all
`product_active` flags false. It does not implement business handlers, enable
product features or count as the 88 reserved WP12 browser scenarios. The
[versioned receipt](../validation/b2b-product-20261017/INTEGRATION/v1/README.md)
records actual checks and immutable inputs.

## Entrypoints and isolation

| Config under `apps/b2c-web/`                | Mode                            | Default control port |
| ------------------------------------------- | ------------------------------- | -------------------: |
| `playwright.b2b-product-unified.config.ts`  | `unified-http`                  |                 5600 |
| `playwright.b2b-product-wl-http.config.ts`  | `white-label-http`              |                 5700 |
| `playwright.b2b-product-wl-https.config.ts` | `white-label-https-valid-trust` |                 5800 |

Each config selects only `b2b-product-*.spec.ts`, with Chromium and WebKit at
320x740 and 430x932 touch/mobile plus 1440x1000 desktop. Workers=1, retries=0,
fullyParallel=false, trace=retain-on-failure. Metadata identifies the actual
mode, engine, viewport and touch setting. Chromium sandboxing is explicitly on;
TLS verification stays on, with no executable override or certificate bypass.
The config does not acquire or substitute a browser runtime.

Each project receives its own PostgreSQL schema, API, gateway, media directory,
authentication/proxy secrets and, in white-label modes, restricted proxy endpoint.
`productHarnessLayout()` allocates control port B, gateway B+10+3i, API B+11+3i
and proxy B+12+3i for project index i=0..5. `B2B_PRODUCT_PORT_OFFSET` adds a chosen
integer from 0..3000 to all ports. Keep simultaneous jobs' complete ranges disjoint.
All listeners bind to loopback. White-label proxy resolution accepts only
`atlas.b2b.test`, `sur.b2b.test`, `alias.b2b.test` and `unknown.b2b.test`, forwarded
to the project's fixed loopback gateway without DNS or general internet relay.

The built B2B frontend is copied once to a task-owned temporary snapshot. Startup
fails rather than attaching to an existing server. SIGTERM/SIGINT removes only
created schemas and runtime directories, including partial-startup cleanup.

## Seed and fixture lookup

`scripts/b2b-product-seed.mjs` consumes QA's unchanged `buildTopology(runKey)`.
It installs historical schema 001–005 into a fresh schema, creates legacy
records, then invokes the normal migration registry twice. It compares old
snapshot JSON text, assignments, executions, audits, media metadata and grants
before/after migration 006. It never changes historical migration source.

The fixture maps QA logical keys to persisted actor, organization and branch IDs:

- Two synthetic brands/four branches and 22 named QA identities, with UTC branch
  timezones. QA accounts have no platform administrator grant. Supporting demo
  accounts remain separate and must not stand in for the named QA identities.
- Legacy full admins created before 006 migrate to product superadmin. New
  product admins and explicit superadmins are inserted after 006. Their current
  stored roles are seed evidence; narrow admin enforcement waits for WP01.
- Cover coaches have no student assignment. Mixed-role actors have a primary
  coach grant and secondary member grant. The dual-brand member is inactive in
  Atlas and active in Sur. A separate identity has no membership.
- Four legacy snapshots, six assignments, two partial execution logs, two old
  audit rows, two synthetic PNG media records/files and 32 branch grants are
  preserved. The named primary-branch QA members have legacy assignment/log IDs.
- Two validated v2 range-prescription snapshots are unassigned in secondary
  branches. This deliberately exercises mixed-format storage while keeping the
  primary branch's legacy flows usable. Old secondary routine-list routes may
  correctly return `426 UPGRADE_REQUIRED`; do not interpret that as an
  implemented v2 authoring route.
- No health records, consent or provider connection is created. Goal/enrollment/
  occurrence/session-v2 scenarios await accepted producer services and fixtures.

Use project metadata `fixtureControlPort` and `fixtureIndex` to request
`GET http://127.0.0.1:<control>/fixtures?project=<index>` from the test runner.
The endpoint returns `fixtureVersion`, `runKey`, `organizations`, `actors`,
`resources.{legacy,v2}`, preservation hashes/counts, feature gates and project
ports. It is read-only and rejects browser Origin headers and non-GET/HEAD methods.
The same map is written mode 0600 inside the temporary runtime directory; its
path is printed at startup and removed at shutdown. Do not hardcode generated IDs.
The public synthetic-only test password is exported as `PRODUCT_TEST_PASSWORD`
from the seed adapter. Never reuse it outside disposable fixtures.

## Running checks and handing off to QA

Activate the supported Node 24/pnpm 12.7 environment. Privately set
`B2B_TEST_DATABASE_URL` to a task-owned loopback PostgreSQL database whose name
contains both `b2b` and `test`; connection options, queries and fragments are
rejected. Do not print the URL or put it into tracked files. The harness only
creates/removes its random schemas, not the database itself.

```sh
source /workspace/.onboarding/activate.sh
pnpm --filter @klisteniapp/b2b-web build
node --test scripts/b2b-product-harness.test.mjs
node --test scripts/b2b-product-harness.integration.test.mjs
```

The four integration checks require that database and a current build. They run
six actual HTTP app environments, one unified guard probe, a fail-closed HTTPS
configuration check, and interrupted-startup cleanup. These are Node HTTP/SQL
checks, not browser or feature acceptance. To leave the six-project app running
for QA's own baseline browser verification:

```sh
B2B_PRODUCT_MODE=white-label-http node scripts/b2b-product-e2e-server.mjs
```

QA can use the accepted matching Playwright 1.63 runtime with these configs and
fixture IDs. In a container, API/gateway/proxy/control/browser must share the
loopback network namespace, and PostgreSQL must also be reachable through an
explicit task-owned loopback endpoint. QA's generic `--network none` transport
probe alone does not provision PostgreSQL or this application. Do not weaken the
loopback database guard or mount credentials/host Docker sockets to bridge it.
This checkpoint does not add reserved feature specs or alter QA's final runner.

For final acceptance, use QA's existing `run-browser.mjs` only after the parent
accepts a clean combined head and all WP00–WP11/WP13 dependency SHAs and the 88
actual feature specs exist. See [QA preparation](../../apps/b2c-web/e2e/fixtures/b2b-product/README.md).
Set `B2B_PRODUCT_OUTPUT` to a fresh `/tmp` task path for config-managed artifacts.
The config builds the frontend unless `B2B_PRODUCT_USE_BUILT=1` explicitly reuses
a current candidate build. Never reuse a stale build across source revisions.

## Remaining gates

**Unified mode:** the frozen baseline's `http.ts` rejects domainless access if
any registered active/verified domain or multi-branch organization exists.
The full QA topology therefore returns `503 WHITE_LABEL_REQUIRED` for unified
login/context/session requests, although static HTML and readiness work. The
harness preserves this guard and marks the fixture accordingly. WP01 owns the
ACCESS lease and must reconcile authorized unified behavior before this mode's
functional acceptance; do not remove brands/branches to manufacture a pass.

**HTTPS:** supply only an already provisioned, task-owned certificate/key through
`B2B_PRODUCT_TLS_CERT` and `B2B_PRODUCT_TLS_KEY`. The certificate must cover all
four fictitious hosts, be current and remain valid for at least five minutes.
Both browsers must trust it under the existing approved runtime configuration.
Missing inputs fail before database setup. This harness neither generates
certificates nor edits browser/system trust; certificate coverage alone does
not prove successful browser verification or Secure-cookie acceptance.

**Product activation:** keep all product flags false at this checkpoint. Later
INTEGRATION amendments must consume accepted producer APIs/fixtures, extend the
seed without rewriting legacy evidence, and enable features only after the
combined handlers and access controls are ready. CONTRACT remains frozen;
ACCESS files belong to WP01. Canonical Atlas updates remain a separate owner.
