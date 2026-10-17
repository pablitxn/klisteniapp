import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { catalogManifest, exercises } from '@klisteniapp/catalog-base';
import {
  ExerciseInputSchema,
  ExerciseSchema,
  IdSchema,
  type Exercise,
} from '@klisteniapp/b2b-contracts';
import {
  ReviewedRelationSchema,
  RoutineVersionV2Schema,
  LegacySupplementSchema,
  type AssignableRoutine,
  type ReviewedRelation,
  type RoutineVersionV2,
} from '@klisteniapp/b2b-contracts/product-v2';
import type { ProgramVersion } from '@klisteniapp/b2b-contracts/training';
import type { AuthorizedProductContext } from '../product-context.ts';
import { denied, conflict, missing } from '../errors.ts';

/** Sorted keys make PostgreSQL JSONB and in-memory snapshots hash identically. */
export function contentHash(value: unknown): string {
  const normalize = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(normalize)
      : v !== null && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, normalize(x)]),
          )
        : v;
  return createHash('sha256')
    .update(JSON.stringify(normalize(value)))
    .digest('hex');
}

/** Keep these bytes compatible with seed v1; review lives beside the old rows. */
export function canonicalExerciseInput(base: (typeof exercises)[number]) {
  return ExerciseInputSchema.parse({
    name: base.name,
    description: base.description,
    instructions: [...base.setup, ...base.steps, ...base.cues],
    equipment: base.equipment,
    muscles: base.primaryMuscles,
    pattern: base.pattern,
    animationId: base.id,
    assets: [
      {
        id: `base-${base.id}-poster-v1`,
        kind: 'image',
        label: base.name,
        url: `/previews/${base.id}-poster.webp`,
        attribution:
          'Klisteni exercise preview; see /models/NOTICE.md for anatomical model attribution.',
      },
    ],
  });
}

export const REVIEWED_CATALOG_REVISION = contentHash({ catalogManifest, exercises });
export function canonicalExercises(): Exercise[] {
  return exercises.map((base) =>
    ExerciseSchema.parse({
      ...canonicalExerciseInput(base),
      id: base.id,
      scope: 'base',
      status: 'published',
      version: 1,
      revision: 0,
    }),
  );
}

export function isUnchangedCanonical(exercise: Exercise): boolean {
  const base = exercises.find((item) => item.id === exercise.id);
  if (
    !base ||
    exercise.scope !== 'base' ||
    exercise.branchId ||
    exercise.status !== 'published' ||
    exercise.version !== 1 ||
    exercise.revision !== 0
  )
    return false;
  const keys = Object.keys(canonicalExerciseInput(base));
  const data = Object.fromEntries(keys.map((key) => [key, exercise[key as keyof Exercise]]));
  return contentHash(data) === contentHash(canonicalExerciseInput(base));
}

/** Only explicitly directed canonical links. No user, source dose or load input. */
export function projectReviewedRelations(
  source: Exercise,
  available: readonly Exercise[],
): ReviewedRelation[] {
  if (!isUnchangedCanonical(source)) return [];
  const base = exercises.find((item) => item.id === source.id)!;
  return base.planning.relations.flatMap((link) => {
    const target = available.find((item) => item.id === link.targetId);
    const reviewedTarget = exercises.find((item) => item.id === link.targetId)!;
    if (!target || !isUnchangedCanonical(target)) return [];
    const planning = reviewedTarget.planning;
    return [
      ReviewedRelationSchema.parse({
        id: `reviewed-${base.id}-${link.targetId}-${REVIEWED_CATALOG_REVISION.slice(0, 12)}`,
        sourceExerciseId: source.id,
        targetExerciseId: target.id,
        type: link.type,
        conditions: link.conditions,
        rationale: link.rationale,
        catalogRevision: REVIEWED_CATALOG_REVISION,
        sourceContentHash: contentHash(base),
        targetContentHash: contentHash(reviewedTarget),
        target,
        requirements: [
          `position:${planning.requirements.position}`,
          ...planning.requirements.supports.map((support) => `support:${support}`),
          `balance:${planning.requirements.balance}`,
          ...planning.requirements.capabilities.map((capability) => `capability:${capability}`),
          `laterality:${planning.laterality}`,
          `count:${reviewedTarget.reps.perSide ? 'per-side' : 'together'}`,
          `preserves-role:${link.preservesRole}`,
          `reviewed-on:${planning.review.reviewedOn}`,
          ...planning.review.sourceUrls.map((url) => `source:${url}`),
        ],
        targetDose: {
          mode: 'repetitions',
          sets: { kind: 'fixed', value: reviewedTarget.defaultSets },
          repetitions: {
            kind: 'range',
            min: reviewedTarget.reps.min,
            max: reviewedTarget.reps.max,
          },
          durationSeconds: null,
          load: { mode: 'bodyweight' },
          restSeconds: { kind: 'fixed', value: reviewedTarget.restSeconds },
          laterality: planning.laterality === 'unilateral' ? 'per-side' : planning.laterality,
          targetRpe: null,
          notes: [reviewedTarget.tempo, reviewedTarget.note].filter(Boolean).join('\n'),
        },
      }),
    ];
  });
}

/** Explicit successor migration hook for CONTRACT. Never updates exercise JSON. */
export async function enrichReviewedCatalog(db: PoolClient): Promise<number> {
  const rows = await db.query<{
    id: string;
    organization_id: string | null;
    branch_id: string | null;
    data: unknown;
    status: string;
    version: number;
    revision: number;
  }>('SELECT * FROM b2b_exercise WHERE organization_id IS NULL FOR SHARE');
  const available = rows.rows.flatMap((row) => {
    const parsed = ExerciseSchema.safeParse({
      ...(row.data as object),
      id: row.id,
      scope: 'base',
      branchId: row.branch_id,
      status: row.status,
      version: row.version,
      revision: row.revision,
    });
    return parsed.success ? [parsed.data] : [];
  });
  let inserted = 0;
  for (const source of available)
    for (const relation of projectReviewedRelations(source, available)) {
      const result = await db.query(
        `INSERT INTO b2b_reviewed_relation(id,source_exercise_id,target_exercise_id,catalog_revision,source_content_hash,target_content_hash,metadata)
       VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,
        [
          relation.id,
          relation.sourceExerciseId,
          relation.targetExerciseId,
          relation.catalogRevision,
          relation.sourceContentHash,
          relation.targetContentHash,
          relation,
        ],
      );
      inserted += result.rowCount ?? 0;
    }
  return inserted;
}

/** WP02 calls this at publication with its authorized, branch-filtered catalog. */
export function freezeReviewedRelations(
  routine: AssignableRoutine,
  available: readonly Exercise[],
): ReviewedRelation[] {
  const result = new Map<string, ReviewedRelation>();
  for (const step of routine.steps) {
    if (step.substitutionPolicy === 'blocked') continue;
    const source = available.find((exercise) => exercise.id === step.exerciseId);
    if (source)
      for (const relation of projectReviewedRelations(source, available))
        result.set(relation.id, relation);
  }
  return structuredClone([...result.values()]);
}

/** Legacy adoption is explicit and immutable. Missing dose/laterality must first
 * be confirmed by WP02; legacy manual allowlists are never relabelled reviewed. */
export function legacySupplement(
  original: ProgramVersion,
  confirmed: RoutineVersionV2,
  memberId: string,
) {
  const supplement = RoutineVersionV2Schema.parse(confirmed);
  if (
    original.name !== supplement.name ||
    original.description !== supplement.description ||
    original.programId !== supplement.programId ||
    original.version !== supplement.version ||
    original.publishedAt !== supplement.publishedAt ||
    original.steps.length !== supplement.steps.length ||
    original.steps.some(
      (step, i) =>
        step.id !== supplement.steps[i].id || step.exerciseId !== supplement.steps[i].exerciseId,
    )
  )
    throw conflict();
  for (const [index, old] of original.steps.entries()) {
    const dose = supplement.steps[index].dose;
    const fixed = (value: unknown, expected: number) =>
      contentHash(value) === contentHash({ kind: 'fixed', value: expected });
    if (
      !fixed(dose.sets, old.sets) ||
      !fixed(dose.restSeconds, old.restSeconds) ||
      (old.reps === null
        ? dose.mode !== 'duration' || !fixed(dose.durationSeconds, old.durationSeconds!)
        : dose.mode !== 'repetitions' || !fixed(dose.repetitions, old.reps)) ||
      (old.loadKg !== null &&
        (dose.load.mode !== 'external' || !fixed(dose.load.kilograms, old.loadKg))) ||
      dose.targetRpe !== old.targetRpe ||
      dose.notes !== old.notes
    )
      throw conflict();
  }
  for (const exercise of original.exercises) {
    if (
      supplement.relations.some((r) => r.sourceExerciseId === exercise.id) &&
      !isUnchangedCanonical(exercise)
    )
      throw conflict();
  }
  // Verify the source against the old snapshot, the target against canonical
  // review, and all metadata against the frozen producer. IDs alone prove none
  // of these. Local source rows absent from history cannot acquire review.
  for (const relation of supplement.relations) {
    const source = original.exercises.find((exercise) => exercise.id === relation.sourceExerciseId);
    const expected =
      source &&
      projectReviewedRelations(source, supplement.exercises).find(
        (candidate) => candidate.id === relation.id,
      );
    if (!expected || contentHash(expected) !== contentHash(relation)) throw conflict();
  }
  return LegacySupplementSchema.parse({
    schemaVersion: 2,
    scope: { ...supplement.scope, memberId },
    programId: original.programId,
    version: original.version,
    sourceSnapshotHash: contentHash(original),
    supplement,
  });
}

export async function saveLegacySupplement(
  context: AuthorizedProductContext,
  value: ReturnType<typeof legacySupplement>,
  operationId: string,
) {
  IdSchema.parse(operationId);
  LegacySupplementSchema.parse(value);
  await context.authorizeMember(value.scope.memberId, 'history');
  if (
    context.accessMode !== 'active' ||
    !context.capabilities.has('edit-planning') ||
    value.scope.organizationId !== context.organizationId ||
    value.scope.branchId !== context.branchId ||
    value.supplement.scope.organizationId !== context.organizationId ||
    value.supplement.scope.branchId !== context.branchId
  )
    throw denied();
  const original = await context.db.query<{ snapshot: ProgramVersion; schema_version: number }>(
    'SELECT snapshot,schema_version FROM b2b_program_version WHERE organization_id=$1 AND branch_id=$2 AND program_id=$3 AND version=$4 FOR SHARE',
    [context.organizationId, context.branchId, value.programId, value.version],
  );
  if (!original.rows[0]) throw missing();
  if (
    original.rows[0].schema_version !== 1 ||
    contentHash(original.rows[0].snapshot) !== value.sourceSnapshotHash
  )
    throw conflict();
  const parsed = legacySupplement(
    original.rows[0].snapshot,
    value.supplement,
    value.scope.memberId,
  );
  // Storage is routine/branch scoped, not member scoped. Personal envelopes are
  // constructed at export time to avoid sharing the first adopter's member ID.
  const inserted = await context.db.query(
    `INSERT INTO b2b_routine_supplement(organization_id,branch_id,program_id,program_version,source_snapshot_hash,snapshot)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
    [
      context.organizationId,
      context.branchId,
      value.programId,
      value.version,
      value.sourceSnapshotHash,
      parsed.supplement,
    ],
  );
  const saved = await context.db.query<{ source_snapshot_hash: string; snapshot: unknown }>(
    'SELECT source_snapshot_hash,snapshot FROM b2b_routine_supplement WHERE organization_id=$1 AND branch_id=$2 AND program_id=$3 AND program_version=$4',
    [context.organizationId, context.branchId, value.programId, value.version],
  );
  if (
    saved.rows[0].source_snapshot_hash !== value.sourceSnapshotHash ||
    contentHash(saved.rows[0].snapshot) !== contentHash(parsed.supplement)
  )
    throw conflict();
  if (inserted.rowCount)
    await context.db.query(
      `INSERT INTO b2b_audit(organization_id,branch_id,actor_id,operation_id,action,resource_id,before_revision,after_revision,changed_fields)
     VALUES($1,$2,$3,$4,'routine.supplement',$5,0,1,'["routine.supplement"]')`,
      [
        context.organizationId,
        context.branchId,
        context.actorId,
        operationId,
        `${value.programId}-${value.version}`,
      ],
    );
  return parsed;
}
