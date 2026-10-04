# Iterate on the full local application

Run this from the repository with Node 24+, pnpm and Docker running:

```sh
node scripts/dev-ui-instance.mjs
```

Open `http://127.0.0.1:4192` in the embedded browser. This starts the instance
frontend with hot reload, the actual API with file watching, and an isolated
PostgreSQL container. A fictional administrator (`ui-admin@example.test`) has
lifetime access so account, planning, health and administration screens are
available. The generated password is in `.cache/ui-instance/login.private.json`;
use it only in this local instance. No email or payment provider is configured.

The launcher reuses `deploy/compose.local.yaml` for the database. The dedicated
Compose project `klisteni-ui` keeps its own database volume; PostgreSQL binds to
loopback port 54329, API to 3001, web to 4192. It cannot use production account
credentials or a deployed database. Existing fixture data survives a restart.
Private generated files under `.cache` and `deploy/.env` are ignored by Git.

Close an older preview occupying 4192 before starting. If a port is occupied,
the service fails visibly; do not stop unrelated processes. Ctrl-C stops web
and API and leaves the database container and volume available. To stop only this
database:

```sh
docker compose -p klisteni-ui --env-file deploy/.env \
  -f deploy/compose.local.yaml -f .cache/ui-instance/compose.yaml \
  --profile instance stop db
```

Do not add volume deletion options unless intentionally discarding all local
practice.

For database preparation without starting web/API, pass `--prepare`. To inspect
the API, use `/api/healthz` for liveness and `/api/readyz` for schema/database
readiness. A successful local check says nothing about the public deployment.

## Settings and initial setup

The header gear opens a single Settings dialog. Its sections are Account and
planning, Appearance, Privacy, Data, and Initial setup. Account identity and cloud
access are shown inside Account and planning; Data contains full account export
and backup import. Anonymous users can still export their local data. Privacy
preferences and the policy link are available in Privacy.

Initial setup guides an optional body profile review and measurement. It can be
replayed without deleting existing health records or goals. Saving each step is
explicit; skipping a step leaves its saved data unchanged. Switching settings
sections or visiting the privacy policy keeps drafts in memory. Closing the
dialog or reloading discards unsaved drafts. Concurrent changes require review
before an older draft can be saved.

## Appearance and languages

Open Settings → Appearance to select Spanish, English or French, a color palette, and Light,
Dark or System mode. The six palettes are Sage, Ocean, Sunset, Lavender, Rose and
Graphite; each card previews both its light and dark versions. Palette and mode
are independent, so System follows the device appearance while keeping your
chosen colors. The UI updates immediately; the status
message confirms saving. Signed-in choices are saved in the account profile
through the normal revision-checked API and restored after reload or on another
device. Anonymous choices stay in browser storage and portable personal exports.
Older exports and clients remain compatible; omitted appearance fields preserve
the account's existing choices and health records.

Palette tokens live in `apps/web/src/themes.css`; picker names, descriptions and
preview swatches live in `apps/web/src/lib/color-themes.ts`. The optional
`profile.colorTheme` field travels through the same revision-checked settings
flow as language and mode. Accounts and older backups without a palette keep the
browser choice, or default to Sage on a fresh device.

Translation catalogs live in `apps/web/src/i18n/locales/{en,fr}`. Spanish source
strings serve as readable fallback keys; use the component's namespace and
interpolation variables for dynamic text. User-authored values and operator
disclosures are preserved. The extensive educational exercise explanations and
some detailed validation messages still use their original Spanish text.
