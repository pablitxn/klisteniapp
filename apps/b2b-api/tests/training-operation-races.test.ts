import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRecordsServices } from '../src/schedule/index.ts';
import { content, databaseUrl, now, withLedger } from './fixtures/wp03-ledger.ts';
const services = createRecordsServices(now);
test(
  'PostgreSQL concurrent exact create accepts once and returns identical immutable receipts',
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
        id: 'race',
        operationId: 'same-operation',
        expectedRevision: 0,
        origin: {
          kind: 'occurrence' as const,
          occurrenceId: occurrence!.id,
          routine: occurrence!.routine,
        },
        content: content(),
      };
      const results = await Promise.all(
        Array.from({ length: 4 }, () => ledger.run((ctx) => services.saveSession(ctx, input))),
      );
      for (const result of results) assert.deepEqual(result, results[0]);
      assert.equal((await ledger.pool.query('SELECT * FROM b2b_session_revision')).rowCount, 1);
      assert.equal((await ledger.pool.query('SELECT * FROM b2b_operation_receipt')).rowCount, 1);
    });
  },
);
test(
  'PostgreSQL two-device CAS accepts one different edit and rejects the stale writer without partial audit or receipt',
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
        id: 'race',
        operationId: 'create',
        expectedRevision: 0,
        origin: {
          kind: 'occurrence' as const,
          occurrenceId: occurrence!.id,
          routine: occurrence!.routine,
        },
        content: content('partial'),
      };
      await ledger.run((ctx) => services.saveSession(ctx, input));
      const results = await Promise.allSettled(
        ['device-a', 'device-b'].map((operationId) =>
          ledger.run((ctx) =>
            services.saveSession(ctx, {
              ...input,
              operationId,
              expectedRevision: 1,
              content: { ...content('partial'), notes: operationId },
            }),
          ),
        ),
      );
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      const failed = results.find((r) => r.status === 'rejected');
      assert.equal(failed?.status === 'rejected' && failed.reason.code, 'REVISION_CONFLICT');
      assert.equal((await ledger.pool.query('SELECT * FROM b2b_session_revision')).rowCount, 2);
      assert.equal((await ledger.pool.query('SELECT * FROM b2b_operation_receipt')).rowCount, 2);
      assert.equal(
        (await ledger.pool.query("SELECT * FROM b2b_audit WHERE action='session.revision'"))
          .rowCount,
        2,
      );
    });
  },
);
test(
  'PostgreSQL simultaneous changed-payload operation reuse conflicts, and rollback leaves no accepted record',
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
        id: 'race',
        operationId: 'same-operation',
        expectedRevision: 0,
        origin: {
          kind: 'occurrence' as const,
          occurrenceId: occurrence!.id,
          routine: occurrence!.routine,
        },
        content: content('partial'),
      };
      const results = await Promise.allSettled(
        ['a', 'b'].map((notes) =>
          ledger.run((ctx) =>
            services.saveSession(ctx, { ...input, content: { ...input.content, notes } }),
          ),
        ),
      );
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(results.find((r) => r.status === 'rejected')?.reason.code, 'OPERATION_CONFLICT');
      await assert.rejects(
        ledger.run(async (ctx) => {
          await services.saveSession(ctx, {
            ...input,
            id: 'rolled-back',
            operationId: 'rolled-back',
          });
          throw new Error('Synthetic transaction failure');
        }),
      );
      assert.equal(
        (await ledger.pool.query("SELECT * FROM b2b_training_session WHERE id='rolled-back'"))
          .rowCount,
        0,
      );
      assert.equal(
        (
          await ledger.pool.query(
            "SELECT * FROM b2b_operation_receipt WHERE operation_id='rolled-back'",
          )
        ).rowCount,
        0,
      );
    });
  },
);
