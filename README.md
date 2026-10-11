# Klisteni

**Learn the movement. Understand your body. Build the habit.**

An educational calisthenics and yoga app that puts the explanation beside the movement.
Explore a moving anatomical model, discover what each movement asks of your
body, shape a routine and keep a record of your practice. Start with your body
weight, a browser and a little curiosity.

**37 exercises & variants · 24 yoga asanas in 3D · Interactive anatomy · Free local mode**

[Take a tour](#take-a-tour) · [Run locally](#run-locally) · [Public demo and instance modes](docs/public-demo.md) · [Documentation](docs/README.md)

This repository also contains an **independent gym platform**: a public gym
website, staff backoffice and member app, with its own API, database and media.
It supports reviewed equipment catalogues, per-unit QR codes, versioned programmes,
timed or repetition-based prescriptions, optional RPE, recoverable training drafts,
floor plans and optional voice guidance. [Gym product and setup →](docs/b2b.md)

**October 11 handoff:** the VPS code delivery and local production-runtime checks
are recorded in the [release evidence](docs/b2b-release.md). Continue from `main`
using the [Mac workspace guide](docs/development-macos.md) and
[current roadmap](docs/roadmap-implementacion.md). New Blender models and movement
authoring remain local work; preview regeneration is deferred until those assets
are ready. Physical-phone acceptance and a public deployment remain pending.

![Klisteni's desktop routine workspace, with an anatomical exercise demonstration and technique guidance](docs/media/hero-desktop.webp)

*Designed for phone and desktop. B2C offers Spanish, English and French interface
preferences, with Spanish fallback; educational content may remain in Spanish.
This English README tours the Spanish public demo build, with fictional records
in the health and progress examples.*

## Take a tour

### See the movement from the inside

A repetition makes more sense when you can slow it down and look around it.
Pause the demonstration, scrub through its cycle and compare **3D, front, side
and back** views. Switch between **skin, muscles and bones**. Highlight the
muscle groups involved and select a structure
to see its name.

![Exploring a real exercise demonstration, camera views and anatomical layers](docs/media/anatomy-exploration.gif)

Open **Mi cuerpo** to explore the atlas in its standing reference pose. Return
to an exercise to connect those structures to a movement, with **how-to steps,
technique cues, easier and harder variations, and references** beside the model.

The anatomy comes from **Z-Anatomy / BodyParts3D**, with **955 meshes** sharing
the same coordinate system. The animated poses are educational illustrations:
colors describe the catalogue's muscle classification, not measured activation,
and the app does not assess your form.
[Anatomy sources, adaptations and limits →](docs/anatomy-model-sources.md)

### Find your next movement

Browse **37 exercises and variants** across **7 movement patterns**. Search by
Spanish or English name, or by muscle; combine movement, difficulty and equipment
filters to narrow the library. Each card previews the same anatomical model and
movement used in the full viewer.

![Searching and filtering the exercise library, then opening an exercise](docs/media/exercise-library.gif)

Squats, push-ups, lunges, hip hinges, bridges, trunk control, calf raises and
W/T/Y movements sit alongside two bar-or-ring rowing variations. **35 exercises
need no equipment.** Equipment requirements stay visible when adding movements
to a routine.

Each exercise also explains **how it fits into a routine**: support points,
coordination demands, counting per side, alternatives and reviewed progressions.
That metadata is available today; automatic weekly programme generation is a
future step. [Catalogue and educational criteria →](docs/exercise-sources.md) ·
[Planning metadata →](docs/exercise-planning.md)

### Make space for yoga

**Yoga** includes a library of **24 asanas**, with Spanish, Sanskrit and English
names. Explore preparation, breathing, expected sensations, adaptations and
ways to leave each posture, alongside sourced historical and cultural context.
Each asana uses the same anatomical model as the exercise library. Choose
**Hombre** or **Mujer** globally; the cards, posture viewer and guided practice
follow that choice. Explore the posture in 3D, with separately rendered left and
right sides for asymmetric asanas. The body moves through preparation, entry,
hold and exit while the camera stays fixed. Pause, scrub or slow the demonstration;
watching it never starts the practice timer. Animated previews and the viewer
respect reduced motion, while static renders keep the guidance available when
WebGL cannot run.

Build a named practice from scratch or adapt a starter sequence. Reorder or
repeat asanas, set each hold and practice asymmetric postures on both sides.
The guided timer pauses between postures and lets you skip or finish early.
Save the time actually practiced, a snapshot of the sequence and optional notes.
Practices and history use the same local or account storage as the rest of the
app. [Yoga practices →](docs/yoga.md) · [Content and sources →](docs/yoga-sources.md)

### Turn a little practice into a visible habit

**Mi rutina** starts with six equipment-free movements. Use **Personalizar** to
add, remove and reorder exercises, and choose one to three sets. Start a session,
record the repetitions you actually complete, then **save the finished workout**.
Walks, runs, bike rides and other aerobic activity have their own log.

![Customizing a routine, recording a demonstration set and saving the completed session to local progress](docs/media/routine-flow.gif)

**Mi progreso** brings together the weekly view, activity history and XP.
The history starts empty: watching the animation does not count as training.
Earn **10 XP per recorded strength set** and **1 XP per recorded cardio or yoga minute**,
with a level every 100 XP. These are habit-building counters, not fitness scores
or calorie estimates. [See the progress view →](docs/media/progress.png)

Accounts add named routines, a tracking time zone and a weekly strength plan.
The plan's consistency metric counts **weeks meeting your chosen number of strength-training days**;
rest days do not break it, and moving a session within the week is fine. The
local activity streak is a separate metric.

<details>
<summary><strong>The six-movement starting point</strong></summary>

| Movement | What it introduces |
| --- | --- |
| Knee push-up | Pushing and trunk control |
| Squat | Coordinating hips and knees |
| Glute bridge | Hip extension |
| Alternating dead bug | Trunk control with moving limbs |
| Prone W raise | Light scapular control |
| Calf raise | Ankle and calf control |

The default is two sets and a two-session weekly goal, both editable. Read the
preparation notes and each exercise's technique cues in the app.

**Loaded pulling needs equipment.** A prone W does not replace a row or pull-up
for the back and biceps. The two rowing variations require a suitable bar or
rings and are outside the starter routine.

</details>

### Put your practice in context

**Mi salud** brings body measurements, sleep, activity, meals, supplements and
dated personal goals into the same workspace. Record observations manually or
preview a **normalized Klisteni JSON** import before confirming it. Records keep
their declared source and device, and can be edited, deleted and exported.

![The health dashboard with body trends, sleep and training consistency, populated with fictional local records](docs/media/health-dashboard.png)

Choose **7, 30 or 90 days**, a body measurement and its source. Explore observed
trends, sleep coverage and days with recorded strength practice. Missing values
stay missing; separate units and devices are not silently combined. Expand the
data tables to inspect the values behind the charts.

**Automatic watch synchronization is still planned.** Samsung Health / Health
Connect need an Android bridge; Google Health needs a separate connector and
provider access. The importer accepts Klisteni's documented JSON format, not raw
Samsung CSV/ZIP exports. [Health dashboard →](docs/health-dashboard.md) ·
[Import format →](docs/health-import.md) · [Integration status →](docs/health-integrations.md) ·
[Watch the health tour →](docs/media/health-tour.gif)

### Keep it with you

<table>
  <tr>
    <td align="center"><img src="docs/media/mobile-routine.webp" alt="The routine and anatomical viewer on a narrow mobile screen" width="300"></td>
    <td align="center"><img src="docs/media/health-dashboard-mobile.png" alt="The health dashboard on mobile, with fictional local records" width="300"></td>
  </tr>
  <tr>
    <td align="center"><strong>Your movement workspace</strong></td>
    <td align="center"><strong>Your observations over time</strong></td>
  </tr>
</table>

The layout adapts to a phone. Text guidance remains available if WebGL cannot
start, and reduced-motion preferences stop animated previews. This is a web app;
it is not yet a PWA and does not guarantee offline availability.

## Your browser first. An account when you need one.

The local experience is free and needs no account. An invited account adds
server persistence and access from another device in an explicitly configured
instance. The default public build is a complete local demo: it contains no
login, paywall, account client or analytics, and makes no backend requests.

| Capability | Free local mode | Invited account with active cloud access |
| --- | --- | --- |
| Catalogue, anatomy and exercise guidance | Yes | Yes |
| Customize a routine and log practice | In this browser | Saved to your account |
| Health records, goals and dashboard | In this browser | Saved to your account |
| Export / import your data | Yes | Yes |
| Named routines, weekly plan and tracking time zone | — | Yes |
| Sync between devices | — | API + PostgreSQL |

Trial invitations provide **15 days of cloud access** from registration.
Administrators can issue personal or shareable invitations and grant lifetime
access. When cloud access expires, the account keeps reading, export and record
deletion available; new cloud writes need renewed access. Free local use remains
available. **Mercado Pago billing is development-only and disabled by default**;
production charging is not implemented.

These are repository capabilities. Account availability on a hosted release
requires the API, database and deployment to be configured and verified.
[Accounts and recovery →](docs/accounts.md) · [Invitations and subscriptions →](docs/subscriptions.md)

### Data you can take with you

- **Local means this browser and origin.** Export a JSON copy before clearing
  storage or changing devices. Local mode does not coordinate writes across tabs.
- **Import is deliberate.** Signing in does not automatically upload the practice
  found on a shared device. Personal v2 exports include settings and health;
  legacy v1 training-history imports remain supported.
- **Saved means confirmed.** Account synchronization distinguishes pending,
  confirmed and failed writes, and detects conflicting settings changes.
- **Finish before you leave in B2C.** An active workout lives in memory until you save
  it. Reloading discards its unfinished sets.
- **The public demo has no analytics.** An operator can configure optional
  Umami in an instance; it loads after consent and sends a sanitized site visit,
  without routines, health values, notes, email or account IDs. Consent can be
  refused or withdrawn from privacy preferences.

Fonts come from your device. Exercise references open external websites only
when selected. The demo's `/privacy` page describes local storage; an instance
adds its operator's public profile and disclosures from external configuration.
[Modes, privacy and the public profile →](docs/public-demo.md)

## Run locally

You need **Node.js 24+**, **pnpm 12.7.0** and a modern browser. The 3D viewer uses
**WebGL 2**. Models and exercise previews are already included.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by Vite, normally [localhost:5173](http://localhost:5173).
The default `VITE_APP_MODE=demo` needs **no API key, database, operator profile
or Blender installation**. Models and previews are ready to use.

For accounts, set `VITE_APP_MODE=instance`, provide
`KLISTENI_PUBLIC_PROFILE_FILE` with your operator's public disclosures, and follow
the [API and PostgreSQL setup](docs/accounts.md#local-instance-with-disposable-configuration). The profile is
public build data, never a place for credentials. Real deployment configuration
belongs outside this repository. [Instance setup →](docs/public-demo.md)

For UI iteration with the full local API, database and a fictional administrator,
run `node scripts/dev-ui-instance.mjs`. [Local UI workspace →](docs/ui-iteration.md)

For the independent gym product, start Docker with Compose available and run:

```sh
pnpm dev:b2b
```

Open `http://127.0.0.1:4200/backoffice/` or `http://127.0.0.1:4200/app`.
The helper creates private local credentials, migrates its own PostgreSQL and
seeds Atlas/Sur. [Demo accounts and ports →](docs/b2b.md#demo-local) ·
[Continue on a Mac →](docs/development-macos.md)

```sh
# Build all packages, then serve the web bundle locally
pnpm build
pnpm --filter @klisteniapp/web preview --host 127.0.0.1
```

The web output is `apps/web/dist`. Serve the demo with any static host that
supports SPA fallback to `index.html`, including `/privacy`. The optional server
instance has separate web/API images and generic deployment examples.
[Deployment and rollback →](docs/deployment.md)

## Built to keep the explanation close to the code

Klisteni uses a **pnpm / Turborepo** monorepo with **React 19, TypeScript, Vite,
Three.js, React Three Fiber, Drei,
Zustand and Zod**. The API uses **Better Auth and PostgreSQL**.

| Location | Responsibility |
| --- | --- |
| [`apps/web`](apps/web) | Responsive UI, 3D viewer, forms, health dashboard and browser state |
| [`apps/api`](apps/api) | Accounts, invitations, access rules, personal data and development billing |
| [`apps/member-web`](apps/member-web) | B2B public websites, QR destinations and member training |
| [`apps/backoffice`](apps/backoffice) | Gym preparation, publication, programmes and staff workflows |
| [`apps/b2b-api`](apps/b2b-api) | Independent B2B identities, tenancy, PostgreSQL and protected media |
| [`packages/b2b-contracts`](packages/b2b-contracts), [`b2b-domain`](packages/b2b-domain), [`b2b-client`](packages/b2b-client), [`b2b-react`](packages/b2b-react), [`b2b-ui`](packages/b2b-ui) | B2B contracts, pure rules, HTTP, session hooks and shared presentation |
| [`packages/scene-schema`](packages/scene-schema) | Shared validated contracts for exercises, records and plans |
| [`packages/geometry`](packages/geometry) | Exercise poses and kinematics, independent of React |
| [`packages/catalog-base`](packages/catalog-base) | Shared exercise catalog and reviewed planning metadata |
| [`packages/anatomy-viewer`](packages/anatomy-viewer) | Shared anatomy and optional equipment viewers |
| [`packages/model-assets/public/models`](packages/model-assets/public/models) | Anatomical GLB, joint landmarks and provenance |
| [`assets/blender`](assets/blender) | Editable anatomy scene and optimization report |
| [`scripts`](scripts) | Anatomy builds, validation and reproducible media capture |

Blender prepares the anatomy assets; TypeScript drives the poses in the browser.
The `.blend` source, GLB and manifests stay together. The same `ExerciseStage`
renders the live viewer and the catalogue previews, with source hashes to detect
stale images. [Architecture →](docs/architecture.md)

### Reproduce the visuals

Preview production is currently deferred until the Blender work is ready. Keep
the existing files and provenance; the commands below document the later workflow.
The full preview check is not recorded as passing for this handoff.

```sh
# Catalogue previews: Playwright Chromium + cwebp / img2webp
pnpm previews:generate
pnpm previews:generate --exercise squat --gif  # Also requires FFmpeg
pnpm previews:check

# Yoga posters: the same 3D poses and anatomical variants as the live viewer
pnpm yoga-previews:generate
pnpm yoga-previews:check

# README screenshots and GIFs: Playwright Chromium + cwebp + FFmpeg
node scripts/capture-readme.mjs
node scripts/capture-readme-health.mjs
node scripts/capture-readme.mjs --check
node scripts/capture-readme-health.mjs --check
```

The README capture scripts explicitly select demo mode and use isolated browser
contexts and local servers. `--mode instance` instead uses the checked-in
example public profile for an anonymous instance preview; it never loads an
operator's private profile. The manifests record which mode was captured.
Health and progress captures use schema-validated fictional fixtures, never
personal account data. [README media, reproduction and attribution →](docs/readme-media.md) ·
[Exercise preview pipeline →](docs/exercise-previews.md)

### Check a change

For code-only work during the preview deferral, run the applicable checks below.
These do not replace the complete release gate or its outstanding asset check.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# B2B integration requires a disposable B2B_TEST_DATABASE_URL
pnpm test:b2b:api
pnpm test:b2b:e2e
```

Full gates, once the preview backlog is resolved:

```sh
pnpm check            # Lint, types, domain tests, preview hashes and build
pnpm test:e2e         # Public desktop/mobile browser flows
pnpm test:analytics   # Isolated consent and privacy flows
pnpm check:all        # All three commands above

# Account/database checks require a disposable TEST_DATABASE_URL
pnpm test:api
pnpm test:accounts
```

Install Chromium and WebKit for the B2B matrix with
`pnpm --filter @klisteniapp/web exec playwright install chromium webkit`.
The public browser suite uses `127.0.0.1:4174`; run build-owning browser suites
sequentially. Database tests skipped without `TEST_DATABASE_URL` do not validate
PostgreSQL behavior. [Account test setup →](docs/accounts.md#verification)

`pnpm check:release` requires independent disposable B2C and B2B database URLs
and runs the suites sequentially without browser retries. Both that command and
the default GitLab `quality` job still require `previews:check`; the deferred
previews prevent claiming a complete green gate. See the
[recorded results and remaining acceptance](docs/b2b-release.md).

For anatomy changes, run `node scripts/validate-anatomy.mjs` and visually review
poses from multiple angles. Rebuilding the source asset uses
`node scripts/build-anatomy.mjs` and requires Blender. Passing tests does not
establish biomechanical accuracy.

## What's next

Professional review of movement trajectories, recovery of unfinished B2C sessions,
weekly programme generation, automatic health connectors, broader translations and
installable/offline support are future work. The current focus is a complete,
inspectable loop: **see → understand → practice → record**. B2B training drafts
already recover after reload. Its next content work is the first reviewed machine
and authored movement in Blender, followed by phone/QR acceptance and the deferred
derivatives; follow the [roadmap](docs/roadmap-implementacion.md).

## Credits and licenses

The original application code is **[MIT](LICENSE)**. Anatomical assets and their
derived renders use **CC BY-SA 4.0**, with credits to **BodyParts3D — The Database
Center for Life Science**, **Z-Anatomy — Gauthier Kervyn and contributors**, and
**Lluís Vinent Juanico** for the source FBX distribution. Code licensing does not
replace the anatomy license.

[License scope and third-party notices](NOTICE) · [Full anatomy attribution and license](packages/model-assets/public/models/NOTICE.md) ·
[Preview attribution](packages/model-assets/public/previews/NOTICE.md) ·
[README media attribution](docs/media/NOTICE.md)
