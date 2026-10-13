<a id="metadatos-para-organizar-ejercicios"></a>

# Exercise organization metadata

Phase1 classified/validated15 before expansion; phase2 added12 variants, phase3
10 cards:37 exercises/reviewable metadata-relations. No week generation/session
assignment/individual suitability/routine-history modification.

`packages/scene-schema/src/exercise-planning.ts`, exported
`@klisteniapp/scene-schema`, mandatory `ExerciseSchema.planning`. Data
`packages/catalog-base/src/exercise-planning.ts`, incorporated via `exercises.ts`.
Localized UI label **Cómo encaja en tu rutina** (how it fits your routine); relation opens target, never replaces routine exercise.

<a id="campos"></a>

## Fields

| Field | Meaning | Limit |
| --- | --- | --- |
| `movementFamily` | Specific represented gesture: horizontal push/standing hinge/supine hip extension | Not inferred from shared muscles/general pattern |
| `planningRoles` | Editorial possible role; hinge may be hip extension/hinge practice | Shared role permits no substitution/quantified stimulus |
| `requirements.position` | Demonstrated variant position | Not every mentioned variant |
| `requirements.supports` | Load-bearing contacts; `feet` supported foot, `forefeet` forefoot, `grip` bodyweight grip | No force/pressure/load fraction; contacts may vary |
| `requirements.balance` | Stable/weight transfer/reduced base | Qualitative, no risk score |
| `requirements.capabilities` | Technical control: high plank/quadruped pelvis/grip | Not clinical/inferred from XP-level-sessions; empty not suitability certification |
| `laterality` | `bilateral` joint rep; `alternating` side within cycle; `unilateral` complete side set then switch | Alternating/unilateral reps per side; playback/log distinction retained |
| `relations` | Explicitly reviewed directed links to existing IDs | Empty means no reviewed compatible relation, not impossible variant |
| `review` | `editorial`, date, URLs,`movement-classification-not-effect-equivalence`; `adaptationNote` source changes | Gesture source not training-effect equivalence; editorial-review date |

Equipment/difficulty/muscles/sets/reps/rest remain card, not duplicated in planning.
Text tempo not exact duration; no muscle-activation/fatigue coefficients.

<a id="relaciones-y-condiciones"></a>

## Relations and conditions

`targetId`, `type`, `preservesRole`, `conditions`, `rationale`; alternative/regression/
progression directed, no assumed reciprocity/transitivity. Every relation requires
`target-requirements-confirmed`, `use-target-dose`: check target equipment/level/
requirements, use own dose. Progression `accept-higher-demand`, regression
`accept-lower-demand`; position-support change `accept-different-supports`,
balance/laterality `accept-different-balance`/`accept-different-laterality`.
`accept-different-emphasis` records relevant technique/emphasis, e.g. hand width/
elevated-pelvis stepping vs raising/lowering. Conditions declared; phase neither
stores user confirmation nor applies change.

Conservative same specific family/shared role. Alternative editorial role option,
not equal load/effect/outcome. Progression/regression chosen editorial direction,
not provable by muscle/label validator. Initial knee↔full push-up; second26 directed,
third+16=**42**. Push/squat range-pause/supine-quadruped/scapular/calves-bridges plus
wide squat/bent-knee row/single-leg hinge. Conditions per direction.
`supine-limb-control`/`quadruped-limb-control` include single-limb/contralateral,
not incorrectly all contralateral.

Nine `relations: []`: pike, reverse lunge, lateral lunge, mountain climber, crunch, static
lunge, forward lunge, prone hip extension, shoulder taps. W not row substitute, pike
not automatic horizontal push, crunch not dead-bug trunk control. Squat/lunges share
broad role/different families; bridge/good morning/prone extension likewise.

20 Initial no-equipment: two push/three squat/three hip/nine stability/two scapular/
one ankle. No resisted pull without equipment/second Initial calf raise. Initial
bridge/good morning/prone extension not automatic alternatives. Future organizer
must allow missing alternative/preserve exercises across weeks/declare missing
coverage; no invented variety or W-T-Y replacement for pulling gap.

Third new `forward-lunge`, `prone-hip-extension`, `high-plank-shoulder-tap` retain
knee-dominant/hip-extension/trunk-stability roles without automatic links. Standing
hinge accepts bilateral/unilateral with explicit balance/count difference.
Supine march/heel slide/heel tap clarify supported foot; supine position not identical gesture.

<a id="validación"></a>

## Validation

`ExercisePlanningSchema`: enums/unique lists/real dates/URLs/required conditions/
family-role `MOVEMENT_PLANNING_ROLES`. Target uses shared `ExerciseIdSchema`, factory
receives schema to avoid duplicate registry/import cycles.
`validateExercisePlanningCatalog(catalog)` returns `exerciseId`, `code`, `message`
issues; empty data invariants pass. Duplicate ID/missing target/self-link/invalid
metadata/shared preserved role/same family/support-balance-laterality acceptance/
`reps.perSide` coherence/source-card inclusion. Runs at catalog load/fails inconsistency.

Does not prove editorial classification/anatomical accuracy/personal suitability;
content/demonstration/source review still required.

<a id="incorporar-o-revisar-un-ejercicio"></a>

## Add or review exercise

1. Verify reference/exact represented variant/adaptations; matching `sources`/`review.sourceUrls` URL.
2. Specific family/permitted roles/position/support/balance/control. Explicitly extend enum/role policy/UI labels for new concept.
3. Laterality/check reps.perSide/animation cycle.
4. Start no relations; add after target/direction/role/requirements-dose review, never muscle intersection.
5. Card/model/preview together; update `reviewedOn`/adaptation explanation.
6. Catalog/planning/scene-schema/lint/typecheck; regenerate/check derivatives if manifest sources change.

Weekly routines/preferences-exclusions/confirmed requirements/variation history/
session substitutions need additional contracts separating original plan/actual work;
outside phase scope.
