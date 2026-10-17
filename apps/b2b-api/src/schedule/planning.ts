import { randomUUID } from 'node:crypto';
import { PeriodImpactSchema, SessionRevisionSchema } from '@klisteniapp/b2b-contracts/product-v2';
import { isCompletionEligible, reconcileOccurrences } from '@klisteniapp/b2b-domain/schedule';
import { canonicalJson } from '@klisteniapp/b2b-domain/sessions';
import type {
  PlanningSchedule,
  ScheduleChange,
  PeriodImpact,
} from '../planning/schedule-change.ts';
import { denied, HttpError } from '../errors.ts';
import { memberOccurrences } from './repository.ts';
import { persistReconciliation } from './index.ts';

/** End requires an immutable server effective time in the internal change.
 * WP02's pinned seam omits it; fail closed until its owner adds this field.
 * Reading wall clock inside plan would violate its deterministic contract. */
function endTime(change: ScheduleChange): string | undefined {
  if (change.reason !== 'end') return undefined;
  const effectiveAt = (change as ScheduleChange & { effectiveAt?: string }).effectiveAt;
  if (!effectiveAt || !Number.isFinite(Date.parse(effectiveAt)))
    throw new HttpError(
      409,
      'INVALID_INPUT',
      'An enrollment end requires an explicit server effectiveAt in ScheduleChange.',
    );
  return effectiveAt;
}
function reconcile(change: ScheduleChange, allocate: () => string) {
  return reconcileOccurrences(
    change.before,
    change.after,
    change.occurrences,
    allocate,
    endTime(change),
  );
}

/** Production WP02 adapter: plan is synchronous and performs no I/O, clock
 * reads or identity allocation. New IDs are allocated only by apply. */
export function createPlanningSchedule(): PlanningSchedule {
  const plan = (change: ScheduleChange): PeriodImpact[] => {
    let placeholder = 0;
    const proposed = reconcile(change, () => `preview-only-${placeholder++}`);
    return change.occurrences.map((before) => {
      const after = proposed.find((o) => o.id === before.id)!;
      const heads = change.sessions.filter((s) => s.occurrenceId === before.id);
      const eligibilityChanges = heads.filter((head) => {
        const session = SessionRevisionSchema.parse(head.snapshot);
        if (!change.before) return false;
        return (
          isCompletionEligible(before, change.before, session.content.performedAt) !==
          isCompletionEligible(after, change.after, session.content.performedAt)
        );
      }).length;
      return PeriodImpactSchema.parse({
        occurrenceId: before.id,
        expectedRevision: before.revision,
        beforeDate: before.scheduledDate,
        afterDate: after.eligibility === 'cancelled' ? null : after.scheduledDate,
        beforeEligibility: before.eligibility,
        afterEligibility: after.eligibility,
        linkedSessionIds: heads.map((s) => s.id).sort(),
        reason: `${after.cancellationReason ?? 'Reconcile prescribed dates'}; ${eligibilityChanges} linked records change eligibility${after.permittedDateOverride ? '; retain accepted same-week override' : ''}`,
      });
    });
  };
  return {
    plan,
    async apply(context, change, impacts) {
      if (
        context.accessMode !== 'active' ||
        context.role === 'member' ||
        !context.capabilities.has('edit-planning') ||
        change.after.scope.organizationId !== context.organizationId ||
        change.after.scope.branchId !== context.branchId
      )
        throw denied();
      await context.authorizeMember(change.after.scope.memberId, 'planning');
      if (canonicalJson(plan(change)) !== canonicalJson(impacts))
        throw new HttpError(409, 'STALE_PERIOD_PREVIEW', 'Schedule impacts changed.');
      const current = (await memberOccurrences(context, change.after.scope.memberId)).filter(
        (o) => o.enrollmentId === change.after.id,
      );
      const ordered = <T extends { id: string }>(values: readonly T[]) =>
        [...values].sort((a, b) => a.id.localeCompare(b.id));
      if (canonicalJson(ordered(current)) !== canonicalJson(ordered(change.occurrences)))
        throw new HttpError(409, 'STALE_PERIOD_PREVIEW', 'Schedule revisions changed.');
      await persistReconciliation(context, change.occurrences, reconcile(change, randomUUID));
    },
  };
}
