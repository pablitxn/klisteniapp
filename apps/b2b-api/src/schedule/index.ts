import { createHash } from 'node:crypto';
import {
  OccurrenceSchema,
  PeriodImpactSchema,
  ProductEndpoints,
  type Enrollment,
  type Occurrence,
} from '@klisteniapp/b2b-contracts/product-v2';
import {
  deriveWeek,
  isCompletionEligible,
  moveWithinWeek,
  reconcileOccurrences,
} from '@klisteniapp/b2b-domain/schedule';
import { canonicalJson } from '@klisteniapp/b2b-domain/sessions';
import type { AuthorizedProductContext, RecordsServices } from '../product-context.ts';
import { conflict, denied, HttpError } from '../errors.ts';
import { createSessionServices } from '../sessions/index.ts';
import {
  authorizeRecords,
  recordOperation,
  replayOperation,
  requestHash,
} from '../sessions/operations.ts';
import { latestSessions } from '../sessions/repository.ts';
import { enrollment, memberOccurrences, occurrence, persistOccurrence } from './repository.ts';

/** Planning calls this in its locked authorized transaction before persisting
 * the next enrollment/stage revision. IDs are stable across preview and apply. */
export async function prepareReconciliation(
  context: AuthorizedProductContext,
  before: Enrollment | null,
  next: Enrollment,
) {
  if (context.accessMode !== 'active' || !context.capabilities.has('edit-planning')) throw denied();
  await context.authorizeMember(next.scope.memberId, 'planning');
  if (
    next.scope.organizationId !== context.organizationId ||
    next.scope.branchId !== context.branchId
  )
    throw denied();
  const existing = (await memberOccurrences(context, next.scope.memberId)).filter(
    (o) => o.enrollmentId === next.id,
  );
  let sequence = 0;
  const planned = reconcileOccurrences(
    before,
    next,
    existing,
    () =>
      `occ-${createHash('sha256')
        .update(
          canonicalJson([
            context.organizationId,
            context.branchId,
            next.id,
            next.revision,
            sequence++,
          ]),
        )
        .digest('hex')
        .slice(0, 48)}`,
  );
  const sessions = await latestSessions(context, next.scope.memberId);
  const impacts = existing.map((prior) => {
    const after = planned.find((o) => o.id === prior.id)!;
    return PeriodImpactSchema.parse({
      occurrenceId: prior.id,
      expectedRevision: prior.revision,
      beforeDate: prior.scheduledDate,
      afterDate: after.eligibility === 'cancelled' ? null : after.scheduledDate,
      beforeEligibility: prior.eligibility,
      afterEligibility: after.eligibility,
      linkedSessionIds: sessions
        .filter((s) => s.origin.kind === 'occurrence' && s.origin.occurrenceId === prior.id)
        .map((s) => s.id)
        .sort(),
      reason:
        after.cancellationReason ??
        (after.permittedDateOverride
          ? 'Retains accepted same-week date override'
          : 'Reconciles planning dates and eligibility'),
    });
  });
  return { planned, impacts };
}
/** The enrollment lock must be acquired BEFORE preview validation and its new
 * revision/stage rows written BEFORE these occurrence FKs. No independent commit. */
export async function persistReconciliation(
  context: AuthorizedProductContext,
  previous: readonly Occurrence[],
  planned: readonly Occurrence[],
) {
  if (context.accessMode !== 'active' || !context.capabilities.has('edit-planning')) throw denied();
  for (const value of planned) {
    await context.authorizeMember(value.scope.memberId, 'planning');
    const prior = previous.find((p) => p.id === value.id);
    if (!prior || prior.revision !== value.revision)
      await persistOccurrence(context, value, !prior);
  }
}

export function createRecordsServices(clock: () => Date = () => new Date()): RecordsServices {
  return {
    ...createSessionServices(clock),
    async occurrences(context, raw) {
      const input = ProductEndpoints.occurrences.input.parse(raw);
      await authorizeRecords(context, input.memberId);
      // Device timezone is a filter, never permission to reinterpret issued dates.
      return (await memberOccurrences(context, input.memberId)).filter(
        (o) =>
          o.currentWeek.startDate === input.weekStart && o.currentWeek.timeZone === input.timeZone,
      );
    },
    async moveOccurrence(context, raw) {
      const input = ProductEndpoints.moveOccurrence.input.parse(raw);
      const first = await occurrence(context, input.id);
      await authorizeRecords(context, first.scope.memberId, true);
      const currentEnrollment = await enrollment(context, first.enrollmentId, true);
      const hash = requestHash(context, 'occurrence.move', input);
      const replay = await replayOperation(context, input.operationId, hash);
      if (replay !== undefined) return OccurrenceSchema.parse(replay);
      const current = await occurrence(context, input.id);
      if (current.revision !== input.expectedRevision) throw conflict();
      const completed = (await latestSessions(context, current.scope.memberId)).some(
        (s) =>
          s.origin.kind === 'occurrence' &&
          s.origin.occurrenceId === current.id &&
          s.content.status === 'completed' &&
          isCompletionEligible(current, currentEnrollment, s.content.performedAt),
      );
      let moved;
      try {
        moved = moveWithinWeek(current, currentEnrollment, input.scheduledDate, completed);
      } catch (error) {
        if (error instanceof Error && error.message === 'OUTSIDE_PRESCRIBED_WEEK')
          throw new HttpError(
            400,
            'OUTSIDE_PRESCRIBED_WEEK',
            'Move within the prescribed Monday–Sunday week.',
          );
        throw denied();
      }
      await persistOccurrence(context, moved, false);
      await recordOperation(
        context,
        input,
        current.id,
        current.revision,
        moved.revision,
        hash,
        moved,
        'occurrence.move',
        ['scheduledDate', 'permittedDateOverride'],
        clock().toISOString(),
      );
      return moved;
    },
    async week(context, raw) {
      const input = ProductEndpoints.week.input.parse(raw);
      await authorizeRecords(context, input.memberId);
      // All writers of prescribed actuals/schedules acquire this parent lock.
      // Take it before the first read so READ COMMITTED cannot mix two revisions.
      await context.db.query(
        'SELECT id FROM b2b_enrollment WHERE organization_id=$1 AND branch_id=$2 AND member_id=$3 ORDER BY id FOR SHARE',
        [context.organizationId, context.branchId, input.memberId],
      );
      const allOccurrences = await memberOccurrences(context, input.memberId);
      const sessions = await latestSessions(context, input.memberId);
      const enrollments = await Promise.all(
        [...new Set(allOccurrences.map((o) => o.enrollmentId))].map((id) =>
          enrollment(context, id),
        ),
      );
      const asOf = clock().toISOString();
      // A derived revision watermark advances for corrections and period edits,
      // including records that have moved out of this week. No mutable counters.
      const revision =
        allOccurrences.reduce((sum, o) => sum + o.revision, 0) +
        sessions.reduce((sum, s) => sum + s.revision, 0) +
        enrollments.reduce((sum, e) => sum + e.revision, 0);
      const summary = deriveWeek({
        scope: {
          organizationId: context.organizationId,
          branchId: context.branchId,
          memberId: input.memberId,
        },
        week: { startDate: input.weekStart, timeZone: input.timeZone },
        revision,
        asOf,
        occurrences: allOccurrences,
        sessions,
        enrollments,
      });
      return { ...summary, revision: revision * 2 + Number(summary.closed) };
    },
  };
}
