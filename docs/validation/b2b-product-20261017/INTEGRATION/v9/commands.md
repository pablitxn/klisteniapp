# Reproduction commands

Use the repository's supported Node 24 and installed pnpm 12.7.0. In this prepared
workspace, source `/workspace/.onboarding/activate.sh` before pnpm commands. Do not
install or update dependencies to reproduce these checks.

```bash
source /workspace/.onboarding/activate.sh
pnpm --filter @klisteniapp/b2b-web test
pnpm typecheck
pnpm lint
pnpm build
node --test scripts/b2b-product-stream-lifecycle.test.mjs
node --test apps/b2b-web/tests/product-stream-guard.test.ts apps/b2b-web/tests/product-stream-retry.test.ts
```

For composed HTTP, supply `B2B_TEST_DATABASE_URL` for the existing isolated
`klisteni_b2b_integration_test` database on loopback port 55441, then run:

```bash
node --test scripts/b2b-product-composed-harness.test.mjs
```

Do not use the separate API test database while the composed harness is running.
Keep local test authentication material out of artifacts. Existing test schemas
are disposable; no production database is involved.

The native runner retains absolute workspace and temporary paths to identify the
actual run. At the pinned source, place `native-route` files under
`/tmp/b2b-route-proof-v9` and prepare the exact driver/browser runtime described in
`runtime/README.md` at `/tmp/b2b-route-browser-setup`. Those runtime directories
are not product dependencies. The existing image/seccomp must be available.

```bash
node /tmp/b2b-route-proof-v9/build.mjs
bash /tmp/b2b-route-proof-v9/run.sh
```

This tests real composed root components and native browser storage with synthetic
read DTOs and context signals. It is not the complete live-authentication QA matrix.
