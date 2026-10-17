# Inactive White Label public-route HTTP boundary regression

Base: `89409dcdbd4faedccfeec8ee236932191c6195d3` in
`/workspace/klisteniapp`, with the uncommitted test-only change captured in
`source.patch`. This worker changed only
`scripts/b2b-product-composed-harness.test.mjs`; App and brand-hook changes are
owned by the parent. No API/server, seed, QA, contract or runtime configuration
changes, commit or push were made.

## Added assertions

- In both unified HTTP and White Label HTTP, authenticated inactive bootstrap
  remains export-only with no branch-role choices; product access has no branch
  grants and only `export-own-records`. Personal export succeeds. Operational
  routines, own session history, own health and people return exact
  `403 CONTEXT_REVOKED`.
- In White Label HTTP, the known-host unknown-route document remains available
  as the SPA HTML, while the public hook's actual cookie-only `/context` request
  returns exact `403 CONTEXT_REVOKED` for the bound inactive session. Anonymous
  context on that same known host still returns its public identity.
- The unknown host returns `421 DOMAIN_UNAVAILABLE`. An Atlas cookie manually
  presented to the other brand or the same-brand alias returns
  `401 BRAND_SESSION_REQUIRED`.
- Removing only the disposable actor's session binding while preserving its
  authenticated session and membership makes context, bootstrap and access all
  return `401 BRAND_SESSION_REQUIRED`. `finally` restores every original binding
  column, including `created_at`, and a subsequent cookie-only context request
  again returns `403 CONTEXT_REVOKED`.

The existing three cases, fixture-preservation digests, synthetic duration
publication/session validation and inactive-foundation checks remain intact.

## Executed validation

Used Node `v24.19.0`, pnpm `12.7.0`, and the parent's existing private synthetic
`klisteni-integration-postgres` through its credential-safe runner. No database
credentials, cookie values or auth headers are retained here. Each harness run
creates and drops its own disposable schemas and closes its HTTP servers.

```sh
source /workspace/.onboarding/activate.sh
node /tmp/b2b-reviewed-duration-fixture-validation/run-composed.mjs
pnpm exec prettier --check scripts/b2b-product-composed-harness.test.mjs
pnpm exec eslint scripts/b2b-product-composed-harness.test.mjs
git diff --check -- scripts/b2b-product-composed-harness.test.mjs
```

Final result: **3 passed, 0 failed, 0 skipped**, in `composed-final.log` with exit
status `0`. Formatting, ESLint and diff checks also exited `0`; their raw logs
and status files are retained. `composed.log` preserves the first successful run
before adding exact timestamp restoration; it is not relabelled as the final run.

`source.patch` and `SHA256SUMS` identify the final test and captured artifacts.

## Limits

These are real local HTTP/API/database authorization checks using synthetic data.
They do not render App, prove the 404 UI or navigation recovery, rerun the full
browser matrix, or establish HTTPS trust or deployment acceptance. The parent
owns frontend/hook validation and QA handoff. The separate immutable QA runtime
was not used or modified.
