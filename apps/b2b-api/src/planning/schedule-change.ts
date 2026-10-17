import type { Enrollment, Occurrence, ProductOutput } from '@klisteniapp/b2b-contracts/product-v2';
import type { AuthorizedProductContext } from '../product-context.ts';

/** Read under the enrollment lock. Include every accepted head, even voids,
 * because corrections invalidate an earlier period preview. Actuals stay owned
 * by RECORDS and must never be changed by a planning reconciliation. */
export type PlanningSessionHead = {
  id: string;
  occurrenceId: string;
  revision: number;
  snapshot: unknown;
};

export type ScheduleChange = {
  reason: 'enroll' | 'period' | 'end';
  before: Enrollment | null;
  after: Enrollment;
  occurrences: readonly Occurrence[];
  sessions: readonly PlanningSessionHead[];
};

export type PeriodImpact = ProductOutput<'periodPreview'>['impacts'][number];

/** WP03 supplies both callbacks. plan must be deterministic and side-effect
 * free. apply reuses this transaction, preserves issued identities/actuals and
 * appends occurrence revisions. New slots allocate IDs/ordinals only at apply.
 * There is deliberately no no-op production fallback. */
export type PlanningSchedule = {
  plan(change: ScheduleChange): readonly PeriodImpact[];
  apply(
    context: AuthorizedProductContext,
    change: ScheduleChange,
    impacts: readonly PeriodImpact[],
  ): Promise<void>;
};
