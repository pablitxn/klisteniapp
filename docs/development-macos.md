<a id="continuar-el-trabajo-en-macos"></a>

# Continue work on macOS

VPS handoff **October 11, 2026**, `codex/b2b-first-delivery`; main integration retains
code/docs commits. Continue from updated `main`. Mac-off refactor:
[VPS development](development-vps.md). [Roadmap](roadmap-implementacion.md)/
[white-label plan](b2b-white-label.md) define domains/permissions/themes/multi-branch
first delivery. Backend/frontend/tests can advance VPS; Blender authoring local.
Publish new local checkpoint before transferring hosts.

<a id="traer-el-repositorio"></a>

## Retrieve repository

New checkout with GitLab SSH configured:

```sh
git clone --origin gitlab ssh://git@gitlab-ssh.orchid-labs.xyz:32222/orchid-labs/homelab/klisteniapp.git
cd klisteniapp
git switch main
git pull --ff-only gitlab main
```

Existing Mac: preserve local changes before updating main; use `git remote -v`
name (`origin` without `--origin gitlab`). New change branch from main, e.g.
`git switch -c codex/b2b-white-label`.

Git transports sources/lock/models/versioned derivatives/Blender/docs/sanitized
runtime report, not node_modules/dist/cache/DB/uploads/VPS credentials. Install/
reseed demo; no private env copies. Personal browser data uses JSON export. B2B
instance transfer needs [DB/media backup](b2b.md#backup-y-restauración), separate from code.

<a id="dependencias-y-primer-arranque"></a>

## Dependencies and first start

All-app [unified setup](development.md): once `pnpm setup:dev`, then two terminals
`docker compose up`, `pnpm exec turbo run dev`; `pnpm dev` full-start alias.
**Node 24+/pnpm12.7.0** pinned package.json. Docker/Compose for B2B; Blender authoring
only, web uses tracked assets.

```sh
node --version
pnpm --version
docker compose version
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev:b2b
```

With Node/Corepack available, prepare `corepack prepare pnpm@12.7.0 --activate`,
shims enabled. Keep lockfile on new machine.

| Screen | Local address |
| --- | --- |
| B2B entry | `http://127.0.0.1:4200/` |
| Gym staff | `http://127.0.0.1:4200/manage` |
| Member | `http://127.0.0.1:4200/app` |
| Atlas | `http://127.0.0.1:4200/g/atlas-demo` |
| Sur | `http://127.0.0.1:4200/g/sur-demo` |

Helper prepares PostgreSQL/migrates/seeds both gyms. Accounts
`.cache/b2b/demo.private.json`, generated `B2B_DEMO_PASSWORD` in
`.cache/b2b/local.env`; local/private, never commits/captures. Repeat retains demo.
Reserved4200 entry/4201 API/4210 Vite/54330 DB. Ctrl-C stops apps/retains DB.
Stop DB without deleting:

```sh
docker compose --env-file .cache/b2b/local.env -f deploy/compose.b2b.yaml stop db
```

Loopback QR cannot reach Mac from phone; physical scan on accessible HTTPS per
[B2B guide](b2b.md). B2C `pnpm dev:demo`5173/no backend; fictional accounts through
`node scripts/dev-ui-instance.mjs`/[guide](ui-iteration.md), independent DB/session.

Environment/smoke checked Linux VPS, first macOS startup pending. Pinned images/
visual snapshots need host architecture evaluation; Linux not native Apple Silicon
proof. Review images before platform snapshot updates.

<a id="qué-retomar-en-blender"></a>

## Resume Blender

1. Pilot machine/measurements/references/reviewer. Reusable model/physical-unit IDs distinct from 3D file.
2. Editable source/static GLB/fallback image/orientation/provenance. Shared first asset:
   `assets/blender/equipment/<id>.blend`, `packages/model-assets/public/models/equipment/`;
   private gym content in B2B library.
3. Binary check before upload:

   ```sh
   pnpm equipment:check /ruta/maquina.glb --poster /ruta/maquina.png
   ```

   Self-contained GLB 2≤24 MiB/no animation-skins-extensions-external resources,
   internal PNG/JPEG. No scale/technique/visual certification.
4. Upload management/associate model-unit/review-publish; card/QR text-image without WebGL.
5. First machine movement: reviewed poses/contacts/phases/cameras. Explicit supported
   runtime movements; **no general Blender→app-animation importer**. Static GLB
   creates no animated exercise. Yoga workshop exports runtime→Blender.
6. Second visual case before generalizing. Preview regeneration/review **after asset
   stabilization**, roadmap B4; handoff does not request thumbnail redo.

<a id="dónde-continuar-el-código"></a>

## Code entrypoints

| Change | Entry |
| --- | --- |
| Readiness/inventory/publication/QR | [B2B features](../apps/b2b-web/src/features) |
| Routine/drafts/logging/history/website | [Member features](../apps/b2b-web/src/features) |
| Permissions/persistence/migration/media | [B2B API](../apps/b2b-api/README.md) |
| Contracts/rules/package boundaries | [Architecture](architecture.md), [B2B](b2b.md#componentes-y-límites) |
| Models/provenance | [Shared assets](../packages/model-assets/README.md) |
| Viewers/supported movements | [Anatomy viewer](../packages/anatomy-viewer/README.md), `packages/geometry`, `packages/catalog-base` |

<a id="comprobaciones-y-evidencia-que-se-conserva"></a>

## Checks and retained evidence

Applicable code checks serially:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Disposable independent `TEST_DATABASE_URL` B2C/`B2B_TEST_DATABASE_URL` B2B;
missing-variable skips are not coverage. Browser:

```sh
pnpm --filter @klisteniapp/b2c-web exec playwright install chromium webkit
# With B2B_TEST_DATABASE_URL configured in a private environment:
pnpm test:b2b:api
pnpm test:b2b:e2e
```

No concurrent suites building same frontends. [Browsers](b2b-browser-validation.md),
[release](b2b-release.md), [runtime](b2b-runtime-validation.md) full checks.
`508e9e1` code lint/types/tests/build/publication/real DB-browser evidence in release;
[runtime](validation/b2b-runtime-2026-10-11.json)8/8/clean tree/restore-cleanup. Later
docs do not establish another code revision tested.

**Known pending:** `pnpm check`, `check:all`, `check:release`, GitLab quality include
`previews:check`; full regeneration deferred. No passing full gate/automatic
publication-deploy. Later content closeout resolves check with actual assets,
no hash editing/weakened validators. Physical phone/public deployment not established
by this handoff; later release evidence retains its own scope.
