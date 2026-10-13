<a id="continuar-el-desarrollo-en-un-vps-con-la-mac-apagada"></a>

# Continue development on VPS while Mac is off

Updated **October 11, 2026**, [roadmap](roadmap-implementacion.md)/[white-label](b2b-white-label.md)
code handoff. No VPS connection/setup/validation established by this document.
VPS runs Git/Codex/backend/PostgreSQL/headless browsers. Another SSH device needed;
Codex/remotes/downloads online. No app offline mode. Blender/WebGL visual/physical
phone review remains separate.

<a id="1-entregar-el-código-antes-de-apagar-la-mac"></a>

## 1. Deliver code before turning off Mac

Unified-setup/plan checkpoint reference: **remote `gitlab` main**. Ensure intended
changes committed/published, record **branch/remote/SHA**.

```sh
git status --short
git diff --stat
git branch --show-current
git remote -v
git rev-parse HEAD
```

Review untracked contents, absent from git diff. Explicitly select setup scripts/
config/docs. .env/cache/credentials/DB/media/node_modules not transported; generate
new VPS environment. Code publication starts neither remote Codex nor deployment.

Inspect VPS status/branch/remotes/preserve existing work. Fetch remote/switch published
branch or agreed-SHA worktree; verify HEAD before edits. No reset--hard/checkout
deletion/overwrite. If setup absent, finish handoff. One environment owns branch
at a time; close VPS checkpoint before Mac fetch/local review, no simultaneous branch edits.

<a id="2-preparar-una-sesión-persistente-y-revisar-recursos"></a>

## 2. Persistent session and resources

**Termius/SSH→VPS→tmux→Codex CLI**. Revalidate historical `code-klisteni` alias,
checkout/session. Current private config supplies host/user/path/alias.

```sh
# After connecting to the VPS through SSH, inside the selected checkout:
pwd
git status --short
node --version
pnpm --version
docker compose version
tmux ls
df -h .
free -h
docker system df
ss -ltn
```

Check processes/pnpm-Playwright caches/Docker access. Node**24+**, pnpm**12.7.0**,
retain package.json/lock/pinned images. Global runtime difference is not reason to
change project versions. Inventory before install; no global cleanup/SSH-VPN-firewall changes.

No suitable alias: owned `tmux new -s klisteni-white-label`, separate Codex/Compose/
Turbo windows. `Ctrl-b d`, `tmux attach -t klisteni-white-label`. SSH disconnect
retains tmux processes; VPS reboot requires restart. Verify Codex auth without
copying Mac secrets/sessions.

<a id="3-arrancar-el-entorno-propio-del-vps"></a>

## 3. Start owned VPS environment

After resource/dependency review, root:

```sh
pnpm install --frozen-lockfile
pnpm setup:dev
# In one tmux window:
docker compose up
# In another tmux window:
pnpm exec turbo run dev
```

[Unified setup](development.md) secrets/wait/migrate/seed before APIs. Keep private
files/volumes; no regenerated passwords against existing DBs. Accounts `.cache/dev/`.
Identify occupied-port owners before stopping. No old helpers sharing ports simultaneously.

<a id="4-abrir-las-webs-desde-otro-dispositivo"></a>

## 4. Open from another device

127.0.0.1 belongs to viewing device. Keep services loopback/private SSH tunnel;
substitute configured destination:

```sh
ssh -N -o ExitOnForwardFailure=yes \
  -L 127.0.0.1:4200:127.0.0.1:4200 \
  -L 127.0.0.1:5173:127.0.0.1:5173 USUARIO@HOST_SSH
```

Termius equivalent local forwards. Client `http://127.0.0.1:4200/manage`,
`http://127.0.0.1:4200/app`, `http://127.0.0.1:5173/`. No public DB/API exposure.
Resolve occupied ports/compatible origins; tunnel-only port change may break auth.
Loopback QR needs tunnel on viewing device.

Historical `pnpm test:b2b:wl:e2e` uses atlas.b2b.test/sur.b2b.test, **two browser
origins on same proxy/app**, local resolution/TLS, restricted CONNECT proxies.
[WL guide](b2b-white-label-runtime.md#dos-dominios-https-en-navegadores-reales)
records temporary CA/removal/proxy trust. Historical remote-device setup required
preserved host/origin/explicit test-CA trust. Current user rule prohibits new
trust changes/bypasses: adapt future runs to isolated HTTP or valid HTTPS/existing
trust. Earlier HTTP tunnel covers single-branch mode only. Two loopback routes/
curl header alone prove no domain-cookie/login/brand isolation.

<a id="5-implementar-y-validar-por-entregas"></a>

## 5. Implement and validate by delivery

Read [roadmap](roadmap-implementacion.md)/[new WL evidence](b2b-white-label-validation.md):
WL-0–WL-8 implemented/verified within authorized local scope. Follow [detailed plan](b2b-white-label.md).
Record SHA/commands/results/skips/pending per delivery. Applicable serial lint/
typecheck/test/build:b2b/test:b2b:api/test:b2b:e2e; shared changes need B2C builds/journeys.

`TEST_DATABASE_URL` and `B2B_TEST_DATABASE_URL` must point to disposable test
databases, independent from development and production. B2B b2b/test name/no options/
schema-create-drop; never dev URLs. Check Linux engine/libs before browser, necessary
setup per [matrix](b2b-browser-validation.md).

Historical HTTPS suite needed test DB/controlled WebKit CA. Current no-bypass rule
requires adaptation before new browser runs. Restore `pnpm test:b2b:wl:restore`,
explicit `B2B_WL_TEST_POSTGRES_CONTAINER`; [operation](b2b-white-label-runtime.md)
requirements/cleanup/commands. Prior suites retain single-branch regression scope.
Previews remain deferred: preserve derivatives/record omission/no falsified hashes/
full check pass. Headless Linux does not replace physical/visual acceptance.

<a id="prompt-para-la-siguiente-instancia-de-codex"></a>

## Prompt for next Codex instance

> Continue B2B domain/white-label work. Read `docs/roadmap-implementacion.md`,
> `docs/b2b-white-label.md`, `docs/b2b.md`, `docs/development.md` and
> `docs/development-vps.md`. Inspect branch/SHA/local changes/instructions/VPS
> resources before editing. Confirm received WL-0–WL-8 checkpoints/evidence;
> do not restart implemented work. Continue actual pending items with reviewable
> increments/isolation tests. Multiple branches belong to first delivery:
> domain→brand/organization→branch. Atlas/Sur at least two branches each,
> trainer/member permissions assigned-branch only. Keep B2C independent. Disposable
> test DBs/host-generated secrets. No project-version updates/deferred-preview
> regeneration/domain publication/deployment under this handoff. Update roadmap
> status/evidence per delivery; distinguish implemented/tested/omitted/pending.
