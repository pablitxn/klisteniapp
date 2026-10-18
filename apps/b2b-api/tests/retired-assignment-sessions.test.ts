import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import { createRecordsServices } from '../src/schedule/index.ts';
import { content, databaseUrl, now, withLedger, type Ledger } from './fixtures/wp03-ledger.ts';
const records = createRecordsServices(now);
function legacyInput(id: string, executionId: string | null = null) {
  const actual = content('partial');
  actual.segments[0]!.dose = {
    ...actual.segments[0]!.dose,
    sets: { kind: 'fixed', value: 3 },
    repetitions: { kind: 'fixed', value: 8 },
    load: { mode: 'unspecified' },
  };
  actual.correctionReason = executionId ? 'Correct the original accepted actuals' : '';
  return {
    id,
    operationId: `create-${id}`,
    expectedRevision: 0,
    origin: {
      kind: 'legacy' as const,
      assignmentId: 'assignment',
      executionId,
      routine: { programId: 'routine', version: 1, schemaVersion: 1 as const },
    },
    content: actual,
  };
}
async function waitForLock(ledger: Ledger, pid: number) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      (await ledger.pool.query('SELECT 1 FROM pg_locks WHERE pid=$1 AND NOT granted', [pid]))
        .rowCount
    )
      return;
    await setTimeout(10);
  }
  assert.fail('Expected a real PostgreSQL lock wait on the competing assignment transaction');
}
test(
  'retired assignments reject fresh legacy sessions without receipts while original history stays readable',
  { skip: !databaseUrl },
  async () => {
    await withLedger(async (ledger) => {
      const before = (
        await ledger.pool.query("SELECT data::text FROM b2b_execution WHERE id='execution'")
      ).rows;
      await ledger.pool.query(
        "UPDATE b2b_program_assignment SET active=false WHERE id='assignment'",
      );
      for (const status of ['draft', 'partial', 'completed'] as const) {
        const input = legacyInput(`fresh-${status}`);
        input.content.status = status;
        input.content.explicitCompletion = status === 'completed';
        await assert.rejects(
          ledger.run((ctx) => records.saveSession(ctx, input)),
          { status: 403, code: 'FORBIDDEN' },
        );
      }
      assert.equal((await ledger.pool.query('SELECT * FROM b2b_training_session')).rowCount, 0);
      assert.equal((await ledger.pool.query('SELECT * FROM b2b_session_revision')).rowCount, 0);
      assert.equal((await ledger.pool.query('SELECT * FROM b2b_operation_receipt')).rowCount, 0);
      const history = await ledger.run((ctx) => records.sessionRevisions(ctx, { id: 'execution' }));
      assert.equal(history[0]!.schemaVersion, 1);
      assert.equal(
        (await ledger.run((ctx) => records.sessions(ctx, { memberId: 'member' }))).length,
        1,
      );
      assert.deepEqual(
        (await ledger.pool.query("SELECT data::text FROM b2b_execution WHERE id='execution'")).rows,
        before,
      );
    });
  },
);
test(
  'retirement preserves existing-session corrections and exact accepted receipts but never bypasses current user authorization',
  { skip: !databaseUrl },
  async () => {
    await withLedger(async (ledger) => {
      const input = legacyInput('existing-session');
      const accepted = await ledger.run((ctx) => records.saveSession(ctx, input));
      await ledger.pool.query(
        "UPDATE b2b_program_assignment SET active=false WHERE id='assignment'",
      );
      const correction = {
        ...input,
        operationId: 'own-correction',
        expectedRevision: 1,
        content: {
          ...input.content,
          notes: 'Correct my accepted record after retirement',
          correctionReason: 'Correct recorded notes',
        },
      };
      const corrected = await ledger.run((ctx) => records.saveSession(ctx, correction));
      assert.equal(corrected.session.revision, 2);
      assert.deepEqual(await ledger.run((ctx) => records.saveSession(ctx, input)), accepted);
      assert.deepEqual(await ledger.run((ctx) => records.saveSession(ctx, correction)), corrected);
      await assert.rejects(
        ledger.run((ctx) => records.saveSession(ctx, legacyInput('another-new-session'))),
        { status: 403, code: 'FORBIDDEN' },
      );
      assert.deepEqual(
        (await ledger.run((ctx) => records.sessionRevisions(ctx, { id: input.id }))).map(
          (r) => r.revision,
        ),
        [1, 2],
      );
      await ledger.pool.query(
        "UPDATE b2b_membership SET active=false WHERE organization_id='atlas' AND user_id='member'",
      );
      await assert.rejects(
        ledger.run((ctx) => records.saveSession(ctx, input)),
        { code: 'CONTEXT_REVOKED' },
      );
      await assert.rejects(
        ledger.run((ctx) =>
          records.saveSession(ctx, {
            ...correction,
            operationId: 'revoked-edit',
            expectedRevision: 2,
          }),
        ),
        { code: 'CONTEXT_REVOKED' },
      );
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
  'first correction of a verified legacy execution remains permitted after retirement and preserves revision zero',
  { skip: !databaseUrl },
  async () => {
    await withLedger(async (ledger) => {
      const before = await ledger.run((ctx) => records.sessionRevisions(ctx, { id: 'execution' }));
      await ledger.pool.query(
        "UPDATE b2b_program_assignment SET active=false WHERE id='assignment'",
      );
      const input = legacyInput('execution', 'execution');
      const accepted = await ledger.run((ctx) => records.saveSession(ctx, input));
      assert.equal(accepted.session.revision, 1);
      const history = await ledger.run((ctx) => records.sessionRevisions(ctx, { id: 'execution' }));
      assert.deepEqual(
        history.map((r) => r.revision),
        [0, 1],
      );
      assert.deepEqual(history[0], before[0]);
      assert.deepEqual(await ledger.run((ctx) => records.saveSession(ctx, input)), accepted);
      await assert.rejects(
        ledger.run((ctx) =>
          records.saveSession(ctx, legacyInput('missing-execution', 'missing-execution')),
        ),
        { status: 404 },
      );
      assert.equal((await ledger.pool.query('SELECT * FROM b2b_training_session')).rowCount, 1);
      assert.equal((await ledger.pool.query('SELECT * FROM b2b_operation_receipt')).rowCount, 1);
    });
  },
);
test(
  'a retirement committed before fresh acceptance wins the PostgreSQL race and leaves no session or receipt',
  { skip: !databaseUrl },
  async () => {
    await withLedger(async (ledger) => {
      const writer = await ledger.pool.connect();
      try {
        await writer.query('BEGIN');
        await writer.query("UPDATE b2b_program_assignment SET active=false WHERE id='assignment'");
        let started!: (pid: number) => void;
        const ready = new Promise<number>((resolve) => {
          started = resolve;
        });
        const saving = ledger
          .run(async (ctx) => {
            started((await ctx.db.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
            return records.saveSession(ctx, legacyInput('retirement-first'));
          })
          .then(
            () => 'accepted',
            (error) => error.code,
          );
        await waitForLock(ledger, await ready);
        await writer.query('COMMIT');
        assert.equal(await saving, 'FORBIDDEN');
        assert.equal((await ledger.pool.query('SELECT * FROM b2b_training_session')).rowCount, 0);
        assert.equal((await ledger.pool.query('SELECT * FROM b2b_operation_receipt')).rowCount, 0);
      } finally {
        await writer.query('ROLLBACK');
        writer.release();
      }
    });
  },
);
test(
  'fresh acceptance first holds retirement until commit and its later exact replay stays authorized and idempotent',
  { skip: !databaseUrl },
  async () => {
    await withLedger(async (ledger) => {
      const input = legacyInput('acceptance-first');
      let accepted!: () => void, release!: () => void;
      const ready = new Promise<void>((resolve) => {
        accepted = resolve;
      });
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const saving = ledger.run(async (ctx) => {
        const result = await records.saveSession(ctx, input);
        accepted();
        await barrier;
        return result;
      });
      await ready;
      const writer = await ledger.pool.connect();
      try {
        await writer.query('BEGIN');
        const pid = (await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const retiring = writer.query(
          "UPDATE b2b_program_assignment SET active=false WHERE id='assignment'",
        );
        await waitForLock(ledger, pid);
        release();
        const result = await saving;
        await retiring;
        await writer.query('COMMIT');
        assert.deepEqual(await ledger.run((ctx) => records.saveSession(ctx, input)), result);
        await assert.rejects(
          ledger.run((ctx) => records.saveSession(ctx, legacyInput('new-after-commit'))),
          { status: 403 },
        );
        assert.equal((await ledger.pool.query('SELECT * FROM b2b_training_session')).rowCount, 1);
        assert.equal((await ledger.pool.query('SELECT * FROM b2b_operation_receipt')).rowCount, 1);
      } finally {
        release();
        await writer.query('ROLLBACK');
        writer.release();
      }
    });
  },
);
