import {
  canonicalExercises,
  REVIEWED_CATALOG_REVISION,
} from '../src/catalog/reviewed-projection.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRecordsServices } from '../src/schedule/index.ts';
import { content, databaseUrl, legacy, now, routine, withLedger } from './fixtures/wp03-ledger.ts';
import { ReviewedRelationSchema } from '@klisteniapp/b2b-contracts/product-v2';
const services = createRecordsServices(now);
test(
  'reviewed source-to-target duration/per-side segments retain all source actuals and restore the original segment without changing issued JSON',
  { skip: !databaseUrl },
  async () => {
    const relation = ReviewedRelationSchema.parse({
      id: 'reviewed-target',
      sourceExerciseId: 'exercise',
      targetExerciseId: 'squat',
      type: 'alternative',
      conditions: ['target-requirements-confirmed', 'use-target-dose'],
      rationale: 'Synthetic fixture only',
      catalogRevision: REVIEWED_CATALOG_REVISION,
      sourceContentHash: 'b'.repeat(64),
      targetContentHash: 'c'.repeat(64),
      requirements: ['Confirm target requirements'],
      target: canonicalExercises().find((e) => e.id === 'squat')!,
      targetDose: {
        ...legacy.dose,
        mode: 'duration',
        sets: { kind: 'fixed', value: 1 },
        repetitions: null,
        durationSeconds: { kind: 'fixed', value: 30 },
        laterality: 'per-side',
        load: { mode: 'external', kilograms: { kind: 'fixed', value: 5 } },
      },
    });
    await withLedger(
      async (ledger) => {
        const snapshot = (
          await ledger.pool.query(
            "SELECT snapshot::text FROM b2b_program_version WHERE program_id='routine-v2'",
          )
        ).rows;
        const [occurrence] = await ledger.run((ctx) =>
          services.occurrences(ctx, {
            memberId: 'member',
            weekStart: '2026-10-19',
            timeZone: 'America/New_York',
          }),
        );
        const input = {
          id: 'segment-session',
          operationId: 'source',
          expectedRevision: 0,
          origin: {
            kind: 'occurrence' as const,
            occurrenceId: occurrence!.id,
            routine: occurrence!.routine,
          },
          content: content('partial'),
        };
        await ledger.run((ctx) => services.saveSession(ctx, input));
        const switched = structuredClone(input.content);
        switched.status = 'completed';
        switched.explicitCompletion = true;
        switched.segments.push({
          segmentId: 'target-segment',
          originalStepId: 'step',
          exerciseId: 'squat',
          dose: relation.targetDose,
          relation,
          confirmedConditions: relation.conditions,
          createdAt: '2026-10-22T14:01:00Z',
        });
        switched.selectedSegments = [{ originalStepId: 'step', segmentId: 'target-segment' }];
        await assert.rejects(
          ledger.run((ctx) =>
            services.saveSession(ctx, {
              ...input,
              operationId: 'missing-target-actuals',
              expectedRevision: 1,
              content: switched,
            }),
          ),
          { code: 'INCOMPLETE_EXECUTION' },
        );
        switched.sets.push(
          ...(['left', 'right'] as const).map((side) => ({
            performedSetId: `target-${side}`,
            segmentId: 'target-segment',
            ordinal: 1,
            side,
            repetitions: null,
            durationSeconds: 1,
            loadKg: 0,
            rpe: null,
            notes: '',
          })),
        );
        await ledger.run((ctx) =>
          services.saveSession(ctx, {
            ...input,
            operationId: 'target',
            expectedRevision: 1,
            content: switched,
          }),
        );
        const restored = structuredClone(switched);
        restored.selectedSegments = input.content.selectedSegments;
        restored.correctionReason = 'Restore original prescribed segment';
        await ledger.run((ctx) =>
          services.saveSession(ctx, {
            ...input,
            operationId: 'restore',
            expectedRevision: 2,
            content: restored,
          }),
        );
        const history = await ledger.run((ctx) => services.sessionRevisions(ctx, { id: input.id }));
        const last = history.at(-1)!;
        assert.ok(last.schemaVersion === 2);
        assert.equal(last.content.segments.length, 2);
        assert.equal(last.content.sets.length, 5);
        assert.deepEqual(last.content.sets.slice(0, 3), input.content.sets);
        assert.deepEqual(
          (
            await ledger.pool.query(
              "SELECT snapshot::text FROM b2b_program_version WHERE program_id='routine-v2'",
            )
          ).rows,
          snapshot,
        );
      },
      { ...routine, relations: [relation] },
    );
  },
);
test(
  'exact accepted receipt survives successors; changed create payload and stale revisions conflict without extra audit',
  { skip: !databaseUrl },
  async () => {
    await withLedger(async (ledger) => {
      const [occurrence] = await ledger.run((ctx) =>
        services.occurrences(ctx, {
          memberId: 'member',
          weekStart: '2026-10-19',
          timeZone: 'America/New_York',
        }),
      );
      const input = {
        id: 'session',
        operationId: 'create',
        expectedRevision: 0,
        origin: {
          kind: 'occurrence' as const,
          occurrenceId: occurrence!.id,
          routine: occurrence!.routine,
        },
        content: content(),
      };
      const accepted = await ledger.run((ctx) => services.saveSession(ctx, input));
      const correction = {
        ...input,
        operationId: 'correct',
        expectedRevision: 1,
        content: { ...content('partial'), correctionReason: 'Mistaken completion' },
      };
      await ledger.run((ctx) => services.saveSession(ctx, correction));
      assert.deepEqual(await ledger.run((ctx) => services.saveSession(ctx, input)), accepted);
      await assert.rejects(
        ledger.run((ctx) =>
          services.saveSession(ctx, { ...input, content: { ...input.content, notes: 'Changed' } }),
        ),
        { code: 'OPERATION_CONFLICT' },
      );
      await assert.rejects(
        ledger.run((ctx) => services.saveSession(ctx, { ...correction, operationId: 'stale' })),
        { code: 'REVISION_CONFLICT' },
      );
      assert.equal((await ledger.pool.query('SELECT * FROM b2b_session_revision')).rowCount, 2);
      assert.equal(
        (await ledger.pool.query("SELECT * FROM b2b_audit WHERE action='session.revision'"))
          .rowCount,
        2,
      );
      assert.equal((await ledger.pool.query('SELECT * FROM b2b_operation_receipt')).rowCount, 2);
    });
  },
);
test(
  'legacy revision zero and original bytes/IDs survive first correction and retained history stays unscheduled',
  { skip: !databaseUrl },
  async () => {
    await withLedger(async (ledger) => {
      const before = (
        await ledger.pool.query("SELECT data::text FROM b2b_execution WHERE id='execution'")
      ).rows[0].data;
      const zero = await ledger.run((ctx) => services.sessionRevisions(ctx, { id: 'execution' }));
      assert.equal(zero[0]!.schemaVersion, 1);
      const corrected = content('partial');
      corrected.correctionReason = 'Correct original actuals';
      corrected.segments[0]!.dose = {
        ...corrected.segments[0]!.dose,
        sets: { kind: 'fixed', value: 3 },
        repetitions: { kind: 'fixed', value: 8 },
        load: { mode: 'unspecified' },
      };
      const saved = await ledger.run((ctx) =>
        services.saveSession(ctx, {
          id: 'execution',
          operationId: 'legacy-edit',
          expectedRevision: 0,
          origin: {
            kind: 'legacy',
            assignmentId: 'assignment',
            executionId: 'execution',
            routine: { programId: 'routine', version: 1, schemaVersion: 1 },
          },
          content: corrected,
        }),
      );
      assert.equal(saved.session.id, 'execution');
      const history = await ledger.run((ctx) =>
        services.sessionRevisions(ctx, { id: 'execution' }),
      );
      assert.deepEqual(
        history.map((r) => r.revision),
        [0, 1],
      );
      assert.deepEqual(history[0], zero[0]);
      assert.equal(
        (await ledger.pool.query("SELECT data::text FROM b2b_execution WHERE id='execution'"))
          .rows[0].data,
        before,
      );
      assert.deepEqual(history[0]!.schemaVersion === 1 && history[0].original, legacy.legacyRetry);
      assert.equal(
        (await ledger.run((ctx) => services.sessions(ctx, { memberId: 'member' }))).length,
        1,
      );
      const summary = await ledger.run((ctx) =>
        services.week(ctx, {
          memberId: 'member',
          weekStart: '2026-10-19',
          timeZone: 'America/New_York',
        }),
      );
      assert.equal(summary.completed, 0);
      assert.equal(summary.required, 4);
    });
  },
);
test(
  'revoked/inactive current access rejects new and replayed operations; trainer cannot edit member actuals',
  { skip: !databaseUrl },
  async () => {
    await withLedger(async (ledger) => {
      const [occurrence] = await ledger.run((ctx) =>
        services.occurrences(ctx, {
          memberId: 'member',
          weekStart: '2026-10-19',
          timeZone: 'America/New_York',
        }),
      );
      const input = {
        id: 'session',
        operationId: 'create',
        expectedRevision: 0,
        origin: {
          kind: 'occurrence' as const,
          occurrenceId: occurrence!.id,
          routine: occurrence!.routine,
        },
        content: content(),
      };
      await ledger.run((ctx) => services.saveSession(ctx, input));
      await assert.rejects(
        ledger.run((ctx) => services.saveSession(ctx, input), 'coach'),
        { status: 403 },
      );
      await assert.rejects(
        ledger.run(
          (ctx) => services.saveSession(ctx, { ...input, operationId: 'other-person' }),
          'other',
        ),
        { status: 403 },
      );
      await ledger.pool.query("UPDATE b2b_branch_grant SET active=false WHERE user_id='member'");
      await assert.rejects(
        ledger.run((ctx) => services.saveSession(ctx, input)),
        { code: 'CONTEXT_REVOKED' },
      );
      await ledger.pool.query("UPDATE b2b_branch_grant SET active=true WHERE user_id='member'");
      await ledger.pool.query(
        "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member'",
      );
      await assert.rejects(
        ledger.run((ctx) => services.saveSession(ctx, input)),
        { code: 'CONTEXT_REVOKED' },
      );
      const historical = await ledger.run(
        (ctx) => services.sessions(ctx, { memberId: 'member' }),
        'coach',
      );
      assert.equal(historical.length, 2);
      await ledger.pool.query(
        "UPDATE b2b_membership SET active=true WHERE organization_id='atlas' AND user_id='member'",
      );
      assert.equal(
        (await ledger.run((ctx) => services.saveSession(ctx, input))).session.revision,
        1,
      );
      assert.equal((await ledger.pool.query('SELECT * FROM b2b_operation_receipt')).rowCount, 1);
    });
  },
);
test(
  'future actuals, implicit completion and foreign-branch reads fail; empty draft saves without completion',
  { skip: !databaseUrl },
  async () => {
    await withLedger(async (ledger) => {
      const [occurrence] = await ledger.run((ctx) =>
        services.occurrences(ctx, {
          memberId: 'member',
          weekStart: '2026-10-19',
          timeZone: 'America/New_York',
        }),
      );
      const input = {
        id: 'draft',
        operationId: 'draft-create',
        expectedRevision: 0,
        origin: {
          kind: 'occurrence' as const,
          occurrenceId: occurrence!.id,
          routine: occurrence!.routine,
        },
        content: content('draft'),
      };
      const saved = await ledger.run((ctx) => services.saveSession(ctx, input));
      assert.equal(saved.session.content.status, 'draft');
      assert.equal(
        (
          await ledger.run((ctx) =>
            services.week(ctx, {
              memberId: 'member',
              weekStart: '2026-10-19',
              timeZone: 'America/New_York',
            }),
          )
        ).completed,
        0,
      );
      await assert.rejects(
        ledger.run((ctx) =>
          services.saveSession(ctx, {
            ...input,
            operationId: 'future',
            id: 'future',
            content: { ...input.content, performedAt: '2027-01-01T10:00:00Z' },
          }),
        ),
        { code: 'INVALID_INPUT' },
      );
      await assert.rejects(
        ledger.run((ctx) => services.sessionRevisions(ctx, { id: 'draft' }), 'admin', 'atlas-east'),
        { status: 404 },
      );
    });
  },
);
