import {
  checkEffectiveSegments,
  checkNewSegmentSelections,
  createOriginalSegment,
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
  const models = await context.db.query<{ machine_id: string }>(
    'SELECT DISTINCT machine_id FROM b2b_unit WHERE organization_id=$1 AND branch_id=$2 AND NOT archived',
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
  if (!selections.ok)
    throw new HttpError(
      400,
      selections.code === 'INCOMPLETE_SEGMENT' ? 'INCOMPLETE_EXECUTION' : 'INVALID_INPUT',
      selections.code,
    );
}
