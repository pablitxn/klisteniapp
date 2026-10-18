import type { PlanningServices } from './product-context.ts';
import { createPlanningServices } from './planning/index.ts';
import { createPlanningResources, type PublicationRelations } from './planning/resources.ts';
import type { PlanningSchedule } from './planning/schedule-change.ts';
import { freezeReviewedRelations } from './catalog/reviewed-projection.ts';
import { assertProductMigrations } from './product-readiness.ts';

/** WP02 supplies the complete current published, branch-authorized catalog and
 * rechecks/freezes all chosen targets and machines in this same transaction. */
export const resolveReviewedPublicationRelations: PublicationRelations = async (
  context,
  content,
  available,
) => {
  await assertProductMigrations(context.db);
  return freezeReviewedRelations(content, available);
};

/** WP03 supplies the real schedule adapter. No route, activation or authority is
 * installed here, and no synthetic/no-op schedule fallback exists. */
export function createProductPlanning(schedule: PlanningSchedule): PlanningServices {
  return createPlanningServices({
    ...createPlanningResources(resolveReviewedPublicationRelations),
    schedule,
  });
}
