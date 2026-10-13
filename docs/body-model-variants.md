<a id="modelo-corporal-global"></a>
# Global body model

In **Ajustes → Apariencia → Modelo corporal**, choosing **Mujer** or **Hombre**
changes the representation throughout the app: routine, catalog, 3D demonstrations,
training and atlas, including posters, animated WebPs, generated GIFs and region
thumbnails. Instructions, references and exercise programming remain unchanged:
this visual preference communicates neither sex, identity nor health data.

<a id="persistencia-y-compatibilidad"></a>
## Persistence and compatibility

- Validated field: `PersonalSettings.anatomicalModel`, enum `female | male`.
  Older data without it resolves to `male`, without inserting a parse-time default.
- Accounts use existing revision-based settings saving, API and PostgreSQL. A
  second device loads that account's value. A 409 conflict never silently overwrites
  the server revision.
- Local/demo use saves it in browser personal data and includes it in exports/imports,
  without requiring an account.
- Logout restores the local preference. Another account uses its own settings,
  without inheriting the previous account's choice.
- An older client/backup omitting the field retains the existing choice. Unknown
  values are rejected. No SQL migration is required: settings are validated JSON.
- `selectAnatomicalModel` is the shared consumer entrypoint; consumers must not
  read browser storage directly or infer the choice from the health profile.

<a id="geometría-y-alcance"></a>
## Geometry and scope

`packages/anatomy-viewer/src/anatomy-variants.ts` contains reproducible shoulder,
waist, pelvis and external chest-contour parameters. The common field modifies
skin, muscles, bones and joint references consistently; only the chest contour
is specific to skin. Normalized height is preserved. Normals adapt while retaining
source edges, and posterior supports, palms and anterior torso are calibrated
from the selected surface.

The **Mujer variant is an illustrative adaptation of the existing source**, not
another anatomical acquisition or a clinically validated female atlas. Parameters
are not population averages. Original GLB and Blender files remain intact; each
preparation creates and releases its own geometry. Provenance appears in settings,
the viewer's accuracy disclosure and `public/models/NOTICE.md`.

For female skin, `anatomy-variant-surface.ts` replaces the source's male genital
details with two neutral surfaces preserving original outer boundaries. These
are illustrative pelvic surfaces, not female organs. This simplification affects
neither catalog muscles nor the bone view.

Muscle names/colors describe the same educational catalog in both variants.
Selecting a body adds no organs, diagnoses or specific recommendations. Third-party
documents/links retain original content; static README recordings illustrate the
captured version and are not account-linked views.

<a id="generación-de-medios"></a>
## Media generation

Full derivative regeneration/review is deferred until 3D models stabilize, per the
[roadmap](roadmap-implementacion.md). Preserve current files; these commands belong
to later content work.

```sh
# 37 exercises × 2 variants, posters, WebPs and GIFs.
pnpm previews:generate --gif

# Iterate on a specific combination.
pnpm previews:generate --model female --exercise squat --gif

# 12 muscle thumbnails × 2 variants.
pnpm body-previews:generate

# Check exercises, body regions and yoga: sources and generated files.
pnpm previews:check
```

Base media retain `/previews/{id}…` and `/previews/body/{muscle}.webp`. Female media
use `/previews/female/{id}…` and `/previews/female/body/{muscle}.webp`. The exercise
manifest records each combination in `variants.{male|female}.exercises`; thumbnails
have per-variant manifests. Hashes include morphology, rig and renderer code to
detect stale captures. Never edit a hash to bypass regeneration.

Posters remain lightweight images. Animations activate only when appropriate and
respect reduced motion, tab visibility and viewport. Failed files show a fallback;
switching variants loads the new file without reusing the previous failure.

<a id="verificación"></a>
## Verification

Tests cover older data, backups, invalid values, account isolation, synchronization
between two browsers against API/PostgreSQL, revision conflicts and global changes
across app surfaces. Geometry checks use the real GLB: selectable structures,
unmutated originals, finite poses and head/hand/foot/knee/torso supports throughout
both variants' cycles.

Also review skin, muscles and bones from front, side and back; test squats,
push-ups, prone/supine supports and rows. Geometry tests do not certify clinical
fidelity or replace visual review. Feature changes require capture regeneration
before publication.
