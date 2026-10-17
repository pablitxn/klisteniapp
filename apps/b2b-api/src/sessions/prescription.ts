import {
  decodeRoutine,
  projectLegacyRoutine,
  RoutineVersionV2Schema,
  SessionPrescriptionBindingSchema,
  type SessionContent,
  type RoutineVersionV2,
  type SessionPrescriptionBinding,
} from '@klisteniapp/b2b-contracts/product-v2';
import { canonicalJson, type SessionPrescription } from '@klisteniapp/b2b-domain/sessions';
import type { AuthorizedProductContext } from '../product-context.ts';
import { contentHash } from '../catalog/reviewed-projection.ts';

export async function resolveSessionPrescription(
  context: AuthorizedProductContext,
  stored: { schema_version: number; snapshot: unknown },
  prior?: SessionContent,
): Promise<{
  prescription: SessionPrescription;
  reviewedRoutine?: RoutineVersionV2;
  binding: SessionPrescriptionBinding;
}> {
  const decoded = decodeRoutine(stored.schema_version, stored.snapshot);
  if (decoded.schemaVersion === 2) {
    const routine = decoded.snapshot;
    return {
      prescription: routine,
      reviewedRoutine: routine,
      binding: { kind: 'reviewed', routine },
    };
  }
  const original = decoded.snapshot;
  const projected = projectLegacyRoutine(original);
  const binding = SessionPrescriptionBindingSchema.parse({
    kind: 'legacy-compatibility',
    original,
    relations: [],
    // This is the pre-existing v1 interpretation, not a confirmation or a
    // publication. It never converts an unknown load to bodyweight.
    steps: projected.steps.map((step) => ({
      ...step,
      dose: { ...step.dose, laterality: 'bilateral' },
    })),
  });
  if (binding.kind !== 'legacy-compatibility') throw new Error('Invalid compatibility binding');
  const saved = (
    await context.db.query(
      'SELECT source_snapshot_hash,snapshot FROM b2b_routine_supplement WHERE organization_id=$1 AND branch_id=$2 AND program_id=$3 AND program_version=$4',
      [context.organizationId, context.branchId, original.programId, original.version],
    )
  ).rows[0];
  if (!saved) return { prescription: binding, binding };
  if (saved.source_snapshot_hash !== contentHash(stored.snapshot))
    throw new Error('Legacy supplement does not match the issued snapshot');
  const routine = RoutineVersionV2Schema.parse(saved.snapshot);
  if (
    routine.programId !== original.programId ||
    routine.version !== original.version ||
    routine.scope.organizationId !== context.organizationId ||
    routine.scope.branchId !== context.branchId
  )
    throw new Error('Legacy supplement identity does not match the issued snapshot');
  const isCompatibilitySource = (segment: SessionContent['segments'][number]) => {
    const step = binding.steps.find((s) => s.id === segment.originalStepId);
    return (
      step &&
      segment.exerciseId === step.exerciseId &&
      segment.relation === null &&
      canonicalJson(segment.dose) === canonicalJson(step.dose)
    );
  };
  const pinned = prior?.segments.some(
    (segment) =>
      isCompatibilitySource(segment) &&
      canonicalJson(segment.dose) !==
        canonicalJson(routine.steps.find((s) => s.id === segment.originalStepId)?.dose),
  );
  if (pinned) {
    if (!prior!.segments.every(isCompatibilitySource))
      throw new Error('Inconsistent legacy session prescription');
    return { prescription: binding, binding };
  }
  return {
    prescription: routine,
    reviewedRoutine: routine,
    binding: { kind: 'reviewed', routine },
  };
}
