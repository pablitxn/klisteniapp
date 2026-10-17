import {
  ExerciseSchema,
  MachineSchema,
  type Exercise,
  type Machine,
} from '@klisteniapp/b2b-contracts';
import {
  checkRoutineAssignable,
  type AssignableRoutine,
  type ReviewedRelation,
} from '@klisteniapp/b2b-contracts/product-v2';
import { exerciseAvailability, exerciseMachineIds } from '@klisteniapp/b2b-domain/catalog';
import { HttpError } from '../errors.ts';
import type { AuthorizedProductContext } from '../product-context.ts';
import type { PlanningDependencies } from './index.ts';
import { canonicalJson } from './operations.ts';

type CatalogRow = {
  id: string;
  organization_id: string | null;
  branch_id: string | null;
  status: string;
  version: number;
  revision: number;
  data: object;
};

/** Match the existing catalog's explicit cross-branch publication and hide rules.
 * A guessed ID never grants access to another tenant or unpublished branch. */
async function resources(
  context: AuthorizedProductContext,
  kind: 'exercise' | 'machine',
  ids: string[],
  published: boolean,
) {
  const table = `b2b_${kind}`;
  const rows = await context.db.query<CatalogRow>(
    `SELECT * FROM ${table} c WHERE c.id=ANY($1::text[]) AND (c.organization_id IS NULL OR c.organization_id=$2)
     AND (NOT $4::boolean OR c.status='published')
     AND (c.branch_id IS NULL OR c.branch_id=$3 OR (c.status='published' AND EXISTS(
       SELECT 1 FROM b2b_branch_catalog bc WHERE bc.organization_id=$2 AND bc.branch_id=$3 AND bc.kind=$5 AND bc.resource_id=c.id AND bc.enabled)))
     AND NOT EXISTS(SELECT 1 FROM b2b_branch_catalog bc WHERE bc.organization_id=$2 AND bc.branch_id=$3 AND bc.kind=$5 AND bc.resource_id=c.id AND NOT bc.enabled)
     ORDER BY c.id FOR SHARE OF c`,
    [ids, context.organizationId, context.branchId, published, kind],
  );
  if (rows.rowCount !== ids.length)
    throw new HttpError(
      409,
      'INVALID_INPUT',
      'La rutina contiene recursos no disponibles en esta sede.',
    );
  return rows.rows.map((row) => ({
    ...row.data,
    id: row.id,
    ...(row.branch_id ? { branchId: row.branch_id } : {}),
    scope: row.organization_id ? 'organization' : 'base',
    status: row.status,
    version: row.version,
    revision: row.revision,
  }));
}

export type PublicationRelations = (
  context: AuthorizedProductContext,
  content: AssignableRoutine,
  exercises: readonly Exercise[],
) => Promise<ReviewedRelation[]>;

/** WP04 supplies the explicit reviewed-relation resolver. Even an empty result
 * must be a deliberate result from that resolver, never a silent fallback. */
export function createPlanningResources(
  resolveRelations: PublicationRelations,
): Pick<
  PlanningDependencies,
  'validateDraftResources' | 'publicationResources' | 'validateAssignment'
> {
  const exercises = async (
    context: AuthorizedProductContext,
    ids: string[],
    published: boolean,
  ): Promise<Exercise[]> =>
    (await resources(context, 'exercise', [...new Set(ids)], published)).map((row) =>
      ExerciseSchema.parse(row),
    );
  const machines = async (
    context: AuthorizedProductContext,
    found: readonly Exercise[],
  ): Promise<Machine[]> => {
    const ids = [...new Set(found.flatMap(exerciseMachineIds))];
    return (await resources(context, 'machine', ids, true)).map((row) => MachineSchema.parse(row));
  };
  const available = async (
    context: AuthorizedProductContext,
    source: readonly Exercise[],
    content: {
      steps: {
        id: string;
        exerciseId: string;
        alternatives?: string[];
        substitutionPolicy?: 'reviewed' | 'blocked';
      }[];
    },
    relations: readonly ReviewedRelation[] = [],
  ) => {
    const active = new Set(
      (
        await context.db.query<{ machine_id: string }>(
          'SELECT DISTINCT machine_id FROM b2b_unit WHERE organization_id=$1 AND branch_id=$2 AND NOT archived',
          [context.organizationId, context.branchId],
        )
      ).rows.map((row) => row.machine_id),
    );
    const byId = new Map(source.map((exercise) => [exercise.id, exercise]));
    const issues = content.steps.flatMap((step, index) => {
      const candidates = [
        step.exerciseId,
        ...(step.alternatives ?? []),
        ...(step.substitutionPolicy === 'reviewed'
          ? relations
              .filter((relation) => relation.sourceExerciseId === step.exerciseId)
              .map((relation) => relation.targetExerciseId)
          : []),
      ];
      return !candidates.some((id) => {
        const exercise = byId.get(id);
        return exercise && exerciseAvailability(exercise, active) !== 'unavailable';
      })
        ? [
            {
              code: 'unavailable' as const,
              path: ['steps', index, 'exerciseId'],
              stepId: step.id,
              message: 'Required equipment is unavailable in this branch.',
            },
          ]
        : [];
    });
    if (issues.length)
      throw new HttpError(
        409,
        'INCOMPLETE_PRESCRIPTION',
        'Revisá el equipamiento de esta sede.',
        issues,
      );
  };
  return {
    async validateDraftResources(context, content) {
      await exercises(
        context,
        content.steps.flatMap((step) => (step.exerciseId ? [step.exerciseId] : [])),
        false,
      );
    },
    async publicationResources(context, content) {
      const source = await exercises(
        context,
        content.steps.map((step) => step.exerciseId),
        true,
      );
      const relations = await resolveRelations(context, content, source);
      const targetIds = relations.map((relation) => relation.targetExerciseId);
      const targets = await exercises(context, targetIds, true);
      const all = [
        ...new Map([...source, ...targets].map((exercise) => [exercise.id, exercise])).values(),
      ];
      for (const relation of relations) {
        if (
          !content.steps.some(
            (step) =>
              step.substitutionPolicy === 'reviewed' &&
              step.exerciseId === relation.sourceExerciseId,
          ) ||
          canonicalJson(targets.find((exercise) => exercise.id === relation.targetExerciseId)) !==
            canonicalJson(relation.target)
        )
          throw new HttpError(
            409,
            'INVALID_INPUT',
            'La alternativa revisada cambió. Volvé a revisar la prescripción.',
          );
      }
      await available(context, all, content, relations);
      return { exercises: all, machines: await machines(context, all), relations };
    },
    async validateAssignment(context, stored) {
      if (stored.schemaVersion === 2) {
        const { name, description, steps } = stored.snapshot;
        const readiness = checkRoutineAssignable({ name, description, steps });
        if (!readiness.ok)
          throw new HttpError(
            422,
            'INCOMPLETE_PRESCRIPTION',
            'Completá la prescripción.',
            readiness.issues,
          );
      }
      const relations = stored.schemaVersion === 2 ? stored.snapshot.relations : [];
      const ids =
        stored.schemaVersion === 1
          ? stored.snapshot.steps.flatMap((step) => [step.exerciseId, ...step.alternatives])
          : [
              ...stored.snapshot.steps.map((step) => step.exerciseId),
              ...relations.map((relation) => relation.targetExerciseId),
            ];
      const source = await exercises(context, ids, true);
      await machines(context, source);
      await available(context, source, stored.snapshot, relations);
    },
  };
}
