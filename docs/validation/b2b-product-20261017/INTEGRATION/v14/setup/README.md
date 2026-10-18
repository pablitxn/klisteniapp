# Corrective validation runtime — setup only

Task-owned containers are running. No product/browser tests have started. Parent owns the final source freeze, QA refresh and test execution.

- Root: /tmp/klisteni-readiness-runtime
- Application copy: app/ (mounted readonly as /task/app)
- Browser container: klisteni-readiness-browser-v1, pwuser UID1001, Node24.18
- PostgreSQL container: klisteni-readiness-pg-v1, PostgreSQL17.11,768MiB tmpfs
- Network: klisteni-readiness-network-v1 (ordinary bridge; no egress-firewall claim)
- PostgreSQL shares browser namespace, listener127.0.0.1:5432, fresh synthetic klisteni_b2b_readiness_test, no published ports
- Exact Playwright1.63 driver/browser cache: /tmp/b2b-integration-v13/browser-runtime mounted readonly /runtime; PLAYWRIGHT_BROWSERS_PATH=/runtime/browsers
- Output: evidence/ mounted writable /tmp/readiness-evidence
- B2B_TEST_DATABASE_URL is already present privately in the browser environment. Do not print it or dump container Env. A private-connection.json mode0600 exists for parent-only local administration.

Security settings retain existing seccomp, no-new-privileges, nonroot browser and Chromium sandbox configuration. Cached image1.62 supplies OS/Node only; locked app/driver1.63 and matching1243/2359 browsers are used. No existing container/database/network was changed.

Source copied1285 files, excluding.git/docs/node_modules/private.env; dependencies copied separately into15 local trees with no escaping workspace links. All960 checked apps/packages/scripts inputs match d2adf75d3fee18740ef38632a361c91203d77dc6. The copied QA bytes were provisional while parent edited at471bea1c2bf9446a69865ef091840ebada23d2f9. Parent must refresh final QA files and record their SHA manifest before executing tests. After refreshing, grant only task-copy directories0755/files0644 so UID1001 can read them; never chmod the owning repo or shared pnpm store.

Fresh builds passed for B2B and B2C instance mode with repository example public profile. Commands/cwd/durations are in *-build.json, logs in *-build.log and every built output hash in *-dist-sha256.json. Existing large-chunk warnings remain. Browser setup verification read both builds, exact1.63 packages and the fresh PostgreSQL loopback connection; fixture schema count0. No product cases were executed.

After the parent source freeze, an individual run can use:

```sh
docker exec --workdir /task/app/apps/b2c-web   -e B2B_PRODUCT_OUTPUT=/tmp/readiness-evidence/unified-r1   klisteni-readiness-browser-v1   node node_modules/@playwright/test/cli.js test     b2b-product-sync.spec.ts b2b-product-health.spec.ts b2b-product-week.spec.ts     --config=playwright.b2b-product-unified.config.ts     --grep='B2BP-(SYNC-002|HEALTH-002|WEEK-009) '     --workers=1 --retries=0
```

Use a fresh output directory and independent CLI/harness invocation per mode/repeat; white-label config is playwright.b2b-product-wl-http.config.ts. Do not use --repeat-each: caseWeek depends only on scenario ID, so repeated WEEK009 enrollments contaminate the required-session count in shared schemas. Complete3 IDs ×6 profiles ×2 HTTP modes ×3 independent repeats targets108 cells. Preserve all failures/unrun cells and verify task-owned schemas clean up after every invocation. Do not run API migration suites concurrently against this browser database.

Setup scripts/logs are retained as prepare-snapshot.py, setup-containers.py, setup-commands.json, build-snapshot.py, setup-readiness.log and security/isolation summaries. They are records of completed setup, not idempotent instructions to rerun. private-connection.json contains only task-generated synthetic authentication material and must remain outside Git/evidence publication.

When the parent no longer needs the runtime, remove only klisteni-readiness-pg-v1 and klisteni-readiness-browser-v1, then klisteni-readiness-network-v1. PostgreSQL tmpfs is intentionally ephemeral; stopping/removing its container discards synthetic data. Leave all prior containers untouched.
