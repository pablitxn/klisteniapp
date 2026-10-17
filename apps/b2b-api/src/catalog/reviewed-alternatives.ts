import {
  RoutineVersionV2Schema,
  type ProductInput,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2';
import type { AuthorizedProductContext } from '../product-context.ts';
import { ProgramVersionSchema } from '@klisteniapp/b2b-contracts/training';
import { contentHash } from './reviewed-projection.ts';
import { denied, missing } from '../errors.ts';

/** ACCESS registers this in its existing authorized transaction. Reads never
 * adopt new review metadata or rewrite an old assigned version. */
export async function alternatives(
  context: AuthorizedProductContext,
  input: ProductInput<'alternatives'>,
): Promise<ProductOutput<'alternatives'>> {
  if (context.accessMode !== 'active') throw denied();
  if (context.role === 'member') {
    await context.authorizeMember(context.actorId, 'history');
    const assigned = await context.db.query(
      `SELECT 1 FROM b2b_program_assignment
      WHERE organization_id=$1 AND branch_id=$2 AND member_id=$3 AND program_id=$4 AND version=$5`,
      [context.organizationId, context.branchId, context.actorId, input.id, input.version],
    );
    if (!assigned.rowCount) throw missing();
  } else if (
    !context.capabilities.has('read-training-history') &&
    !context.capabilities.has('edit-planning')
  )
    throw denied();
  const result = await context.db.query<{
    snapshot: unknown;
    schema_version: number;
    supplement: unknown;
    source_snapshot_hash: string | null;
  }>(
    `SELECT v.snapshot,v.schema_version,s.snapshot AS supplement,s.source_snapshot_hash FROM b2b_program_version v
     LEFT JOIN b2b_routine_supplement s ON s.organization_id=v.organization_id AND s.branch_id=v.branch_id AND s.program_id=v.program_id AND s.program_version=v.version
     WHERE v.organization_id=$1 AND v.branch_id=$2 AND v.program_id=$3 AND v.version=$4`,
    [context.organizationId, context.branchId, input.id, input.version],
  );
  const row = result.rows[0];
  if (!row) throw missing();
  if (row.schema_version === 1) {
    const legacy = ProgramVersionSchema.parse(row.snapshot);
    if (!legacy.steps.some((step) => step.id === input.stepId)) throw missing();
    if (row.supplement == null) return [];
    if (row.source_snapshot_hash !== contentHash(legacy)) throw missing();
  }
  if (row.schema_version !== 1 && row.schema_version !== 2) throw missing();
  const routine = RoutineVersionV2Schema.parse(
    row.schema_version === 2 ? row.snapshot : row.supplement,
  );
  if (
    routine.programId !== input.id ||
    routine.version !== input.version ||
    routine.scope.organizationId !== context.organizationId ||
    routine.scope.branchId !== context.branchId
  )
    throw missing();
  const step = routine.steps.find((s) => s.id === input.stepId);
  if (!step) throw missing();
  if (step.substitutionPolicy === 'blocked') return [];
  const hidden = await context.db.query<{ resource_id: string }>(
    "SELECT resource_id FROM b2b_branch_catalog WHERE organization_id=$1 AND branch_id=$2 AND kind='exercise' AND NOT enabled",
    [context.organizationId, context.branchId],
  );
  const hiddenIds = new Set(hidden.rows.map((item) => item.resource_id));
  return routine.relations.filter(
    (r) => r.sourceExerciseId === step.exerciseId && !hiddenIds.has(r.targetExerciseId),
  );
}
