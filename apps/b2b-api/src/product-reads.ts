import { ExerciseSchema } from '@klisteniapp/b2b-contracts';
import {
  decodeRoutine,
  type ProductInput,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2';
import type { AuthorizedProductContext } from './product-context.ts';
import { denied, missing, HttpError } from './errors.ts';
import { requirePlanning } from './planning/operations.ts';
import { createPlanningResources } from './planning/resources.ts';
import { resolveReviewedPublicationRelations } from './product-composition.ts';

/** Exact own historical linkage grants a member this immutable version read.
 * It grants neither draft/catalog visibility nor access to another member. */
export async function assertIssuedRoutineAccess(
  context: AuthorizedProductContext,
  id: string,
  version: number,
) {
  if (context.accessMode !== 'active' || !context.capabilities.has('read-training-history'))
    throw denied();
  if (context.role !== 'member') return;
  await context.authorizeMember(context.actorId, 'history');
  const issued = await context.db.query(
    `SELECT 1 FROM b2b_program_assignment
    WHERE organization_id=$1 AND branch_id=$2 AND member_id=$3 AND program_id=$4 AND version=$5
    UNION ALL SELECT 1 FROM b2b_occurrence
    WHERE organization_id=$1 AND branch_id=$2 AND member_id=$3 AND program_id=$4 AND program_version=$5
    LIMIT 1`,
    [context.organizationId, context.branchId, context.actorId, id, version],
  );
  if (!issued.rowCount) throw missing();
}

export async function catalogExercises(
  context: AuthorizedProductContext,
): Promise<ProductOutput<'catalogExercises'>> {
  requirePlanning(context);
  const rows = await context.db.query(
    `SELECT c.* FROM b2b_exercise c
    WHERE (c.organization_id IS NULL OR c.organization_id=$1) AND c.status='published'
    AND (c.branch_id IS NULL OR c.branch_id=$2 OR EXISTS(
      SELECT 1 FROM b2b_branch_catalog bc WHERE bc.organization_id=$1 AND bc.branch_id=$2
        AND bc.kind='exercise' AND bc.resource_id=c.id AND bc.enabled))
    AND NOT EXISTS(SELECT 1 FROM b2b_branch_catalog bc WHERE bc.organization_id=$1 AND bc.branch_id=$2
      AND bc.kind='exercise' AND bc.resource_id=c.id AND NOT bc.enabled)
    ORDER BY c.id FOR SHARE OF c`,
    [context.organizationId, context.branchId],
  );
  return rows.rows.map((row) =>
    ExerciseSchema.parse({
      ...row.data,
      id: row.id,
      ...(row.branch_id ? { branchId: row.branch_id } : {}),
      scope: row.organization_id ? 'organization' : 'base',
      status: row.status,
      version: row.version,
      revision: row.revision,
    }),
  );
}

export async function routineVersion(
  context: AuthorizedProductContext,
  input: ProductInput<'routineVersion'>,
): Promise<ProductOutput<'routineVersion'>> {
  await assertIssuedRoutineAccess(context, input.id, input.version);
  const row = (
    await context.db.query(
      `SELECT schema_version,snapshot FROM b2b_program_version
    WHERE organization_id=$1 AND branch_id=$2 AND program_id=$3 AND version=$4`,
      [context.organizationId, context.branchId, input.id, input.version],
    )
  ).rows[0];
  if (!row) throw missing();
  const stored = decodeRoutine(row.schema_version, row.snapshot);
  if (
    stored.snapshot.programId !== input.id ||
    stored.snapshot.version !== input.version ||
    (stored.schemaVersion === 2 &&
      (stored.snapshot.scope.organizationId !== context.organizationId ||
        stored.snapshot.scope.branchId !== context.branchId))
  )
    throw missing();
  return stored;
}

export async function routinePublications(
  context: AuthorizedProductContext,
): Promise<ProductOutput<'routinePublications'>> {
  requirePlanning(context);
  const rows = await context.db.query(
    `SELECT v.program_id,v.version,v.schema_version,v.snapshot
    FROM b2b_program_version v JOIN b2b_program p ON (p.organization_id,p.branch_id,p.id)=(v.organization_id,v.branch_id,v.program_id)
    WHERE v.organization_id=$1 AND v.branch_id=$2 AND p.archived_at IS NULL
    ORDER BY v.program_id,v.version FOR SHARE OF p,v`,
    [context.organizationId, context.branchId],
  );
  const result: ProductOutput<'routinePublications'> = [];
  const resources = createPlanningResources(resolveReviewedPublicationRelations);
  for (const row of rows.rows) {
    const stored = decodeRoutine(row.schema_version, row.snapshot);
    if (
      stored.snapshot.programId !== row.program_id ||
      stored.snapshot.version !== row.version ||
      (stored.schemaVersion === 2 &&
        (stored.snapshot.scope.organizationId !== context.organizationId ||
          stored.snapshot.scope.branchId !== context.branchId))
    )
      throw missing();
    try {
      await resources.validateAssignment(context, stored);
    } catch (error) {
      if (
        error instanceof HttpError &&
        ['INVALID_INPUT', 'INCOMPLETE_PRESCRIPTION'].includes(error.code)
      )
        continue;
      throw error;
    }
    result.push({
      name: stored.snapshot.name,
      reference: {
        programId: row.program_id,
        version: row.version,
        schemaVersion: stored.schemaVersion,
      },
    });
  }
  return result;
}
