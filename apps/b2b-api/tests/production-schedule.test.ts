import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlanningSchedule } from '../src/schedule/planning.ts';
import { createRecordsServices } from '../src/schedule/index.ts';
import { fixture, publish, enroll, databaseUrl, goalContent } from './wp02/fixture.ts';
import { PlanningRepository } from '../src/planning/repository.ts';
import type { ScheduleChange } from '../src/planning/schedule-change.ts';
import { content as sessionContent, planned } from './fixtures/wp03-ledger.ts';

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
  'repaired end handler deterministically cancels future local dates, preserves actual linkage and replays its exact receipt',
  { skip: !databaseUrl },
  async () => {
    await fixture(async (f) => {
      f.time.now = Date.parse('2026-10-08T01:00:00Z'); // October 7 in New York.
      await publish(f);
      const goal = goalContent();
      const reference = goal.stages[0]!.slots[0]!.routine;
      goal.stages[0]!.slots.push(
        { id: 'wednesday', weekday: 3, routine: reference },
        { id: 'thursday', weekday: 4, routine: reference },
      );
      const issued = await enroll(f, goal);
      const records = createRecordsServices(() => new Date(f.time.now));
      const occurrences = await f.transaction((ctx) =>
        records.occurrences(ctx, {
          memberId: 'member',
          weekStart: '2026-10-05',
          timeZone: 'America/New_York',
        }),
      );
      const past = occurrences.find((o) => o.originalDate === '2026-10-05')!;
      const actual = sessionContent();
      actual.performedAt = '2026-10-05T16:00:00Z';
      actual.segments[0]!.createdAt = actual.performedAt;
      const saved = await f.transaction(
        (ctx) =>
          records.saveSession(
            {
              ...ctx,
              capabilities: new Set([...ctx.capabilities, 'edit-own-sessions' as const]),
            },
            {
              id: 'past-actual',
              operationId: 'past-actual',
              expectedRevision: 0,
              origin: { kind: 'occurrence', occurrenceId: past!.id, routine: past!.routine },
              content: actual,
            },
          ),
        { actorId: 'member' },
      );
      const originals = async () =>
        Promise.all(
          [
            'SELECT id,enrollment_id,issued_enrollment_revision,stage_id,slot_id,slot_ordinal,program_id,program_version,original_date::text,original_week_start::text,time_zone FROM b2b_occurrence ORDER BY id',
            'SELECT snapshot::text FROM b2b_session_revision ORDER BY session_id,revision',
            'SELECT snapshot::text FROM b2b_program_version ORDER BY program_id,version',
            'SELECT snapshot::text FROM b2b_occurrence_revision WHERE revision=1 ORDER BY occurrence_id',
          ].map(async (sql) => (await f.pool.query(sql)).rows),
        );
      const before = await originals();
      const request = {
        id: issued.id,
        expectedRevision: issued.revision,
        operationId: 'deterministic-end',
      };
      const ended = await f.transaction((ctx) => f.module.endEnrollment(ctx, request));
      assert.equal(ended.status, 'ended');
      assert.equal(ended.revision, 2);
      assert.deepEqual(
        (
          await f.pool.query(
            'SELECT original_date::text,eligibility FROM b2b_occurrence ORDER BY original_date',
          )
        ).rows,
        [
          { original_date: '2026-10-05', eligibility: 'required' },
          { original_date: '2026-10-07', eligibility: 'required' },
          { original_date: '2026-10-08', eligibility: 'cancelled' },
          { original_date: '2026-10-12', eligibility: 'cancelled' },
          { original_date: '2026-10-14', eligibility: 'cancelled' },
          { original_date: '2026-10-15', eligibility: 'cancelled' },
        ],
      );
      assert.deepEqual(await originals(), before);
      const history = await f.transaction((ctx) =>
        records.sessionRevisions(ctx, { id: 'past-actual' }),
      );
      assert.deepEqual(history, [saved.session]);
      const summary = await f.transaction((ctx) =>
        records.week(ctx, {
          memberId: 'member',
          weekStart: '2026-10-05',
          timeZone: 'America/New_York',
        }),
      );
      assert.deepEqual([summary.required, summary.completed, summary.missed], [2, 1, 0]);
      const revisionCount = (
        await f.pool.query('SELECT count(*)::integer AS count FROM b2b_occurrence_revision')
      ).rows[0].count;
      f.time.now = Date.parse('2026-10-21T12:00:00Z');
      assert.deepEqual(await f.transaction((ctx) => f.module.endEnrollment(ctx, request)), ended);
      assert.equal(
        (await f.pool.query('SELECT count(*)::integer AS count FROM b2b_occurrence_revision'))
          .rows[0].count,
        revisionCount,
      );
      assert.equal(
        (
          await f.pool.query(
            "SELECT * FROM b2b_operation_receipt WHERE operation_id='deterministic-end'",
          )
        ).rowCount,
        1,
      );
      assert.equal(
        (
          await f.pool.query(
            "SELECT * FROM b2b_audit WHERE action='enrollment.end' AND operation_id='deterministic-end'",
          )
        ).rowCount,
        1,
      );
      assert.deepEqual(await originals(), before);
      assert.equal(
        (
          await f.pool.query(
            "SELECT eligibility FROM b2b_occurrence WHERE original_date='2026-10-05'",
          )
        ).rows[0].eligibility,
        'required',
      );
    }, createPlanningSchedule());
  },
);
test('direct adapter rejects malformed end input that omits immutable effectiveAt', () => {
  const before = planned();
  const change = {
    reason: 'end',
    before,
    after: { ...before, status: 'ended', revision: 2 },
    occurrences: [],
    sessions: [],
  } as unknown as ScheduleChange;
  assert.throws(() => createPlanningSchedule().plan(change), {
    code: 'INVALID_INPUT',
    status: 409,
  });
});
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
