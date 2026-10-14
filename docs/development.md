<a id="desarrollo-local-todas-las-apps"></a>

# Local development: all applications

From repository root, with Node 24+, pnpm 12.7.0 and Docker running.

Shared formatting configuration is `.prettierrc.json`, automatically recognized by
Prettier/editor integrations. `pnpm format:b2b` and `pnpm format:b2b:check` retain
current B2B scope; adopting formatting elsewhere is separate work. B2B API override
retains semicolons. Prepare a new checkout once:

```sh
pnpm install --frozen-lockfile
pnpm setup:dev
```

Then use two root terminals:

```sh
# Terminal 1: B2C and B2B PostgreSQL
docker compose up
```

```sh
# Terminal 2: all four apps and the B2B gateway
pnpm exec turbo run dev
# Also: turbo run dev if Turbo is available in PATH, or pnpm dev.
```

No `-f`, profiles, exported variables or manual migrations required. Turbo prepares
environment, waits up to 60 seconds per DB, migrates/seeds fictional accounts before
APIs start. Later starts retain credentials/records/media. Turbo may start while
Compose finishes DB startup.

| Application/service | Address |
| --- | --- |
| B2C accounts/local administrator | http://127.0.0.1:5173/ |
| B2B entry | http://127.0.0.1:4200/ |
| B2B gym management | http://127.0.0.1:4200/manage |
| B2B member | http://127.0.0.1:4200/app |
| Atlas / Sur website | http://127.0.0.1:4200/g/atlas-demo · http://127.0.0.1:4200/g/sur-demo |
| B2C API / readiness | http://127.0.0.1:3001/api/readyz |
| B2B API / readiness | http://127.0.0.1:4201/api/b2b/readyz |
| B2B Vite (member/management) | `4210` (navigate/login through gateway) |
| B2C / B2B PostgreSQL | `127.0.0.1:54331` / `127.0.0.1:54332` |

Use listed `127.0.0.1` origins for consistent sessions/origin validation. All services
listen on loopback.

<a id="configuración-y-cuentas"></a>

## Configuration and accounts

`pnpm setup:dev` generates random secrets with private permissions, retaining
existing files. Turbo also runs this automatically. Generated Git-ignored files:

- `.env`: root Compose credentials; retain alongside its volumes.
- `apps/{b2c-api,b2b-api,b2c-web}/.env.development.local`: local configuration.
- `.cache/dev/b2c-login.private.json`: B2C administrator email/password, local lifetime cloud access.
- `.cache/dev/b2b-demo.private.json`: Atlas/Sur accounts, generated after B2B DB setup.
- `.cache/dev/b2b-password.env`: shared fictional B2B account password.
- `.cache/dev/media`: local B2B uploads.

Development API loads only this local configuration. Inherited terminal credentials,
providers/destinations do not change DBs. Billing/SMTP disabled. B2C uses example
public profile; Vite development settings do not enable accounts in production
builds. `start`, `migrate` and operator commands retain usual explicit configuration;
automatic environment belongs to `dev`. To develop API with own `.env`, use
`dev:configured`.

Conflicting generated file makes setup fail with variable name, without printing
value/replacing file. Do not regenerate credentials while retaining a DB initialized
with other passwords. DBs own volumes in `klisteni-dev` Compose project; earlier
`deploy/` helpers retain separate environments. Do not run helpers sharing API/Vite ports simultaneously.

<a id="detener-y-volver-a-arrancar"></a>

## Stop and restart

Ctrl-C in Turbo stops apps; Ctrl-C in Compose stops DBs. Data retained. Background DBs:

```sh
docker compose up -d --wait
pnpm dev
```

Later stop: `docker compose stop`. `docker compose down` removes containers/network,
retains volumes. **`docker compose down -v` deletes environment DBs**; unnecessary
for restart. B2C demo without accounts/Docker:

```sh
pnpm dev:demo
```

Specialized `pnpm dev:b2b` and `node scripts/dev-ui-instance.mjs` helpers remain
available for isolated environments.

For another device while Mac is off, follow [VPS handoff/private tunnels](development-vps.md).
Listed URLs describe current single-origin setup. Brand domains/themes/multiple
branches from first delivery are implemented in [white-label B2B](b2b-white-label.md).
Its HTTPS suite owns disposable environments; read [setup/TLS trust](b2b-white-label-runtime.md)
and current no-bypass guidance before execution. Do not activate earlier mode
against a DB already containing domains/multiple branches.
