import {
  checkEffectiveSegments,
  checkNewSegmentSelections,
  createOriginalSegment,
  targetEquipmentAvailable,
} from '@klisteniapp/b2b-domain/alternatives';
import type { RoutineVersionV2, SessionContent } from '@klisteniapp/b2b-contracts/product-v2';
import type { AuthorizedProductContext } from '../product-context.ts';
import { HttpError } from '../errors.ts';

/** An incomplete draft may omit selections. Add validation-only source entries
 * so WP04 can validate any supplied actuals without storing or selecting work
 * on the user's behalf. Completed content receives no such accommodation. */
function validationContent(routine: RoutineVersionV2, content: SessionContent) {
  if (content.status === 'completed') return content;
  const checked = structuredClone(content);
  let sequence = 0;
  for (const step of routine.steps) {
    if (checked.selectedSegments.some((s) => s.originalStepId === step.id)) continue;
    let segment = checked.segments.find((s) => s.originalStepId === step.id);
    if (!segment) {
      let id = `validation-source-${sequence++}`;
      while (checked.segments.some((s) => s.segmentId === id))
        id = `validation-source-${sequence++}`;
      segment = createOriginalSegment(step, id, content.performedAt);
      checked.segments.push(segment);
    }
    checked.selectedSegments.push({ originalStepId: step.id, segmentId: segment.segmentId });
  }
  return checked;
}
export async function validateReviewedSegments(
  context: AuthorizedProductContext,
  routine: RoutineVersionV2,
  content: SessionContent,
  previous?: SessionContent,
) {
  const checked = validationContent(routine, content);
  const semantics = checkEffectiveSegments(routine, checked);
  if (!semantics.ok)
    throw new HttpError(
      400,
      semantics.code === 'INCOMPLETE_SEGMENT' ? 'INCOMPLETE_EXECUTION' : 'INVALID_INPUT',
      semantics.code,
    );
  const newRelations = content.segments.filter(
    (s) =>
      s.relation &&
      (!previous?.segments.some((old) => old.segmentId === s.segmentId) ||
        content.selectedSegments.some(
          (selected) =>
            selected.segmentId === s.segmentId &&
            !previous?.selectedSegments.some(
              (old) =>
                old.originalStepId === selected.originalStepId &&
                old.segmentId === selected.segmentId,
            ),
        )),
  );
  if (newRelations.length) {
    // Catalog overrides may be absent before a concurrent disable INSERT.
    // SHARE blocks catalog INSERT/UPDATE/DELETE through acceptance, including
    // that phantom case, without depending on another owner's advisory locks.
    await context.db.query('LOCK TABLE b2b_branch_catalog IN SHARE MODE');
    const ids = [
      ...new Set(newRelations.flatMap((s) => [s.relation!.sourceExerciseId, s.exerciseId])),
    ].sort();
    const rows = await context.db.query<{
      id: string;
      organization_id: string | null;
      branch_id: string | null;
      status: string;
    }>(
      'SELECT id,organization_id,branch_id,status FROM b2b_exercise WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE',
      [ids],
    );
    const overrides = await context.db.query<{ resource_id: string; enabled: boolean }>(
      "SELECT resource_id,enabled FROM b2b_branch_catalog WHERE organization_id=$1 AND branch_id=$2 AND kind='exercise' AND resource_id=ANY($3::text[])",
      [context.organizationId, context.branchId, ids],
    );
    const enabled = new Map(overrides.rows.map((r) => [r.resource_id, r.enabled]));
    if (
      ids.some((id) => {
        const row = rows.rows.find((r) => r.id === id);
        return (
          !row ||
          row.status !== 'published' ||
          (row.organization_id !== null && row.organization_id !== context.organizationId) ||
          enabled.get(id) === false ||
          (row.branch_id !== null && row.branch_id !== context.branchId && enabled.get(id) !== true)
        );
      })
    )
      throw new HttpError(403, 'INVALID_INPUT', 'SOURCE_OR_TARGET_CATALOG_UNAVAILABLE');
  }
  const models = await context.db.query<{ machine_id: string }>(
    'SELECT machine_id FROM b2b_unit WHERE organization_id=$1 AND branch_id=$2 AND NOT archived ORDER BY id FOR SHARE',
    [context.organizationId, context.branchId],
  );
  const environment = {
    activeMachineIds: new Set(models.rows.map((r) => r.machine_id)),
    // The equipment label comes from the frozen target, and the member must
    // explicitly acknowledge target requirements; no payload permission claim.
    confirmedEquipment: new Set(
      content.segments
        .filter(
          (s) => s.relation && s.confirmedConditions.includes('target-requirements-confirmed'),
        )
        .map((s) => s.relation!.target.equipment),
    ),
  };
  const selections = checkNewSegmentSelections(
    routine,
    checked,
    previous ?? { segments: [] },
    environment,
  );
  if (newRelations.some((s) => !targetEquipmentAvailable(s.relation!.target, environment)))
    throw new HttpError(400, 'INVALID_INPUT', 'TARGET_EQUIPMENT_UNAVAILABLE');
  if (!selections.ok)
    throw new HttpError(
      400,
      selections.code === 'INCOMPLETE_SEGMENT' ? 'INCOMPLETE_EXECUTION' : 'INVALID_INPUT',
      selections.code,
    );
}
