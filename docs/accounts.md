# Optional instance accounts

The public demo works without accounts or a server. An operator can explicitly build an **instance** and run the API to add invitation-based accounts, sessions, synchronized training and health data. This guide is a reproducible configuration path, not evidence that a hosted service exists. Each operator supplies their own database, secrets, users and policies.

## Storage and boundaries

| Data | Location |
| --- | --- |
| Demo preferences, training and health data | Browser-local storage; export/import remains available |
| Instance profile, plans, routine/history and optional health records | PostgreSQL, scoped to the authenticated account |
| Revocable session | HttpOnly cookie; SameSite=Lax, Secure in production; database session record |
| Unconfirmed account operations | Local queue associated with that account until confirmed or resolved |
| Workout in progress | Current tab memory; it is not automatically resumable on another device |

The API derives ownership from the authenticated session; a client cannot select another owner's user ID. Passwords are hashed by the authentication provider. Operators with database access can read stored data; this is not end-to-end encryption. Analytics is optional and separate from personal records; the default demo has no analytics configuration.

The current account export is `PersonalData` version 2 with `ProgressData` version 1. Account settings have revision checks; stale writes produce a conflict. Independent training records use stable IDs and tombstones so retries cannot restore deleted workouts. Health is optional `settings.health`, with explicit units, origins and timestamps. Its whole-object update requires the expected revision and has a 4 MiB stored-state limit inside a 5 MiB API request limit. Health import rejects conflicting source identities; health records do not yet have an incremental provider-sync protocol. See [health import](health-import.md) and [health synchronization proposal](health-sync.md).

## Local instance with disposable configuration

Requirements: Node 24+, pnpm 12.7.0, Docker with Compose and Linux amd64 support (native or emulated for the pinned API image). This example creates a dedicated local PostgreSQL volume and a non-superuser application role. It does not connect to a deployed database or send mail. Payments remain disabled. It intentionally uses HTTP and `NODE_ENV=development`, so it is only for local use.

From the repository root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
node deploy/init-local-env.mjs
# Generates deploy/.env with random secrets and mode 0600; refuses to replace it.
docker compose --env-file deploy/.env -f deploy/compose.local.yaml --profile instance up -d db
docker compose --env-file deploy/.env -f deploy/compose.local.yaml --profile instance run --rm migrate
docker compose --env-file deploy/.env -f deploy/compose.local.yaml --profile instance up -d api
```

PostgreSQL has no published port. The API is bound to `127.0.0.1:3001`. The database initialization SQL runs only when the dedicated volume is empty; changing `.env` does not rotate an existing role password. Keep the file while retaining that volume. API startup does not migrate it automatically.

Run migration before starting the API. If the API was already running against an empty or incomplete schema, restart it after migration. Authentication retains that schema error in memory; `/api/readyz` correctly stays 503 until the process restarts, even when `/api/healthz` is 200 and the tables are present.

Start the frontend separately with a public profile based on the example:

```sh
VITE_APP_MODE=instance \
KLISTENI_PUBLIC_PROFILE_FILE="$PWD/apps/web/instance-profile.example.json" \
pnpm --filter @klisteniapp/web dev --host localhost
```

Open exactly `http://localhost:5173`, matching the Compose `APP_ORIGIN`. Vite's instance proxy connects to the local API. `localhost` and `127.0.0.1` are different browser origins. For a different origin or API port, change the operator configuration and frontend proxy together.

Create the first administrator using an explicit temporary invitation:

```sh
docker compose --env-file deploy/.env -f deploy/compose.local.yaml --profile instance exec api \
  node apps/api/src/operator.ts bootstrap --email admin@example.test --name Administrator --show-link
```

The displayed link is a credential: open it in your local browser, choose a password, and keep it out of logs, issues and screenshots. No email is sent. A real installation uses the administrator's own address and optionally `--send-email` after SMTP is configured. Bootstrap refuses to create another administrator when one already exists; `--reissue` explicitly replaces a still-pending bootstrap invitation.

Check readiness:

```sh
curl --fail http://127.0.0.1:3001/api/healthz
curl --fail http://127.0.0.1:3001/api/readyz
```

Stop only these containers with `docker compose --env-file deploy/.env -f deploy/compose.local.yaml --profile instance down`. This preserves the named volume. Adding `--volumes` deletes this local database permanently; use it only when intentionally discarding the local instance.

Alternatively, provide your own local PostgreSQL database/role, copy `apps/api/.env.example` to `apps/api/.env`, set real local values, then run `pnpm --filter @klisteniapp/api migrate` and `pnpm --filter @klisteniapp/api dev:configured`. For the unified development environment with automatic migrations and fictional accounts, use [the root Compose + Turbo setup](development.md). `pnpm dev` now runs all apps; `pnpm dev:demo` serves only the browser demo.

## Invitations and access

The administrator can invite a specific email, create a shared invitation with an expiry and signup quota, suspend accounts, revoke sessions, and issue password recovery. A directed invitation lasts 24 hours; password recovery lasts one hour. Tokens are single-use, hashed in PostgreSQL and carried in a URL fragment removed by the frontend. Merely opening or previewing an invitation does not consume it.

Public signup is disabled; shared invitations allow signup only within their quota and expiry. The 15-day cloud trial starts when the account is created. Lifetime cloud access is separate from the administrator role. Expired accounts retain read/export/delete access; new cloud writes require active access. The local demo stays available. [Subscription behavior](subscriptions.md).

An administrator can manage access but has no API for reading another account's personal progress. The last enabled administrator cannot be suspended. Password changes/recovery invalidate relevant sessions and outstanding recovery links. Public password recovery always returns the same confirmation, regardless of account existence.

## Server configuration

At minimum set `DATABASE_URL`, `BETTER_AUTH_SECRET` (random, at least 32 characters), and `APP_ORIGIN` (exact browser origin without a trailing slash). Production requires HTTPS and `NODE_ENV=production`. Container APIs use `HOST=0.0.0.0`; host-local development defaults to `127.0.0.1`. Keep the auth secret stable across replicas and restarts.

Provision an application database and role with no superuser, role creation, database creation, replication or row-security bypass rights. Keep database ports private. The migration process needs DDL rights only in this instance's database; application operators must not grant access to unrelated databases. Use a secret manager for database/auth credentials; never put them in `VITE_*`, the public profile, images or tracked environment files.

`GET /api/healthz` checks process liveness; `GET /api/readyz` checks database connectivity, prepared schema and authentication availability. Deploy `/api` under the same public origin, preserve its prefix, disable all API caching and never return SPA HTML for an API failure. Configure network policies according to your environment, including both API egress and database ingress. The generic [Kubernetes blueprint](../deploy/accounts.example.yaml) does not provision network/TLS/database resources.

The API ignores forwarded client-IP headers by default. Only configure `TRUSTED_CLIENT_IP_HEADER` after proving that the trusted proxy overwrites it and the API port cannot be reached around that proxy. Otherwise a client could supply a forged header. Keeping the default may group clients behind the same proxy for rate limiting.

Optional SMTP variables are `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM`. Port 587 requires STARTTLS with certificate verification; 465 uses TLS immediately. Without SMTP, manual invitation links and existing sessions still work. SMTP acceptance means the relay accepted the message, not that it arrived in an inbox.

`BILLING_MODE=disabled` is the default and is fixed off in local Compose. Sandbox billing needs separately provisioned test credentials and HTTPS; see [subscriptions](subscriptions.md). Selecting instance mode activates neither payments nor OAuth/health connections.

## Recovery

Account export/import is personal portability, not database recovery. Before a migration affecting existing data, retain a protected copy of this instance's PostgreSQL database and verify it by restoring into a new, isolated database. Store connection credentials outside shell arguments and reports. Validate schema, accounts, revisions, training records and tombstones on the restored copy.

If a release fails, stop instance writes and retain sanitized evidence. A previous API image may be incompatible with newer JSON fields even when SQL tables are unchanged. Older code that omits health can erase it on a settings write, so check compatibility before downgrading. Prefer a compatible forward fix. If restoring is necessary, restore into a separate database and compare before changing the runtime connection. A recovery copy loses later writes; make that interval explicit. Do not erase the failing database or alter unrelated services as part of this procedure.

## Verification

```sh
pnpm --filter @klisteniapp/api lint
pnpm --filter @klisteniapp/api typecheck
pnpm --filter @klisteniapp/api test
```

Without `TEST_DATABASE_URL`, PostgreSQL integration cases are skipped; passing unit tests does not prove database behavior. To validate them, point that variable at an explicitly disposable test database and run `pnpm test:api` and `pnpm test:accounts`. Never use an instance database for these commands. Tests create and remove isolated schemas. Account browser tests use local ports 4181/4182 and must not run concurrently with another suite writing the same frontend build directory.

Before opening an instance to users, verify account isolation, revoked/expired sessions, invitation limits, recovery, stable retry IDs, revision conflicts, deletion behavior, timezone boundaries, browser export/import, and failure visibility when the API is down. Check the deployed origin, TLS/cookie settings, readiness and recovery evidence separately. Local checks do not establish a live deployment or provider integration.
