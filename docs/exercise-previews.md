<a id="miniaturas-del-movimiento"></a>

# Movement thumbnails

apps/web→apps/b2c-web rename retains capture evidence through
`packages/model-assets/provenance/workspace-relocation-2026-10-11.json`: exact
current hashes/source equality/mechanical script/renderer-dependency verification.
Only --check retains old identity on complete match; new captures current paths/
hashes. No captured timestamps/manifests/hashes changed.

**October 11, 2026 status:** user-deferred full preview generation/validation until
3D models/related changes complete. Preserve files; instructions for later resumption,
not Mac-startup task. [Roadmap](roadmap-implementacion.md)/[delivery](b2b-release.md)
explain pending/full gate not passing.

Mi rutina/Ejercicios images same atlas/movement as 3D viewer; local Chromium/Vite
capture, runtime images without per-card canvas/model. Mi cuerpo static isolated
regions below. Animated WebP plus static WebP poster; optional GIF for sharing/comparison,
not required UI. Global male/female shared morphology/scene/camera/path; visual
choice not prescription/sex-gender-health inference.

<a id="requisitos"></a>

## Requirements

Node 24+/pnpm12.7.0/dependencies/models in packages/model-assets/public/models,
Playwright Chromium/WebGL, cwebp/img2webp, FFmpeg only for --gif. Root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @klisteniapp/b2c-web exec playwright install chromium

# macOS with Homebrew: WebP encoders
brew install webp

# Optional, for GIF export
brew install ffmpeg
```

PATH encoder search or WEBP_CWEBP_BIN/WEBP_IMG2WEBP_BIN/FFMPEG_BIN paths; no Blender
for prepared model. GPU-less PREVIEW_SOFTWARE_WEBGL=1 explicitly SwiftShader/all
three generators, manifest args; e.g. PREVIEW_SOFTWARE_WEBGL=1 pnpm previews:generate
--gif. Remove temporary frames after each publication/bounded disk.

--only-stale compares sources/size-fps/browser-encoder versions/renderer args/
actual bytes-hash before skip. Valid ISO UTC,≤five-minute future clock tolerance;
verified timestamp/manifest unchanged. Keep GIF with
PREVIEW_SOFTWARE_WEBGL=1 pnpm previews:generate --gif --only-stale. Yoga
--contact-sheets rerenders only three review phases for current items, preserving
published provenance. Serial resumable Linux with family logs/review sheets:

```sh
mkdir -p .cache/preview-review
PREVIEW_SOFTWARE_WEBGL=1 pnpm previews:generate --gif --only-stale > .cache/preview-review/exercise.log 2>&1
PREVIEW_SOFTWARE_WEBGL=1 pnpm body-previews:generate --only-stale --contact-sheet .cache/preview-review/body.png > .cache/preview-review/body.log 2>&1
PREVIEW_SOFTWARE_WEBGL=1 pnpm yoga-previews:generate --only-stale --contact-sheets .cache/preview-review/yoga > .cache/preview-review/yoga.log 2>&1
pnpm previews:check
```

Sources stable during capture; reject mid-frame changes. Correct interruption cause/
repeat same parameters. Capturing vs Verified current; incomplete/missing/corrupt
recaptured, no invented receipts. Final check needs no Git/historic receipt when
all captures current.

<a id="generar-y-comprobar"></a>

## Generate and check

```sh
# Regenerate the whole catalog for both models, retaining GIFs
pnpm previews:generate --gif

# Iterate on one exercise
pnpm previews:generate --exercise squat --gif

# Iterate on only the female representation of one exercise
pnpm previews:generate --exercise squat --model female --gif

# Regenerate selected exercises
pnpm previews:generate --exercise pushup --exercise dead-bug --gif

# Add a GIF alongside both WebP files for one model
pnpm previews:generate --exercise squat --model female --gif

# Check sources and files for the entire catalog without rendering
pnpm previews:check

# Direct equivalent and help
node scripts/generate-exercise-previews.mjs --check
pnpm previews:generate --help
```

37 ExerciseIdSchema/catalog IDs. Added twelve quarter-squat/paused-squat/
knee-narrow-pushup/narrow-pushup/dead-bug-heel-tap/quadruped-leg-extension/prone-t-raise/
prone-y-raise/split-squat/single-leg-calf-raise/bridge-march/single-leg-glute-bridge;
third ten bent-knee-row/dead-bug-arm-only/sumo-squat/single-leg-deadlift/forward-lunge/
quadruped-arm-raise/prone-hip-extension/supine-march/supine-heel-slide/plank-shoulder-tap.
Validate IDs/owned127.0.0.1 free-port Vite/no dev session required, close browser/server.
Output packages/model-assets/public/previews:

| File | Use |
| --- | --- |
| {id}-poster.webp | Representative static phase |
| {id}.webp | Full loop |
| {id}.gif | Optional --gif |
| female/{id}-poster.webp, female/{id}.webp, female/{id}.gif | Female formats |
| manifest.json | Capture params/renderer versions/provenance-output hashes |
| NOTICE.md | Anatomical-image credits/license |

Unprefixed male links preserved; [asset resolver](../apps/b2c-web/src/lib/exercise-preview-assets.ts)
all formats/models. --model male/female/all, default all. Without --gif deletes old
GIF for regenerated exercise/model, UI remains WebP. Manifest v2
variants.male.exercises/variants.female.exercises/modelVariant/sources/files;
old male history preserved until individually replaced. Console frames/duration/
actual WebP size, manifest bytes; no fixed-size promise.

<a id="resolución-tiempo-y-encuadre"></a>

## Resolution, timing and framing

Default256×256,12fps, DPR1, opaque #172526. Bilateral/unilateral6s/72frames;
alternating10s/120frames both sides/center return: dead bug/heel taps/reverse-lateral
lunge/bird dog/quadruped legs/climber/marching bridge/arms-only dead bug/forward
lunge/quadruped arm/supine march/heel slide/shoulder taps. Shared exercise-animation.ts
viewer/generator duration/half-cycle labels.

split-squat/single-leg-calf-raise/single-leg-glute-bridge/single-leg-deadlift/
prone-hip-extension unilateral per-side sets/viewer one side, explicit switch;
no invented alternating variant. Paused squat repetition/trajectory plateau, not time log.
Explore resolution/rate:

```sh
pnpm previews:generate --exercise squat --size 384 --fps 16
```

--size integer64–1024,--fps1–60, same filenames; params per item, default regenerate
without overrides. Poster quality86, animation78, GIF frame-derived palette.
[Camera config](../packages/anatomy-viewer/src/exercise-preview-config.ts): position/
target/orthographic height/posterPhase, fixed cycle. Review whole range after angle/
framing change, not single phase.

<a id="de-dónde-sale-cada-frame"></a>

## Frame source

[ExerciseStage](../packages/anatomy-viewer/src/ExerciseStage.tsx) shared viewer/capture:
AnatomicalModel/AnatomyStudio/both-row bar(straight/bent legs). Actual GLB/landmarks/
rig/muscles, no highlight, no separate hand animation. [Capture entry](../apps/b2c-web/src/preview-capture.tsx)
waits model, window.__exerciseCapture.frame(phase); exact frame/frameCount pose-render-
PNG, no wall-time screen recording. Excludes duplicate phase1/no loop pause, studio
warmup before poster. [HTML](../apps/b2c-web/preview-capture.html) dev-only
?exercise=squat&model=female(default male), not app import/production entry;
production public/previews, no page/controller. Deterministic phase-camera,**not
pixel equality across GPU/OS/Chromium/encoder versions**. Manifest date/versions/
platform per item; shared exposure/tone mapping/shadows anatomy-render-settings.ts.

<a id="detectar-miniaturas-desactualizadas"></a>

## Detect stale thumbnails

[Generator](../scripts/generate-exercise-previews.mjs) SHA-256 relevant generator/
entry/camera/routes/scene/model/morphology/studio/rig/catalog-planning/geometry/
schemas/GLB/landmarks/lock; laterality metadata affects cycle. Combined source hash/
params/output hashes per entry.

Exercise/yoga package extraction preserves original captures/GIF/dates/hashes;
[verifiable provenance](../packages/model-assets/provenance/README.md) proves moved
sources/current hashes; later changes invalidate/recapture.24 region images regenerated shared.
previews:check all 37×2=74 even partial generation; part of check. Missing entries/
changed sources/wrong model-path/missing-bad bytes fail. Read-only, no Chromium/encoders.
Global source hash: one camera/pose change makes others stale too. Partial useful
iteration, complete later:

```sh
pnpm previews:generate --gif
pnpm body-previews:generate
pnpm yoga-previews:generate
pnpm previews:check
pnpm check
pnpm test:e2e
```

Commit source/thumbnail/manifest together. Integrity/provenance, not visual pose
comparison/uniform size-fps requirement.

<a id="miniaturas-de-regiones-del-atlas"></a>

## Atlas region thumbnails

body-previews:generate two models×12. Dev body-preview-capture.html?model=female,
shared prepareAnatomy/orthographic visible-vertex framing, cameras/representative
side/colors/transparent background. Female shared parametric adaptation, not clinical
independent atlas. public/previews/body and public/previews/female/body own manifests/
credits; variant/structures/triangles/bounds/camera/tool versions/source-WebP hashes.
body-previews:check24 dimensions/anatomical selection/provenance/no browser, included previews:check.

```sh
pnpm body-previews:generate --model female --region pectorals
pnpm body-previews:generate --contact-sheet /tmp/klisteni-body.png
pnpm body-previews:check
```

Second generates both/review sheets /tmp/klisteni-body.png,/tmp/klisteni-body-female.png.
Light-dark/card-size review. Source changes during capture rejected; stabilize
renderer/model then rerun. Interruption subset/check identifies pending.

<a id="comportamiento-de-las-tarjetas"></a>

## Card behavior

- Lazy poster base while animation loads.
- Mi rutina selected exercise animates; both views hover/focus animate.
- Off-viewport/hidden tab unmount; reactivation own resource, no viewer phase synchronization.
- Reducir animaciones/system prefers-reduced-motion poster-only/live changes.
- Motion failure poster; poster failure discreet play symbol, usable card.
- Body-model switch immediate new resources/reduced-motion rules; one variant load error does not block other.
- Decorative screen-reader images; name/info already card text.

<a id="revisión-y-recuperación"></a>

## Review and recovery

Pose/rig/model/camera change: poster/loop actual mobile-desktop card size/extremes/
midrange/hands-feet-floor vs viewer; hover/keyboard/reduced motion. Valid load may
still need framing/deformation fix.

Capture/encode .cache/exercise-previews-*. All generators stage complete manifest
before replacing images; disk failure preserves published old set. Then resources/
manifest rename; multiple URLs not one filesystem transaction. Interruption may
leave new images/old manifest, hashes detect/only-stale recaptures, no acceptance-hash edit.
Completed items saved/rest pending. Normal/handled-error cleanup; always check/rerun
pending after interruption. Missing encoder identified; install Chromium as above.
Model preparation90s/frame30s timeout cleans. Resolve WebGL/scene failure before
acceptance, no other-exercise substitute.

Fidelity **implemented model/paths**, not technique/activation/physical contact/
clinical validity. [Anatomical limits](anatomy-model-sources.md)/[educational criteria](exercise-sources.md).
Z-Anatomy/BodyParts 3D **CC BY-SA4.0**, separate code license;[credits/adaptations](../packages/model-assets/public/previews/NOTICE.md).
