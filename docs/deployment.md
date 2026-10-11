# Build the demo or operate your own instance

The repository is a software distribution, not a hosted account service. Its default build is a static **demo** with browser-local data. It needs no API, PostgreSQL, payment account, analytics collector or operator credentials. An **instance** is an explicit build owned and configured by its operator; its users, database, invitations and public information belong to that instance.

This guide describes B2C deployment and shared CI. The independent gym product
has its own [B2B deployment and coordinated upgrade procedure](b2b.md#instancia-independiente),
[production-runtime smoke](b2b-runtime-validation.md) and [recorded release evidence](b2b-release.md).
For the VPS-to-Mac handoff, start with [the macOS workspace guide](development-macos.md).

## Reproduce the default demo

Use Node 24+ and the package manager pinned in `package.json`:

```sh
corepack enable
corepack prepare pnpm@12.7.0 --activate
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:demo
pnpm --filter @klisteniapp/b2c-web preview --host 127.0.0.1
```

`pnpm dev:demo` starts the demo without a backend. Unit checks do not require a database; integration cases which require `TEST_DATABASE_URL` are skipped when it is absent. Browser checks require the matching Playwright browser installation. See the root README for asset acquisition and licensing requirements before rebuilding anatomical assets; validation does not grant additional redistribution rights.

The public `.gitlab-ci.yml` is the conventional entry point and includes
`.gitlab/pipeline.yml`, which defines the validation jobs. The pipeline conditionally
includes `.gitlab/runner.yml` for the optional runner tag.

It runs `quality` by default: lint, type checks, unit tests without a database, preview/source integrity checks, anatomical asset validation, the demo build, and publication/privacy audits. It retains the reviewed demo artifact for seven days. This path launches no Chromium, PostgreSQL service or preview renderer. The configuration has no project-path restriction, required runner tags, private endpoints, registry authentication, image publishing or deployment job; operator publication and runtime smoke checks remain in the operator's private pipeline. The retained pinned images target Linux amd64; forks need a container-capable runner for that platform (or compatible emulation).

**October 11 handoff:** full preview regeneration and validation are deferred by
the project owner until the Blender assets are ready. `pnpm check`, `check:all`,
`check:release` and CI `quality` still require `previews:check`; no full green gate
is claimed. Code, builds and local production-runtime results are recorded
separately in the release guide. Building the demo above is not a release check.
The merge to `main` does not publish an image or deploy a service.

Jobs use untagged runners by default. If your runner only accepts tagged jobs, set the project CI/CD variable `KLISTENI_CI_RUNNER_TAG` to one of its tags (plain text, available to the branches you validate). This conditionally includes `.gitlab/runner.yml`; the actual installation's tag stays in project settings. Leave the variable unset when untagged jobs are supported. See [GitLab's conditional includes](https://docs.gitlab.com/ci/yaml/includes/#include-with-rulesif).

Heavy suites are explicit opt-ins under **Build > Pipelines > New pipeline** (called **Run pipeline** in some GitLab versions). Select `RUN_BROWSER_TESTS=true` for the complete Playwright/WebGL suite and analytics checks, and/or `RUN_API_INTEGRATION_TESTS=true` for API integration and account browser tests. Both default to `false` and require a pipeline whose source is `web`; push, merge-request, tag-push, scheduled and API-triggered pipelines do not run them, even if a project/group variable is set to `true`. Selected suites remain required: a failure fails that validation pipeline. They run after quality, with browser before integration when both are selected; a shared resource group prevents these heavy jobs from overlapping across pipelines in this project. This does not reserve CPU or memory against other projects, so only opt in when runner capacity is available.

`RUN_B2B_INTEGRATION_TESTS=true` independently opts into the gym API and browser
matrix, under the same manual-pipeline rules and shared resource group. It starts
its own disposable PostgreSQL with `B2B_TEST_DATABASE_URL`; never use the B2C or
a deployed database for this job. All opt-in suites depend on `quality`, including
its outstanding preview check.

The same suites remain available locally with `pnpm test:e2e`, `pnpm test:analytics`, and, against disposable test databases, `pnpm test:api` / `pnpm test:accounts` for B2C and `pnpm test:b2b:api` / `pnpm test:b2b:e2e` for B2B. Keep their results with release evidence for changes to 3D, browser behavior or account persistence. A default green pipeline proves its quality/build checks; it does not claim those opt-in suites ran. `pnpm check:release` runs the full sequence serially with distinct disposable B2C/B2B URLs and no browser retries; it also requires current previews. The Docker runtime smoke and physical-device acceptance are separate checks.

The API integration job starts its own disposable PostgreSQL service before running `pnpm test:api` and `pnpm test:accounts`. The test credentials in CI are disposable fixtures. Never replace `TEST_DATABASE_URL` with a real account database or add instance secrets to the public project.

## Static container

Container definitions are grouped under [`docker/`](../docker/README.md).
Run builds from the repository root with the explicit `-f` path; the build context
remains `.`.

`docker/b2c-web/Dockerfile` packages an already built `apps/b2c-web/dist`. It does not build source, inject runtime credentials or select an instance automatically. This makes the reviewed build artifact the container's input:

```sh
pnpm build
# Optional: supply --build-arg OCI_REVISION=<reviewed-commit> for traceability.
docker build --platform linux/amd64 -f docker/b2c-web/Dockerfile -t klisteni-web:local .
docker run --platform linux/amd64 --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m \
  --cap-drop ALL --security-opt no-new-privileges \
  -p 127.0.0.1:8080:8080 klisteni-web:local
```

Open `http://127.0.0.1:8080`. Nginx runs as UID/GID 1000, serves `/healthz`, and needs no persistent volume. Only hashed `/assets/*` use immutable caching; stable filenames are revalidated. Missing assets return 404. SPA routes such as `/privacy` return the web entry point. `/api/*` returns JSON 503 until the operator adds a same-origin API route; `/umami/*` returns 404 and has no upstream.

Run the bounded image smoke without external services:

```sh
docker run --platform linux/amd64 --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m \
  --cap-drop ALL --security-opt no-new-privileges \
  --mount type=bind,src="$PWD/scripts/ci/smoke-runtime.sh",dst=/tmp/smoke-runtime.sh,readonly \
  --entrypoint sh klisteni-web:local /tmp/smoke-runtime.sh
```

The smoke covers non-root startup, health, SPA fallback, asset headers, unavailable API and disabled analytics routes. Browser tests separately cover visual assets and behavior. A passing local image does not establish DNS, TLS, ingress or deployment health.

## Build an instance explicitly

Prepare your own public profile from `apps/b2c-web/instance-profile.example.json`. Everything in this JSON is public and will be embedded in the bundle; it must not contain database URLs, API tokens, passwords, private user lists or internal addresses. Keep the real file in your private operator workspace.

```sh
VITE_APP_MODE=instance \
KLISTENI_PUBLIC_PROFILE_FILE=/absolute/path/to/your-public-profile.json \
pnpm build
```

The default remains `demo`. The instance build requires the profile; deployment-time environment variables cannot change a previously compiled static bundle. Build the instance artifact and then package it with the same Docker command. The operator is responsible for public identity/contact/privacy information and any optional analytics configuration. The default nginx configuration includes no analytics proxy; configuring a frontend identifier alone does not provision a collector. No payment or health provider is activated by selecting instance mode.

Accounts require a separately provisioned API, database, migrations and first administrator. Follow [Accounts](accounts.md). A local opt-in Compose example is provided there; it is not production infrastructure.

## Operator deployment contract

Use your own private repository for deployment manifests, real public profiles, secret references, release records and recovery procedures. Keep actual secret values in a secret manager. `deploy/accounts.example.yaml` is a generic blueprint with deliberately incomplete image and host values; it does not create a database, TLS, ingress or policies for shared services.

The API should be routed under `/api` on the same HTTPS origin as the web, preserving the prefix. Disable caching for every API response, retain JSON errors, and enforce the 5 MiB request limit. An independent edge route keeps static content available if API DNS or readiness fails. `docker/api.conf.example` is an optional container-network proxy example that must be integrated explicitly and adapted to your network; it is not included by default.

Use `NODE_ENV=production`, a stable auth secret, a database/role dedicated to this instance, and `BILLING_MODE=disabled` until a separate sandbox verification is complete. Do not expose PostgreSQL or the API's internal port directly. A reverse proxy must overwrite any trusted client-IP header before the API is configured to accept it. SMTP is optional and needs the operator's relay. OAuth and automated health integrations are not implemented.

Release sequence:

1. Validate the exact source/profile and build web/API artifacts; retain immutable image digests in your private release record.
2. Verify your database, secret injection, ingress, network policy and capacity.
3. If data already exists, make a protected recovery copy of this instance's database and prove restoration into a separate database.
4. Execute `node apps/b2c-api/src/migrate.ts` with the intended API image and configuration. Migrations are explicit; API startup does not run them.
5. Promote the API, verify `/api/healthz` and `/api/readyz`, then promote the matching web.
6. Check anonymous local use, account isolation, session recovery, invite/trial/lifetime behavior, expired-account export, and actual runtime readiness. Record observed results, not only CI success.

Always finish migrations before starting API processes. If an API started against an empty or incomplete schema, restart it after migration: Better Auth caches a schema mismatch for that process. `/api/healthz` may remain 200 while `/api/readyz` returns 503 even after the tables exist. Readiness includes authentication availability, so a successfully migrated and restarted API must return 200 before receiving traffic. The PostgreSQL regression in `apps/b2c-api/tests/readiness.test.ts` covers this startup order.

A web rollback can use a compatible previous artifact while preserving the origin for browser-local data. An API downgrade does not undo a database migration and must preserve current JSON fields, including health data. For incompatible failures, stop instance writes and prefer a forward fix or restore into a separate database before changing the runtime connection. Do not restore over an existing database as a test or change unrelated services. See [recovery details](accounts.md#recovery).
