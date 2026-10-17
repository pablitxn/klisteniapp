import { ProgramVersionSchema } from '@klisteniapp/b2b-contracts/training';
import {
  ProductEndpoints,
  LegacySupplementPreviewSchema,
  RoutineVersionV2Schema,
  projectLegacyRoutine,
} from '@klisteniapp/b2b-contracts/product-v2';
import type { AuthorizedProductContext, ProductServices } from '../product-context.ts';
import { conflict, missing } from '../errors.ts';
import { catalogExercises, routineSupplement } from '../product-reads.ts';
import { planningOperation, planningLock, requirePlanning } from '../planning/operations.ts';
import {
  contentHash,
  legacySupplement,
  projectReviewedRelations,
  saveLegacySupplement,
} from './reviewed-projection.ts';

async function issued(context: AuthorizedProductContext, id: string) {
  requirePlanning(context);
  const row = (
    await context.db.query(
      `SELECT a.member_id,a.program_id,a.version,v.schema_version,v.snapshot FROM b2b_program_assignment a
     JOIN b2b_program_version v ON (v.organization_id,v.branch_id,v.program_id,v.version)=(a.organization_id,a.branch_id,a.program_id,a.version)
     WHERE a.organization_id=$1 AND a.branch_id=$2 AND a.id=$3 FOR SHARE OF a,v`,
      [context.organizationId, context.branchId, id],
    )
  ).rows[0];
  if (!row) throw missing();
  await context.authorizeMember(row.member_id, 'history');
  if (row.schema_version !== 1) throw conflict();
  return row;
}
async function preview(
  context: AuthorizedProductContext,
  id: string,
  row: Awaited<ReturnType<typeof issued>>,
) {
  const original = ProgramVersionSchema.parse(row.snapshot);
  if (original.programId !== row.program_id || original.version !== row.version) throw conflict();
  const available = await catalogExercises(context);
  const proposals = new Map();
  for (const step of original.steps) {
    const source = original.exercises.find((e) => e.id === step.exerciseId);
    // Historical source provenance and currently scoped catalog eligibility are
    // both required. A disabled source cannot gain a new reviewed adoption.
    if (
      source &&
      available.some((e) => e.id === source.id && contentHash(e) === contentHash(source))
    )
      for (const relation of projectReviewedRelations(source, available))
        proposals.set(relation.id, { relation, hash: contentHash(relation) });
  }
  const saved = await routineSupplement(context, {
    id: original.programId,
    version: original.version,
  });
  return LegacySupplementPreviewSchema.parse({
    assignmentId: id,
    scope: {
      organizationId: context.organizationId,
      branchId: context.branchId,
      memberId: row.member_id,
    },
    sourceSnapshotHash: contentHash(row.snapshot),
    original,
    draft: projectLegacyRoutine(original),
    proposals: [...proposals.values()],
    supplement: saved ? legacySupplement(row.snapshot, saved, row.member_id) : null,
  });
}
export const legacySupplementPreview: ProductServices['legacySupplementPreview'] = async (
  context,
  raw,
) => {
  const { id } = ProductEndpoints.legacySupplementPreview.input.parse(raw);
  return preview(context, id, await issued(context, id));
};
export const adoptLegacySupplement: ProductServices['adoptLegacySupplement'] = async (
  context,
  raw,
) => {
  const input = ProductEndpoints.adoptLegacySupplement.input.parse(raw);
  const row = await issued(context, input.id);
  const resource = `${row.program_id}-${row.version}`;
  return planningOperation(context, 'routine.supplement', resource, input, async () => {
    await planningLock(context, 'routine-supplement', resource);
    await context.db.query('LOCK TABLE b2b_branch_catalog IN SHARE MODE');
    const current = await preview(context, input.id, row);
    if (current.sourceSnapshotHash !== input.sourceSnapshotHash) throw conflict();
    const reviewedSources = new Set(
      input.sourceSteps.filter((s) => s.substitutionPolicy === 'reviewed').map((s) => s.exerciseId),
    );
    const selected = current.proposals.filter((p) =>
      reviewedSources.has(p.relation.sourceExerciseId),
    );
    if (
      selected.length !== input.targetConfirmations.length ||
      selected.some(
        (p) =>
          !input.targetConfirmations.some(
            (c) => c.relationId === p.relation.id && c.relationHash === p.hash,
          ),
      )
    )
      throw conflict();
    const exercises = new Map(current.original.exercises.map((e) => [e.id, e]));
    for (const { relation } of selected) {
      const old = exercises.get(relation.targetExerciseId);
      if (old && contentHash(old) !== contentHash(relation.target)) throw conflict();
      exercises.set(relation.targetExerciseId, relation.target);
    }
    const confirmed = RoutineVersionV2Schema.parse({
      name: current.original.name,
      description: current.original.description,
      programId: current.original.programId,
      version: current.original.version,
      publishedAt: current.original.publishedAt,
      machines: current.original.machines,
      schemaVersion: 2,
      scope: { organizationId: context.organizationId, branchId: context.branchId },
      steps: input.sourceSteps,
      exercises: [...exercises.values()],
      relations: selected.map((p) => p.relation),
    });
    return saveLegacySupplement(
      context,
      legacySupplement(row.snapshot, confirmed, row.member_id),
      input.operationId,
    );
  });
};
