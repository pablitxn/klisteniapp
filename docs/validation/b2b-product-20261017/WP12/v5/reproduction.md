# Reproduce v5 diagnostics

Use the pinned supported Playwright 1.63 runtime and seccomp procedure in
[the v4 reproduction](../v4/reproduction.md), with the exact executed application
`2d0df2797d7876070372bc7808d582604ca3bbf0`. R11 QA source is 8c191c0; R12 is ad488a0.
Do not substitute the later prepared source for those historical runs.

Build the actual B2B snapshot using its locked Vite CLI. Set the existing
activation/use-built flags, a private task-only disposable test database URL,
a fresh `/tmp/` output directory and the JSON reporter destination. Run from
`apps/b2c-web` in the official sandboxed nonroot container:

```sh
# R11; interrupted between completed cases after repeated real auth429.
node node_modules/@playwright/test/cli.js test \
  'b2b-product-(roles|history|programming).spec.ts' \
  --config=playwright.b2b-product-unified.config.ts \
  --project=product-chromium-430 \
  --grep-invert='B2BP-PROGRAMMING-(001|003|009)' \
  --timeout=45000 --max-failures=10 --reporter=list,json

# R12; completed at configured eight-failure cap.
node node_modules/@playwright/test/cli.js test \
  'b2b-product-(roles|health|inactive).spec.ts' \
  --project=product-chromium-430 \
  --grep-invert='B2BP-(HEALTH-(001|004)|INACTIVE-(001|008))' \
  --timeout=60000 --max-failures=8 \
  --config=playwright.b2b-product-unified.config.ts --reporter=list,json
```

For the transport-only disconnect probe, copy the exact committed
`gateway-disconnect-probe.mjs.txt` to the task runtime root as
`gateway-disconnect-probe.mjs`, alongside its clean `app/` snapshot. Run
`node gateway-disconnect-probe.mjs` there under the same locked Node24 runtime.
It imports the actual gateway, creates only ephemeral loopback HTTP listeners,
disconnects actual clients, records remaining synthetic upstream responses and
cleans up. It neither consumes product contracts nor qualifies a browser case.

The original final runner is unchanged and has not accepted these filtered
runs. Preserve failures and empty unrun cells. The next broad run needs the
parent's exact combined gateway/input/hash/width/adoption/invitation head and
an updated source/ancestor manifest. Trusted HTTPS still needs accepted inputs.
