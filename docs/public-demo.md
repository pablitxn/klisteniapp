<a id="demo-local-e-instancia-propia"></a>

# Local demo and independent instance

<a id="clonar-y-ejecutar-sin-servicios-privados"></a>

## Clone and run without private services

Requirements: Node.js 24+ and pnpm 12.7.0. Installation downloads public-registry
dependencies; demo runtime then needs only static files. No PostgreSQL, credentials,
Blender, private repositories or submodule required.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev:demo
```

Default mode `demo`. Build/serve static distribution:

```sh
pnpm build:demo
pnpm --filter @klisteniapp/b2c-web preview --host 127.0.0.1
```

Output `apps/b2c-web/dist`. Publish **that directory**, with SPA fallback to
`index.html`, including models/previews/license notices. Do not publish full checkout,
`.env`, test directories or operational evidence. Subdirectory deployment also
requires routing configuration; example assumes site root.

`/privacy` works directly as static route without backend. No service worker:
local data use does not guarantee offline startup before files download.

<a id="un-recorrido-completo"></a>

## Complete walkthrough

1. Open **Mi rutina**, explore exercise/instructions. Switch skin/muscles/bones or
   use textual content without WebGL.
2. Customize exercises/sets, start session, record reps/save. Review **Mi progreso**.
3. Record walk/check minutes. Reload: both activities remain.
4. **Mi salud**: record measurement/sleep/own goal. Dashboard uses your records,
   without simulating another person's account/history.
5. Download copy through **Ajustes**, import another browser profile to move data.
   Importer accepts progress v1/personal v2; confirmed local import replaces local
   copy. Retain previous export for rollback.
6. **Mi salud → Importar** accepts [normalized health format](health-import.md),
   preview/confirmation. Native manufacturer ZIP/CSV needs conversion; no automatic
   watch synchronization in this version.

History starts empty. No fictional data seeded in storage/history overwritten on
upgrade. Existing `klisteniapp.progress.v1`, preferences, `klisteniapp.personal.v2`
keys retained. Unsaved forms/in-progress training not yet part of exported copy.

<a id="qué-cambia-entre-modos"></a>

## Differences between modes

| Feature | Default demo | Explicit instance |
| --- | --- | --- |
| Catalog/anatomy/previews | Included | Included |
| Local routines/progress/health/goals/backups | Free | Free without login |
| Session initialization/account screens | Absent from bundle | Enabled |
| PostgreSQL/cross-device saving | Unused | Configured backend required |
| Invitations/subscriptions | Unused | Backend; payments disabled by default |
| Analytics | Disabled module/no requests | Explicit public configuration/consent |
| Privacy | Local text without assumed operator/hosting | Operator profile built in |

Mode selected **at build time**. Cookie/API response/URL parameters/restored old
consent cannot activate account. Changing mode requires new build.

<a id="configurar-una-instancia"></a>

## Configure an instance

Generic server remains `apps/b2c-api`; operator installs DB/generates secrets/creates
users/chooses policies. Follow [accounts](accounts.md)/[deployment](deployment.md).
No dependency on a particular installation.

Create file outside repo from `apps/b2c-web/instance-profile.example.json`, replace
**all** examples. Public information, not credentials: operator identity/contact,
hosting/mail processing/account retention/backups/logs/analytics/update date.
Build validates it; Privacy displays text without API query.

```sh
export KLISTENI_PUBLIC_PROFILE_FILE=/absolute/path/to/public-profile.json
export KLISTENI_API_URL=http://127.0.0.1:3001
pnpm dev:instance
# Or a static distribution for that instance:
pnpm build:instance
```

`KLISTENI_API_URL` configures development proxy. Production operator configures
same-origin `/api` proxy; no private backend URL embedded in browser. Public profile
is bundled/readable by any visitor. Never put passwords/keys/cookies/tokens in it
or `VITE_*` variables.

Build alone enables neither Mercado Pago/mail/OAuth nor integrations. Providers
need separate configuration. Implemented payment adapter remains development-only.

<a id="verificar-antes-de-publicar"></a>

## Verify before publication

```sh
pnpm check
node scripts/audit-publication.mjs --self-test
pnpm audit:publication
pnpm --filter @klisteniapp/b2c-web exec playwright install chromium
pnpm test:e2e
```

Audit inspects publishable tree/asset metadata; script help also explains inspecting
built distribution. Does not replace vulnerability/dependency review. Instance
tests run separately against disposable DB, never real-user DB.

Operator indicators stored in policy outside public tree and passed with
`--private-patterns /absolute/path/outside-repository/policy.json`. Never copy them
into negative fixtures/example regex/split detector strings. With policy, auditor
statically reconstructs escaped literals/literal concatenations/literal arrays
using `join()`, never executing inspected code. No identifiers/arbitrary calls/
runtime values interpreted; parser-limit excess fails. Generic CI runs synthetic
auditor tests; operator rules require explicitly supplied external policy.

Public CI runs generic checks, without publishing images/deploying instances.
Public code excludes any operator's private configuration/credentials/runbooks/
recovery. Anatomical licenses accompany models/renders; code license does not replace them.
