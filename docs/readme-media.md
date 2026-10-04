# Reproduce the README media

The README shows the actual application from this working tree. There are no AI-generated product mockups or invented anatomical illustrations. Screenshots are scrolled to useful content using the application's existing layout. The Spanish UI is preserved as implemented.

## What each asset shows

| Asset | Size | Content |
| --- | --- | --- |
| [`hero-desktop.webp`](media/hero-desktop.webp) | 1600 × 1200 | Starter routine, exercise list, complete 3D viewer, and educational instructions |
| [`mobile-routine.webp`](media/mobile-routine.webp) | 430 × 932 | The same squat viewer in the actual responsive layout, with bottom navigation |
| [`anatomy-exploration.gif`](media/anatomy-exploration.gif) | 1280 × 900 · 10.5 s | Squat movement, anatomical pose, skin, skeleton, muscles, and muscle-role highlighting |
| [`exercise-library.webp`](media/exercise-library.webp) | 1440 × 1000 | The catalogue, genuine rendered thumbnails, and search/filter controls |
| [`exercise-library.gif`](media/exercise-library.gif) | 1440 × 1000 · 10.5 s | Filter to squats, find the paused squat, open its movement, and read technique cues |
| [`routine-flow.gif`](media/routine-flow.gif) | 1440 × 1000 · 10 s | Customize one exercise/one set, enter 8 fictional reps, save locally, and see the resulting progress |
| [`health-dashboard.png`](media/health-dashboard.png) | 1600 × 1300 | Health overview with fictional local demonstration records |
| [`health-dashboard-mobile.png`](media/health-dashboard-mobile.png) | 430 × 932 | Health dashboard on a mobile viewport |
| [`progress.png`](media/progress.png) | 1600 × 1300 | Progress history using fictional demonstration activity |
| [`health-tour.gif`](media/health-tour.gif) | 1000 × 681 · 10 s | Health overview and exploration |

Exact sizes, durations, SHA-256 hashes, browser/encoder versions, and generation times are recorded in the [main manifest](media/readme-media-manifest.json) and [health manifest](media/health-media-manifest.json). Inspect manifest `bytes` for the current total rather than assuming a fixed size.

## Capture the anatomy and catalogue

Use the repository's Node/pnpm versions. Install workspace dependencies and Playwright Chromium if this is a fresh checkout:

```sh
pnpm install --frozen-lockfile
pnpm --filter @klisteniapp/web exec playwright install chromium
```

Install **FFmpeg** and the **WebP tools** (`cwebp`) using your system package manager. On macOS, `brew install ffmpeg webp` supplies both. The existing exercise-preview workflow also uses these encoders. `FFMPEG_BIN` and `WEBP_CWEBP_BIN` can override executable locations.

From the repository root:

```sh
node scripts/capture-readme.mjs
node scripts/capture-readme.mjs --check
```

The script starts its own Vite server on `127.0.0.1:4197`, launches an isolated Playwright Chromium context, waits for the real atlas, drives the real controls, and closes its browser and server in `finally`. If the port is occupied, choose another with `--port 4297`. No existing browser profile is opened. Temporary PNG frames are removed on normal completion or handled errors.

Both scripts explicitly set `VITE_APP_MODE=demo` by default, so local environment files cannot silently turn the tour into an operator's instance. All API and non-local HTTP requests are blocked and fail the capture; analytics configuration is empty. The app runs without an account, login, server database, payment flow or production mutation.

For a separate, clearly labelled anonymous instance preview, pass `--mode instance`. This sets `VITE_APP_MODE=instance` and `KLISTENI_PUBLIC_PROFILE_FILE` to the checked-in `apps/web/instance-profile.example.json`; it never uses an operator's private profile. Only the session read is answered with `null`; every other API request remains blocked. The manifest records `deployment.mode` and the example profile's source hash. Do not describe an instance preview as the default public demo. These commands overwrite the same media filenames, so regenerate both sets in demo mode before publishing this README.

The hero, mobile, anatomy, and catalogue assets are captured first with **no personal data or training history**; the starter routine and empty progress are the app defaults. The final routine clip uses the real customization and session controls to create **one fictional local workout: one squat set with 8 repetitions**. The script verifies that exact saved record. This minimal routine keeps the walkthrough short; it is not a proposed complete training program or evidence that someone performed the exercise. The browser is discarded afterward.

The anatomy and catalogue GIFs each use 84 screenshots at 8 fps; the routine clip uses 80. They are encoded with a generated 192-color palette and a repeating loop. Loading waits and pauses between interactions are omitted. Slow GPU readback can compress wall-clock time, so the GIFs are product walkthroughs rather than timing or performance evidence. WebP screenshots use lossless encoding. Capture dimensions and interactions are fixed; identical pixels across GPUs, operating systems, browser versions, and live animation timing are not promised.

## Capture health and progress

Run the separate companion script:

```sh
node scripts/capture-readme-health.mjs --port 4198
node scripts/capture-readme-health.mjs --check
```

It starts and closes its own local Vite server and isolated browser. Its schema-validated fictional fixture is anchored to **4 October 2026**, in `Europe/Paris`: 10 measurements, 20 sleep entries, 7 daily activity entries, 8 nutrition entries, 2 goals, 10 workouts, and 9 cardio activities. No supplement entries are invented. See its [manifest](media/health-media-manifest.json) for the fixture hash, source/output hashes, viewports, and evidence boundary. The health GIF has 60 frames at 6 fps. `--no-gif` is only for screenshot iteration: it produces an incomplete manifest that `--check` rejects; run the full command to publish all four assets. The health capture is illustrative product documentation; its values are not personal health records, clinical outcomes, or proof of a connected wearable. Keep that distinction in README captions and social drafts.

## Verify and review

Both scripts' `--check` hashes the current application source, deployment configuration, example public profile, model, rig landmarks, preview manifest, lockfile and capture helpers, then checks every generated file and the recorded deployment mode. A successful result confirms traceability and file integrity, not visual quality. The manifest records `HEAD` and whether the working tree was dirty. **Uncommitted sources are included in the captures; `HEAD` alone does not identify their content.** These images do not establish which version is deployed publicly.

Open the desktop, mobile, and catalogue screenshots at full size. Check that the model is loaded, the whole body and controls are visible, the text is legible, and the mobile navigation is not covering the subject. Play the GIFs and inspect every layer/pose transition and the saved session. Useful inspection contact sheets can be produced outside the repository:

```sh
ffmpeg -v error -y -i docs/media/anatomy-exploration.gif \
  -vf 'fps=1,scale=480:-1,tile=3x4' -frames:v 1 /tmp/klisteni-anatomy-contact.png
ffmpeg -v error -y -i docs/media/exercise-library.gif \
  -vf 'fps=1,scale=480:-1,tile=3x4' -frames:v 1 /tmp/klisteni-library-contact.png
ffmpeg -v error -y -i docs/media/routine-flow.gif \
  -vf 'fps=1,scale=480:-1,tile=3x4' -frames:v 1 /tmp/klisteni-routine-contact.png
```

Unused tiles may be empty because the animations last 10–10.5 seconds. Contact sheets are review artifacts, not README assets. Verify the anatomy GIF includes skin, bones, unhighlighted muscles, and highlighted movement; verify the catalogue GIF resolves to the paused squat and its actual technique panel. Verify the routine GIF shows a single saved session with one exercise and one set.

If the atlas falls back, the script fails instead of accepting that capture. Resolve WebGL/model availability before regenerating. If a capture fails after writing some assets, rerun the complete command: the previous manifest remains, and `--check` will expose mismatched files. Do not treat a partly completed generation as a complete media update. After a forced termination, check for its local Vite/Chromium process and temporary directory before starting again.

The published media must retain [anatomical attribution and license](media/NOTICE.md). If you share a GIF on LinkedIn or Slack separately, include the short credit from that notice and a link to the full credits. Health screenshots use fictional records; keep their demonstration caption when sharing.
