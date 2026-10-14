# Yoga

Yoga has its own navigation area with an asana library, personal practices and
history. The educational catalog is in Spanish and retains Sanskrit names and
English equivalents for search. Each entry covers preparation, movement, exit,
breathing, sensations, adaptations, precautions, and historical and cultural
context. [Editorial criteria and sources](yoga-sources.md) define its scope. All
24 asanas use a representation of the same anatomical atlas as the exercise library.

<a id="representación-3d"></a>

## 3D representation

The global body-model preference (localized labels `Modelo corporal: Hombre / Mujer`)
applies to cards, details and guided practice. This visual choice changes neither
timing nor instructions nor records. Both representations use the existing atlas
and the same parametric transformation as the rest of Klisteni.

Cards start with a static image and show an animated sequence when explored,
without creating a canvas for every posture. Details and sessions offer an
optional 3D viewer with camera angles and model layers. When WebGL is unavailable,
the rendered image and instructions remain. The representation illustrates the
explanation and adaptations; it does not measure the practitioner's mobility or proportions.

Each demonstration cycles through preparation, entry, hold and exit in an
illustrative 12-second loop. The body moves within fixed framing; the camera
changes only through its controls. Users can pause, scrub, restart, and choose
normal or half speed. The cycle prescribes neither an asana duration nor breathing
cadence. Watching it starts neither the practice clock nor a record.

System and application reduced-motion preferences prevent autoplay. The viewer
can be played explicitly and pauses when hidden or suspended. Thumbnails retain
their posters when offscreen or when motion should not play.

Asymmetric postures have independent left and right poses and renders. During
guided practice the model follows the side of the current segment. Changing the
camera does not change the anatomical side, and images are not mirrored to simulate it.

Yoga retains the original 17 segments and limb lengths, adding nine axial controls
and two intermediate shoulder controls: **28 bones in the Yoga rig**. Torso influence
is distributed along those controls to represent Cat/Cow curves, flexion and
extension while retaining shoulder and pelvis anchors. Shoulder controls distribute
rotation between torso and humerus to retain the surface as arms lift or fold.
Each bone structure uses a rigid control; skin and muscles interpolate influences.
The source atlas and exercise rig retain their geometry and behavior. The spinal
curve is an educational approximation, not a simulation of individual vertebrae or soft tissue.

Entry and exit coordinate the base, torso, head and limbs with their own timing.
Free hands follow arcs, and supports are resolved again each frame. A small chest
variation during the hold avoids an immobile body without prescribing a breathing
pattern. Framing measures the whole cycle, including exit and small variations.
The Yoga studio uses soft lighting, short shadows, a thick mat and rounded blocks.
Default angles show the spinal profile and supports.

Some long tibial tendons can intersect the floor in the muscle layer during deep
ankle flexion; supports are checked on the skin surface. Yoga calibrates knees
and anterior pelvic support against each model's deformed surface to prevent
floating above the mat. GLB tests check that surface for both models and check
head and back support in supine postures.

<a id="prácticas-y-registro"></a>

## Practices and recording

A practice stores its name, intention and ordered sequence. Each asana occurrence
has its own identifier, duration and side; repeated postures are valid. Asymmetric
postures use separate timers for each side. Initial suggestions can be adapted before saving.

Guided practice supports pause, resume, skipping postures and finishing early.
Records retain a sequence snapshot and only completed segments; editing or
deleting a practice does not rewrite history. Paused time and skipped segments
produce no recorded minutes. Users can add notes on the review screen before saving.

Yoga also appears in progress (localized label `Mi progreso`). It counts toward
active days and adds one XP per accumulated minute of recorded practice. It does
not complete strength goals or generate repetitions, sets or cardio minutes.

<a id="persistencia"></a>

## Persistence

Shared schemas are in `packages/scene-schema/src/yoga.ts`. `PersonalSettings.yoga`
is optional for compatibility with v2 backups and older clients: omitting the
field does not delete existing data. It contains `practices` and `logs`. Records
validate that steps, sides and durations match the saved sequence and that total
duration equals their sum.

The demo stores these values in the local personal copy. An instance uses the
active account and server revisions; another account's data is not mixed with
the public library or local copy. Save failures retain the form for retry.
Personal export includes yoga. Account import combines records by identifier;
restoring settings also includes practices. The same identifier with different
content is rejected as a conflict.

<a id="archivos-principales"></a>

## Main files

- `apps/b2c-web/src/data/yoga.ts`: content and initial sequences.
- `apps/b2c-web/src/components/YogaPage.tsx`: library and practices.
- `apps/b2c-web/src/components/YogaPracticeEditor.tsx`: sequence editor.
- `apps/b2c-web/src/components/YogaSession.tsx`: guide, timers and review.
- `apps/b2c-web/src/components/YogaAsanaArt.tsx`: atlas posters by model and side.
- `apps/b2c-web/src/components/YogaViewer.tsx`: interactive viewer and static alternative.
- `apps/b2c-web/src/components/YogaStage.tsx`: atlas, pose and camera shared with capture.
- `apps/b2c-web/src/lib/yoga-rig.ts`: poses for all 24 asanas on the anatomical rig.
- `apps/b2c-web/src/lib/yoga-anatomy.ts`: atlas preparation and Yoga-specific axial controls.
- `apps/b2c-web/src/lib/yoga-motion.ts`: cycle, phases and movement interpolation.
- `apps/b2c-web/src/lib/yoga-rendering.ts`: pose framing and model views.
- `apps/b2c-web/src/lib/yoga-preview-assets.ts`: image paths by asana, model and side.
- `apps/b2c-web/src/lib/store.yoga.ts`: shared persistence operations.
- `apps/b2c-web/src/lib/yoga-practice.ts`: search, sides and durations.
- `scripts/export-yoga-blender.mjs`: rig and cycle export to animated GLB.
- `scripts/blender/build_yoga.py`: editable Blender scene preparation.

Yoga validation runs with schema, web and API tests. User-flow acceptance is in
`apps/b2c-web/e2e/yoga.spec.ts`. `apps/b2c-web/e2e/yoga-3d.spec.ts` covers actually
loaded posters, the global preference, practice sides, the no-WebGL alternative
and the interactive viewer. Static cases simulate an unavailable WebGL context
on an isolated page. The interactive check requires the real GLB to arrive, the
atlas to become ready and camera controls to change the canvas image. It saves
screenshots of both models for visual review.

Movement cases compare raster output during playback, pause and phase changes.
They also observe matrices reaching WebGL to verify that the body changes while
the camera stays fixed. They cover both representations and sides, speed,
reduced motion, hiding and suspension, and verify that watching a demonstration
starts neither the timer nor recorded history time.

```sh
pnpm --filter @klisteniapp/b2c-web exec playwright test e2e/yoga-3d.spec.ts e2e/yoga.spec.ts e2e/model-variant.spec.ts
```

The instance flow in `apps/b2c-web/e2e/yoga-account.spec.ts` covers revision
conflicts, recovery as a copy, deletion with expired access and network-failure
retry. Its standalone configuration uses an instance bundle and simulated API:

```sh
pnpm --filter @klisteniapp/b2c-web exec playwright test --config playwright.yoga-account.config.ts
```

These tests do not replace PostgreSQL integration in `apps/b2c-api/tests`, which
requires a disposable database and must never use real accounts.

<a id="generar-posters-y-animaciones"></a>

## Generate posters and animations

From the repository root, for later content work; full regeneration remains deferred:

```sh
pnpm yoga-previews:generate
pnpm yoga-previews:check

# Iterate on one asana and one representation
pnpm yoga-previews:generate --asana vrksasana --model female

# Export contact sheets to compare all poses
pnpm yoga-previews:generate --contact-sheets /tmp/klisteni-yoga-review
```

`scripts/generate-yoga-previews.mjs` renders poses in Chromium with WebGL and encodes
one poster and one animated WebP per variant. It requires repository dependencies,
Playwright Chromium, `cwebp` and `img2webp`, like anatomical exercise thumbnails.
No account or personal data is required.

Images are saved in
`packages/model-assets/public/previews/yoga/{male|female}/{asanaId}-{both|left|right}.webp`;
animations add `-motion.webp`. Each model has one pair per bilateral posture and
two pairs per asymmetric posture: **64 posters and 64 animations for 24 asanas
and two models**. The manifest records sources and image hashes.
`yoga-previews:check` detects missing or stale files without rendering and forms
part of `pnpm previews:check`.

The generator and viewer share poses and models. Changes to poses, framing or
atlas sources require regenerated images and visual review of both representations
and sides. Hashes establish file provenance; they do not replace visual review.

The capture entry `apps/b2c-web/yoga-preview-capture.html` is served by an isolated
Vite during generation. It uses `YogaStage`, the muscle layer and an orthographic
camera that frames the whole cycle once, including selected morphology. Default
posters are **512 × 384 pixels** and animations **384 × 288**, with 240 samples at
20 fps for the 12-second cycle. `--size` changes poster width from 128 to 1024;
height retains 4:3, and animation width is limited to 384. `--fps` accepts 4, 5,
8, 10, 20 or 25. Development captures are excluded from public builds.

To review other layers without changing posters, the entry accepts
`?asana=marjaryasana&model=female&layer=skin&view=side`. `layer` accepts `muscles`,
`skin`, `skeleton` or `combined`; `view` accepts `perspective`, `front`, `side` or
`back`. Defaults remain `muscles` and `perspective`. The capture API
`window.__yogaCapture.frame(fase)` deterministically inspects any cycle point from 0 to 1.

`--contact-sheets` exports hold postures and preparation-entry-hold comparisons
to review trajectories for both models and every side.

The manifest includes variant, side, geometric bounds, camera, tool versions,
atlas provenance, duration, distinct frames, and source/WebP hashes. Checks also
validate animation duration and looping through ANIM/ANMF blocks. Manifest v2
requires distinct body frames while camera and framing bounds remain constant
for every frame. Derived atlas renders retain [credits and license](../packages/model-assets/public/previews/yoga/NOTICE.md).
Identical pixels across GPUs or Chromium versions are not guaranteed.

<a id="taller-de-blender"></a>

## Blender workshop

`node scripts/export-yoga-blender.mjs` exports the prepared atlas, weights and
viewer movements to `artifacts/yoga-quality/blender/`. It creates one GLB per
model, each with 32 clips: **64 clips** for 24 asanas and their sides. Clips sample
at 24 fps and include preparation, entry, hold and exit. A manifest lists models,
bones and actions.

`scripts/blender/build_yoga.py` prepares an editable workshop and saves
`assets/blender/yoga-quality.blend`, with one scene per model and actions selectable
in the action editor. It is generated from sources; the original atlas retains
its own file.

Before saving, the builder verifies source and GLB hashes, bones, actions and
timing. Playback covers frames 1–288 at 24 fps; frame 289 retains the closing key,
identical to the first. It removes only redundant interior keys in constant
linear-interpolation spans, retaining both endpoints and every changing sample.
It also clears file-browser buffers before saving the public file. The fixed
camera measures deformed geometry at 33 phases per action, includes blocks and
both mat orientations, and retains edge margins. The file includes atlas credits
and its complete license text.

Blocks are organized in per-action collections under **Pose supports**, excluded
by default. Enable the corresponding collection for asanas using blocks and
disable it when changing posture. The mat can rotate 90° around Z for Warrior II
and Triangle. No scripts need to run on file opening for playback or supports.

Exports are working artifacts derived from the atlas. Permanent application
adjustments remain in Yoga sources. After those adjustments change, regenerate
the workshop and thumbnails to match the viewer, retaining atlas credits and license.
