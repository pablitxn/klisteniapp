# Build the demo or operate your own instance

The repository is a software distribution, not a hosted account service. Its default build is a static **demo** with browser-local data. It needs no API, PostgreSQL, payment account, analytics collector or operator credentials. An **instance** is an explicit build owned and configured by its operator; its users, database, invitations and public information belong to that instance.

## Reproduce the default demo

Use Node 24+ and the package manager pinned in `package.json`:

```sh
corepack enable
corepack prepare pnpm@12.7.0 --activate
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm --filter @klisteniapp/web preview --host 127.0.0.1
```

`pnpm dev` also starts the demo without a backend. Unit checks do not require a database; integration cases which require `TEST_DATABASE_URL` are skipped when it is absent. Browser checks require the matching Playwright browser installation. See the root README for asset acquisition and licensing requirements before rebuilding anatomical assets; validation does not grant additional redistribution rights.

The public `.gitlab-ci.yml` runs quality checks and browser tests with generic container images. It has no project-path restriction, required runner tags, private endpoints, registry authentication, image publishing or deployment job. The retained pinned images target Linux amd64; forks need a container-capable runner for that platform (or compatible emulation). Software-rendered 3D browser tests need sufficient CPU and memory; capacity is an operator concern rather than a dependency on a particular runner installation.

Jobs use untagged runners by default. If your runner only accepts tagged jobs, set the project CI/CD variable `KLISTENI_CI_RUNNER_TAG` to one of its tags (plain text, available to the branches you validate). This conditionally includes `.gitlab/runner.yml`; the actual installation's tag stays in project settings. Leave the variable unset when untagged jobs are supported. See [GitLab's conditional includes](https://docs.gitlab.com/ci/yaml/includes/#include-with-rulesif).

API integration is opt-in: run a pipeline with `RUN_API_INTEGRATION_TESTS=true`. It starts a disposable PostgreSQL service in that job, then runs `pnpm test:api` and `pnpm test:accounts`. The test credentials in CI are disposable fixtures. Never replace `TEST_DATABASE_URL` with a real account database or add instance secrets to the public project.

## Static container

`Dockerfile` packages an already built `apps/web/dist`. It does not build source, inject runtime credentials or select an instance automatically. This makes the reviewed build artifact the container's input:

```sh
pnpm build
# Optional: supply --build-arg OCI_REVISION=<reviewed-commit> for traceability.
docker build --platform linux/amd64 -t klisteni-web:local .
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

Prepare your own public profile from `apps/web/instance-profile.example.json`. Everything in this JSON is public and will be embedded in the bundle; it must not contain database URLs, API tokens, passwords, private user lists or internal addresses. Keep the real file in your private operator workspace.

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
4. Execute `node apps/api/src/migrate.ts` with the intended API image and configuration. Migrations are explicit; API startup does not run them.
5. Promote the API, verify `/api/healthz` and `/api/readyz`, then promote the matching web.
6. Check anonymous local use, account isolation, session recovery, invite/trial/lifetime behavior, expired-account export, and actual runtime readiness. Record observed results, not only CI success.

A web rollback can use a compatible previous artifact while preserving the origin for browser-local data. An API downgrade does not undo a database migration and must preserve current JSON fields, including health data. For incompatible failures, stop instance writes and prefer a forward fix or restore into a separate database before changing the runtime connection. Do not restore over an existing database as a test or change unrelated services. See [recovery details](accounts.md#recovery).
