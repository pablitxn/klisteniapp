<a id="entrega-del-roadmap-y-validación-de-release"></a>

# Roadmap delivery and release validation

October 11, 2026 implementation `508e9e1` on `d70b2cb`. User owns Blender 3D authoring;
separate verified code/new content/physical-device acceptance. [Mac](development-macos.md)/
[VPS](development-vps.md) continuation, [roadmap](roadmap-implementacion.md). Runtime
report added `5187b27`, keeps actual tested code `508e9e1`.

Later-agreed [WL-0–WL-8](b2b-white-label.md) brand domains/multi-branch/contextual
permissions/themes/modules were pending at this release checkpoint; later
[WL validation](b2b-white-label-validation.md) records implementation. Below historical
results do not establish that later architecture.

**User-updated scope:** full thumbnail/preview regeneration-validation deferred
until 3D models/related changes finished. Existing derivatives retained. Content work
not blocker for code/build/publication/runtime closeout; no complete preview
regeneration/validation claim. GitLab quality retains `pnpm previews:check`;
complete CI/check/check:all/check:release not passing claims. Main integration
retains pending item, no automatic deploy.

<a id="recorrido-de-referencia"></a>

## Reference journey

Atlas/Sur organization isolation inside B2B DB; admin/assigned trainer/unassigned
trainer/member, two cable units (long name), own unanimated exercise/authorized
alternative/private draft. Readiness/publication/QR/prescription/execution/monitoring.

| Delivery | Implementation | External acceptance |
| --- | --- | --- |
| E1 | Resettable fixtures/three-role regressions/isolation/unassigned trainer | Pilot reflects actual use |
| E2 | Equipment-website recovery/conflicts/QR block reasons/mobile session/draft/definitive partial/exact retry | Human completion |
| E3 / B2 | Protected static GLB/voluntary open/error recovery/no-WebGL/local hash validator | Blender machine/poster/provenance/measurements |
| E4 | Desktop-touch Chromium/touch WebKit/per-project PostgreSQL | Accessible HTTPS/physical phone/printed QR |
| E5 | Explicit supported movement registry/shared renderer; unanimated cards work | Machine movement authoring/review; static upload imports no Blender clips |
| E6 | Own equipment/adaptations/time plans/packages without B2C-data dependency | Second machine asset/exercise proving visual reuse |

No technique/biomechanics/OS voice/physical-phone performance certification. Human
E3/E4/E5 not replaced by roadmap checkboxes.

<a id="capacidades-adicionales"></a>

## Additional capabilities

- **Time/effort:** reps or seconds per movement, optional RPE 1–10. Actual quantity/
  RPE separate. Complete requires all sets/positive quantity, not exact target;
  assigned-version units retained. Old snapshots new observations `null`, no rewrite;
  old retries normalized before compare.
- **Public entry:** `/`/`/gimnasios` B2B/gym code, `/g/:slug` website, `/app` member,
  `/manage` staff. No public-entry session query/organization directory; B2C separate build/origin.
- **Orientation:** gallery/percentage-coordinate plan/unit links; private-retired
  points absent even from older publication. Keyboard/text list survives image failure;
  optional sector static GLB authoring separate.
- **Voice/rest:** voluntary instructions/read-pause-resume-stop; side change only
  when content specifies. Elapsed rest/background tabs/no automatic sets. Browser-
  device voices, always text. [SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis).
- **Educational B2C:** combined anatomy-yoga search/contextual mobility links;
  sources retained, reading creates no practice/routine change. Visual yoga clock
  respects chosen speed/slow frames/excludes pauses/resets pose-restart, separate
  recorded practice time.
- **Clip comparison:** two authorized videos/provenance-permission/human assessment/
  JSON IDs-hashes. Draft per account-gym/tab. Assessment no publication; changed
  clip invalidates approval. Real comparison needs two clips/reviewer.

B2B files/sessions/schemas/access separate. Revoked membership grants no new access;
leaving-gym retention/export needs explicit decision. Reservations/ERP/automatic
billing/native app outside roadmap scope.

<a id="verificación-reproducible"></a>

## Reproducible verification

Lockfile dependencies/Chromium-WebKit/platform libs. Configured devices/touch/
keyboard/reduced motion emulate, not physical iPhone Safari.
[Emulation](https://playwright.dev/docs/emulation), [visual comparisons](https://playwright.dev/docs/test-snapshots).

```sh
pnpm install --frozen-lockfile
pnpm --filter @klisteniapp/b2c-web exec playwright install --with-deps chromium webkit

# Distinct disposable PostgreSQL URLs in a private environment file:
# TEST_DATABASE_URL and B2B_TEST_DATABASE_URL
node --env-file=/ruta/privada/verification.env --run check:release
```

`check:release` rejects missing/same test DBs. Serial lint/types/tests/provenance/
builds/B2C-B2B integration/browser including privacy; browser retries off even CI.
Initial stage no DB, later PostgreSQL required. No deployment/real DB changes.
`pnpm check:release --list` commands. Full preview gate retained for resumed content.
Current closeout ran code/runtime separately, only deferred preview work omitted;
not full check/release execution.

B2B-only build:b2b/test:b2b:api/test:b2b:e2e with test env. `.cache/b2b/` results/
traces; six stable images in `apps/b2c-web/e2e/snapshots/b2b/`. Baselines only after
visual review. Heavy CI opt-in/reports on execution.

[Production-image smoke](b2b-runtime-validation.md): actual images/HTTPS/nonroot/
limited DB/publication/restart/independent restore; [October11 evidence](validation/b2b-runtime-2026-10-11.json).
readyz auth check: pre-migration API remains unavailable until restart. Migrate then start/recreate.

<a id="estado-de-verificación-al-11-de-octubre-de-2026"></a>

## Verification status on October 11, 2026

Local logs/`.cache/roadmap-verification-progress.json` checked. Final code/build/
publication passed; independent API/browser evidence. Final eight-group smoke
clean `508e9e1`; logs local `.cache/`.

| Check | Confirmed result | Local log |
| --- | --- | --- |
| Package lint/types/tests | 45/45 tasks;26 cached | `roadmap-final-code.log` |
| App tests | Web196/196, backoffice22/22, member24/24 | `roadmap-final-code.log` |
| B2B boundaries/format | Both PASS | `roadmap-final-boundaries.log`, `roadmap-final-format.log` |
| Builds/type dependencies | 18/18;15 cached/three frontends rebuilt | `roadmap-final-build.log` |
| Publication/demo audit | `ok: true`, no findings | `roadmap-final-publication-fixed.log` |
| Desktop-touch Chromium/touch WebKit B2B | 84/84 | `roadmap-b2b-matrix-verified.log` |
| Later viewer regressions/two cases×three | 6/6 | `roadmap-b2b-viewer-final.log` |
| B2C API/PostgreSQL | 97/97, no skips | `roadmap-b2c-api-final.log` |
| B2B API/PostgreSQL | 41/41, no skips | `roadmap-b2b-api-final.log` |
| B2C account browser | 31/31 | `roadmap-accounts-browser-final.log` |
| Analytics/privacy browser | 16/16 | `roadmap-analytics-browser-final.log` |
| Initial B2C browser | 79 PASS/4 FAIL of83 | `roadmap-b2c-browser-final.log` |
| Yoga retest | 11/11 | `roadmap-yoga-browser-final.log` |
| Mobile atlas/37 exercises in one journey | 1/1 | `roadmap-anatomy-catalog-final.log` |
| Root scripts | 17/17, no skips | `roadmap-final-scripts.log` |
| Runtime `508e9e1` | 8/8/restart-independent restore-cleanup | [Sanitized report](validation/b2b-runtime-2026-10-11.json) |

Unit phase without TEST_DATABASE_URL/B2B_TEST_DATABASE_URL; skipped integration
not API coverage. Independent PostgreSQL97 B2C/41 B2B above. B2C build used `VITE_APP_MODE=demo`.
Publication audit570 text/two blend/two glb/nine PNG/603 WebP/152 GIF. Three synthetic
fixture credentials allowed only exact hashes/locations; tests unauthorized
values/locations. Self-test**66/66**, nine new/lint PASS. Text/metadata review not
visual/preview validation.

Four initial B2C failures: mobile atlas and yoga playback-pause-seek/speed-suspension/
reduced motion without log alteration. Correct visual clock/test synchronization-
slow-render waits then yoga/atlas retests. **No new monolithic83/83**, retests not
extra independent cases. Smoke**10:45:59–10:47:39 UTC**, workingTreeChanges false,
independent restore/cleanupComplete true; full check/release not run due preview gate.

**162 preview variants** (74 exercise/24 anatomy/64 yoga) regeneration/visual/
provenance/regressions deferred. Resume definitive models/renderer, retain GIF/
canonical params/check previews. Partial batch proves neither162 nor code blocker.
Stopped**10:36 UTC**:74 exercise/24 anatomy/17 yoga=**115** new. Other47 yoga earlier;
new yoga visual review16. Exercise74/body24 checks had passed. Interrupted item old
files/entry retained, no partial publication. `.cache/preview-review/stopped-state.json`
not global previews PASS.

Linked runtime uses clean508e9e1/latest code/preserved assets. Blender/human content-
clips/physical phone-QR/public deployment retain own external acceptance.

<a id="entrega-desde-blender"></a>

## Blender delivery

```sh
pnpm equipment:check /ruta/polea-v1.glb --poster /ruta/polea-v1.png
```

Same production binary validator/size-SHA256; self-contained GLB 2.0≤24 MiB, no
animation/skin/extensions/external resources. No file mutation/model certification.
Shared editable `assets/blender/equipment/<id>.blend`, versioned export
`packages/model-assets/public/models/equipment/`, license/provenance alongside.
Local gym model/image uploaded library/published reviewed card.

Before publication scale/orientation/framing/views/instructions/license/phone
size-fluency review. Poster/text explain without 3D. Static machine no educational
animation; future clips need own upload/playback contract.

<a id="paso-a-un-entorno-público"></a>

## Public environment transition

[Independent instance](b2b.md#instancia-independiente), dedicated DB-media/secrets/
exact HTTPS/nonroot. Bootstrap administrator first, no production test accounts.
Consistent joint backup/restore test. Coordinated same-revision API/member/backoffice
update: old strict clients reject new fields even null. [Upgrade/recovery](b2b.md#compatibilidad-y-despliegue-de-esta-actualización),
reload tabs/retain drafts. New reads old snapshots; old images may not read new
writes. Prefer current-version fix/independent restore preserving post-backup changes.

Print labels after phone-reachable HTTPS; loopback labels marked test. Admin→trainer→
member→monitoring, both units scan/permissions/public withdrawal. Record device/
OS-browser/date/results/sanitized captures. Development alone establishes no
content acceptance/physical scanning/offboarding policy/external publication.
