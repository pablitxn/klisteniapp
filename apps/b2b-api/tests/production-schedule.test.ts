import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlanningSchedule } from '../src/schedule/planning.ts';
import { createRecordsServices } from '../src/schedule/index.ts';
import { fixture, publish, enroll, databaseUrl } from './wp02/fixture.ts';
import { PlanningRepository } from '../src/planning/repository.ts';
import type { ScheduleChange } from '../src/planning/schedule-change.ts';

test(
  'production planning callback enrolls stable occurrences and member moves invalidate WP02 previews',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      await publish(f);
      const issued = await enroll(f);
      const proposed = structuredClone(issued.content);
      proposed.stages[0]!.startDate = '2026-10-19';
      proposed.stages[0]!.endDate = '2026-11-01';
      const preview = await f.transaction((ctx) =>
        f.module.periodPreview(ctx, { id: issued.id, expectedRevision: issued.revision, proposed }),
      );
      const records = createRecordsServices(() => new Date(f.time.now));
      const current = await f.transaction((ctx) =>
        records.occurrences(ctx, {
          memberId: 'member',
          weekStart: '2026-10-05',
          timeZone: 'America/New_York',
        }),
      );
      assert.equal(current.length, 1);
      await f.transaction(
        async (ctx) => {
          // The existing fixture supplies current authorization, while this focused
          // composition test supplies the actual member's frozen capability.
          const member = {
            ...ctx,
            capabilities: new Set([...ctx.capabilities, 'edit-own-sessions' as const]),
          };
          await records.moveOccurrence(member, {
            id: current[0]!.id,
            operationId: 'member-move',
            expectedRevision: current[0]!.revision,
            scheduledDate: '2026-10-06',
          });
        },
        { actorId: 'member' },
      );
      await assert.rejects(
        f.transaction((ctx) =>
          f.module.applyPeriod(ctx, {
            enrollmentId: issued.id,
            expectedRevision: issued.revision,
            proposed,
            previewHash: preview.previewHash,
            operationId: 'stale-apply',
          }),
        ),
        { code: 'STALE_PERIOD_PREVIEW' },
      );
      const refreshed = await f.transaction((ctx) =>
        f.module.periodPreview(ctx, { id: issued.id, expectedRevision: issued.revision, proposed }),
      );
      await f.transaction((ctx) =>
        f.module.applyPeriod(ctx, {
          enrollmentId: issued.id,
          expectedRevision: issued.revision,
          proposed,
          previewHash: refreshed.previewHash,
          operationId: 'fresh-apply',
        }),
      );
      const moved = await f.transaction((ctx) =>
        records.occurrences(ctx, {
          memberId: 'member',
          weekStart: '2026-10-19',
          timeZone: 'America/New_York',
        }),
      );
      assert.equal(moved[0]!.id, current[0]!.id);
      assert.equal(moved[0]!.originalDate, '2026-10-05');
    }, createPlanningSchedule());
  },
);
test(
  'pinned WP02 end seam fails closed without deterministic effectiveAt and rolls back the new revision',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      await publish(f);
      const issued = await enroll(f);
      const before = (
        await f.pool.query(
          'SELECT snapshot::text FROM b2b_occurrence_revision ORDER BY occurrence_id,revision',
        )
      ).rows;
      await assert.rejects(
        f.transaction((ctx) =>
          f.module.endEnrollment(ctx, {
            id: issued.id,
            expectedRevision: issued.revision,
            operationId: 'end-without-effective-time',
          }),
        ),
        { code: 'INVALID_INPUT' },
      );
      assert.deepEqual(
        (
          await f.pool.query(
            'SELECT snapshot::text FROM b2b_occurrence_revision ORDER BY occurrence_id,revision',
          )
        ).rows,
        before,
      );
      assert.equal(
        (await f.pool.query("SELECT revision FROM b2b_enrollment WHERE id='enrollment'")).rows[0]
          .revision,
        1,
      );
    }, createPlanningSchedule());
  },
);
test(
  'explicit effectiveAt end metadata reconciles only future obligations through the production adapter',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      await publish(f);
      const issued = await enroll(f);
      await f.transaction(async (ctx) => {
        const repository = new PlanningRepository(ctx);
        const before = (await repository.enrollment(issued.id, true))!;
        const state = await repository.scheduleState(issued.id);
        const after = { ...before, revision: before.revision + 1, status: 'ended' as const };
        const change: ScheduleChange & { effectiveAt: string } = {
          reason: 'end',
          before,
          after,
          ...state,
          effectiveAt: '2026-10-07T12:00:00Z',
        };
        const adapter = createPlanningSchedule(),
          impacts = adapter.plan(change);
        assert.deepEqual(adapter.plan(structuredClone(change)), impacts);
        assert.equal(impacts.filter((i) => i.afterEligibility === 'cancelled').length, 1);
        await repository.saveEnrollment(after);
        await adapter.apply(ctx, change, impacts);
      });
      const rows = (
        await f.pool.query(
          'SELECT original_date::text,eligibility FROM b2b_occurrence ORDER BY original_date',
        )
      ).rows;
      assert.deepEqual(rows, [
        { original_date: '2026-10-05', eligibility: 'required' },
        { original_date: '2026-10-12', eligibility: 'cancelled' },
      ]);
    }, createPlanningSchedule());
  },
);
