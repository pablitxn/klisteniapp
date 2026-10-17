import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createRecordsServices,
  prepareReconciliation,
  persistReconciliation,
} from '../src/schedule/index.ts';
import { enrollment, memberOccurrences } from '../src/schedule/repository.ts';
import {
  content,
  databaseUrl,
  now,
  planned,
  withLedger,
  writeEnrollment,
} from './fixtures/wp03-ledger.ts';
const services = createRecordsServices(now);
const query = { memberId: 'member', weekStart: '2026-10-19', timeZone: 'America/New_York' };
test(
  'ending an enrollment cancels future obligations while authorized late submission can still record past work',
  { skip: !databaseUrl },
  async () => {
    await withLedger(async (ledger) => {
      const original = await ledger.run((ctx) => services.occurrences(ctx, query));
      await ledger.run(async (ctx) => {
        const before = await enrollment(ctx, 'enrollment', true),
          next = structuredClone(before);
        next.status = 'ended';
        next.revision++;
        const { planned: revised } = await prepareReconciliation(
          ctx,
          before,
          next,
          '2026-10-20T16:00:00Z',
        );
        await writeEnrollment(ctx, next);
        await persistReconciliation(ctx, original, revised);
        await ctx.db.query("UPDATE b2b_enrollment SET status='ended' WHERE id='enrollment'");
      }, 'coach');
      const past = original.find((o) => o.scheduledDate === '2026-10-19')!;
      const actuals = content();
      actuals.performedAt = '2026-10-19T16:00:00Z';
      await ledger.run((ctx) =>
        services.saveSession(ctx, {
          id: 'late-ended',
          operationId: 'late-ended',
          expectedRevision: 0,
          origin: { kind: 'occurrence', occurrenceId: past.id, routine: past.routine },
          content: actuals,
        }),
      );
      const summary = await ledger.run((ctx) => services.week(ctx, query));
      assert.deepEqual([summary.required, summary.completed, summary.missed], [2, 1, 1]);
      const future = original.find((o) => o.scheduledDate === '2026-10-21')!;
      await assert.rejects(
        ledger.run((ctx) =>
          services.saveSession(ctx, {
            id: 'cancelled',
            operationId: 'cancelled',
            expectedRevision: 0,
            origin: { kind: 'occurrence', occurrenceId: future.id, routine: future.routine },
            content: content(),
          }),
        ),
        { status: 403 },
      );
    });
  },
);
test(
  'midweek stage boundary retains accepted same-week override and same-day slots remain separate in PostgreSQL',
  { skip: !databaseUrl },
  async () => {
    await withLedger(async (ledger) => {
      await ledger.run(async (ctx) => {
        const before = await enrollment(ctx, 'enrollment', true),
          next = planned('2026-10-21', '2026-10-25', 2);
        next.content.stages[0]!.slots[3]!.weekday = 3;
        const previous = await memberOccurrences(ctx, 'member');
        const { planned: revised } = await prepareReconciliation(ctx, before, next);
        await writeEnrollment(ctx, next);
        await persistReconciliation(ctx, previous, revised);
      }, 'coach');
      const required = (await ledger.run((ctx) => services.occurrences(ctx, query))).filter(
        (o) => o.eligibility === 'required',
      );
      assert.equal(required.length, 2);
      assert.equal(required[0]!.scheduledDate, required[1]!.scheduledDate);
      const first = required[0]!;
      const moved = await ledger.run((ctx) =>
        services.moveOccurrence(ctx, {
          id: first.id,
          operationId: 'move-across-stage-edge',
          expectedRevision: first.revision,
          scheduledDate: '2026-10-19',
        }),
      );
      assert.equal(moved.permittedDateOverride, '2026-10-19');
      const actuals = content();
      actuals.performedAt = '2026-10-19T14:00:00Z';
      await ledger.run((ctx) =>
        services.saveSession(ctx, {
          id: 'overridden',
          operationId: 'override-complete',
          expectedRevision: 0,
          origin: { kind: 'occurrence', occurrenceId: first.id, routine: first.routine },
          content: actuals,
        }),
      );
      const summary = await ledger.run((ctx) => services.week(ctx, query));
      assert.deepEqual([summary.required, summary.completed, summary.missed], [2, 1, 1]);
    });
  },
);
test(
  'four/three/one, duplicate retries/repeated sessions, partial-only, late void and correction revise closed weeks',
  { skip: !databaseUrl },
  async () => {
    await withLedger(async (ledger) => {
      const occurrences = await ledger.run((ctx) => services.occurrences(ctx, query));
      for (const [index, occurrence] of occurrences.entries()) {
        const input = {
          id: `session-${index}`,
          operationId: `create-${index}`,
          expectedRevision: 0,
          origin: {
            kind: 'occurrence' as const,
            occurrenceId: occurrence.id,
            routine: occurrence.routine,
          },
          content: content(index === 3 ? 'partial' : 'completed'),
        };
        await ledger.run((ctx) => services.saveSession(ctx, input));
        await ledger.run((ctx) => services.saveSession(ctx, input));
      }
      const before = await ledger.run((ctx) => services.week(ctx, query));
      assert.deepEqual(
        [before.required, before.completed, before.partial, before.missed, before.pending],
        [4, 3, 1, 1, 0],
      );
      const first = occurrences[0]!;
      const repeated = {
        id: 'repeated',
        operationId: 'repeated',
        expectedRevision: 0,
        origin: { kind: 'occurrence' as const, occurrenceId: first.id, routine: first.routine },
        content: content(),
      };
      await ledger.run((ctx) => services.saveSession(ctx, repeated));
      assert.equal((await ledger.run((ctx) => services.week(ctx, query))).completed, 3);
      await ledger.run((ctx) =>
        services.saveSession(ctx, {
          ...repeated,
          operationId: 'void-repeat',
          expectedRevision: 1,
          content: { ...content('void'), correctionReason: 'Duplicate record' },
        }),
      );
      await ledger.run((ctx) =>
        services.saveSession(ctx, {
          ...repeated,
          id: 'session-0',
          operationId: 'partial-correction',
          expectedRevision: 1,
          content: { ...content('partial'), correctionReason: 'Correct completion' },
        }),
      );
      const after = await ledger.run((ctx) => services.week(ctx, query));
      assert.deepEqual(
        [after.required, after.completed, after.partial, after.missed],
        [4, 2, 2, 2],
      );
      assert.ok(after.revision > before.revision);
      const last = occurrences[3]!;
      await ledger.run((ctx) =>
        services.saveSession(ctx, {
          id: 'session-3',
          operationId: 'late-complete',
          expectedRevision: 1,
          origin: { kind: 'occurrence', occurrenceId: last.id, routine: last.routine },
          content: content(),
        }),
      );
      assert.equal((await ledger.run((ctx) => services.week(ctx, query))).completed, 3);
    });
  },
);
test(
  'same-week move is receipted, a midweek override is completion-eligible and completed moves are denied',
  { skip: !databaseUrl },
  async () => {
    await withLedger(async (ledger) => {
      const occurrences = await ledger.run((ctx) => services.occurrences(ctx, query));
      const first = occurrences[0]!;
      const move = {
        id: first.id,
        operationId: 'move',
        expectedRevision: first.revision,
        scheduledDate: '2026-10-25',
      };
      const accepted = await ledger.run((ctx) => services.moveOccurrence(ctx, move));
      assert.deepEqual(await ledger.run((ctx) => services.moveOccurrence(ctx, move)), accepted);
      await assert.rejects(
        ledger.run((ctx) =>
          services.moveOccurrence(ctx, {
            ...move,
            operationId: 'outside',
            expectedRevision: accepted.revision,
            scheduledDate: '2026-10-26',
          }),
        ),
        { code: 'OUTSIDE_PRESCRIBED_WEEK' },
      );
      await ledger.run((ctx) =>
        services.saveSession(ctx, {
          id: 'completed',
          operationId: 'completed',
          expectedRevision: 0,
          origin: { kind: 'occurrence', occurrenceId: first.id, routine: first.routine },
          content: content(),
        }),
      );
      await assert.rejects(
        ledger.run((ctx) =>
          services.moveOccurrence(ctx, {
            ...move,
            operationId: 'completed-move',
            expectedRevision: accepted.revision,
          }),
        ),
        { status: 403 },
      );
      assert.equal((await ledger.run((ctx) => services.occurrences(ctx, query))).length, 4);
      assert.equal(
        (await ledger.run((ctx) => services.week(ctx, { ...query, timeZone: 'UTC' }))).required,
        0,
      );
    });
  },
);
test(
  'period reconciliation moves stable obligations across weeks, preserves actuals and cancels removed work without extra absences',
  { skip: !databaseUrl },
  async () => {
    await withLedger(async (ledger) => {
      const original = await ledger.run((ctx) => services.occurrences(ctx, query));
      const first = original[0]!;
      await ledger.run((ctx) =>
        services.saveSession(ctx, {
          id: 'session',
          operationId: 'create',
          expectedRevision: 0,
          origin: { kind: 'occurrence', occurrenceId: first.id, routine: first.routine },
          content: content(),
        }),
      );
      const bytes = (await ledger.pool.query('SELECT snapshot::text FROM b2b_session_revision'))
        .rows;
      await ledger.run(async (ctx) => {
        const before = await enrollment(ctx, 'enrollment', true),
          next = planned('2026-10-26', '2026-11-01', 2);
        const { planned: revised, impacts } = await prepareReconciliation(ctx, before, next);
        assert.equal(
          impacts.find((i) => i.occurrenceId === first.id)!.linkedSessionIds[0],
          'session',
        );
        await writeEnrollment(ctx, next);
        await persistReconciliation(ctx, original, revised);
      }, 'coach');
      assert.deepEqual(
        (await ledger.pool.query('SELECT snapshot::text FROM b2b_session_revision')).rows,
        bytes,
      );
      assert.equal((await ledger.run((ctx) => services.week(ctx, query))).required, 0);
      const after = await ledger.run((ctx) =>
        services.occurrences(ctx, { ...query, weekStart: '2026-10-26' }),
      );
      assert.deepEqual(after.map((o) => o.id).sort(), original.map((o) => o.id).sort());
      const newWeek = await ledger.run((ctx) =>
        services.week(ctx, { ...query, weekStart: '2026-10-26' }),
      );
      assert.deepEqual([newWeek.required, newWeek.completed, newWeek.missed], [4, 0, 4]);
      await ledger.run(async (ctx) => {
        const before = await enrollment(ctx, 'enrollment', true),
          next = planned('2026-11-02', '2026-11-08', 3);
        next.content.stages[0]!.slots = [{ ...next.content.stages[0]!.slots[0]!, id: 'new-slot' }];
        const previous = await memberOccurrences(ctx, 'member');
        const { planned: revised } = await prepareReconciliation(ctx, before, next);
        await writeEnrollment(ctx, next);
        await persistReconciliation(ctx, previous, revised);
      }, 'coach');
      assert.equal(
        (await ledger.run((ctx) => services.week(ctx, { ...query, weekStart: '2026-10-26' })))
          .required,
        0,
      );
      assert.equal((await ledger.pool.query('SELECT * FROM b2b_training_session')).rowCount, 1);
      assert.equal((await ledger.pool.query('SELECT * FROM b2b_occurrence')).rowCount, 5);
    });
  },
);
