import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import { ReviewedRelationSchema } from '@klisteniapp/b2b-contracts/product-v2';
import { createRecordsServices } from '../src/schedule/index.ts';
import {
  content,
  databaseUrl,
  legacy,
  now,
  routine,
  withLedger,
  type Ledger,
} from './fixtures/wp03-ledger.ts';
const records = createRecordsServices(now);
const relation = ReviewedRelationSchema.parse({
  id: 'catalog-target',
  sourceExerciseId: 'exercise',
  targetExerciseId: 'target',
  type: 'alternative',
  conditions: ['target-requirements-confirmed', 'use-target-dose'],
  rationale: 'Synthetic current catalog test',
  catalogRevision: 'a'.repeat(64),
  sourceContentHash: 'b'.repeat(64),
  targetContentHash: 'c'.repeat(64),
  requirements: ['Confirm target requirements'],
  target: {
    id: 'target',
    scope: 'base',
    status: 'published',
    version: 1,
    revision: 0,
    name: 'Synthetic target',
    description: '',
    instructions: ['Synthetic'],
    equipment: 'none',
    machineId: null,
    compatibleMachineIds: [],
    pattern: '',
    muscles: [],
    animationId: null,
    assets: [],
    baseExerciseId: null,
  },
  targetDose: legacy.dose,
});
async function catalogFixture(
  run: (ledger: Ledger, input: Parameters<typeof records.saveSession>[1]) => Promise<void>,
) {
  await withLedger(
    async (ledger) => {
      const [occurrence] = await ledger.run((ctx) =>
        records.occurrences(ctx, {
          memberId: 'member',
          weekStart: '2026-10-19',
          timeZone: 'America/New_York',
        }),
      );
      const original = {
        id: 'catalog-session',
        operationId: 'source',
        expectedRevision: 0,
        origin: {
          kind: 'occurrence' as const,
          occurrenceId: occurrence!.id,
          routine: occurrence!.routine,
        },
        content: content('partial'),
      };
      await ledger.run((ctx) => records.saveSession(ctx, original));
      const selected = structuredClone(original.content);
      selected.segments.push({
        segmentId: 'target',
        originalStepId: 'step',
        exerciseId: 'target',
        dose: relation.targetDose,
        relation,
        confirmedConditions: relation.conditions,
        createdAt: selected.performedAt,
      });
      selected.selectedSegments = [{ originalStepId: 'step', segmentId: 'target' }];
      await run(ledger, {
        ...original,
        operationId: 'target-select',
        expectedRevision: 1,
        content: selected,
      });
    },
    { ...routine, relations: [relation] },
  );
}
async function waitForLock(ledger: Ledger, pid: number) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await ledger.pool.query('SELECT 1 FROM pg_locks WHERE pid=$1 AND NOT granted', [
      pid,
    ]);
    if (result.rowCount) return;
    await setTimeout(10);
  }
  assert.fail('Expected a real PostgreSQL lock wait before releasing the competing transaction');
}
test(
  'new alternatives require published, currently authorized source and target catalog rows; retained segments survive disablement',
  { skip: !databaseUrl },
  async () => {
    await catalogFixture(async (ledger, input) => {
      const reject = async (operationId: string) =>
        assert.rejects(
          ledger.run((ctx) => records.saveSession(ctx, { ...input, operationId })),
          { status: 403, message: 'SOURCE_OR_TARGET_CATALOG_UNAVAILABLE' },
        );
      await ledger.pool.query(
        "INSERT INTO b2b_branch_catalog(organization_id,branch_id,kind,resource_id,enabled) VALUES('atlas','atlas-principal','exercise','target',false)",
      );
      await reject('disabled-target');
      await ledger.pool.query("DELETE FROM b2b_branch_catalog WHERE resource_id='target'");
      for (const id of ['exercise', 'target']) {
        await ledger.pool.query("UPDATE b2b_exercise SET status='draft' WHERE id=$1", [id]);
        await reject(`unpublished-${id}`);
        await ledger.pool.query(
          "UPDATE b2b_exercise SET status='published',organization_id='sur',branch_id='sur-principal' WHERE id=$1",
          [id],
        );
        await reject(`foreign-${id}`);
        await ledger.pool.query(
          'UPDATE b2b_exercise SET organization_id=NULL,branch_id=NULL WHERE id=$1',
          [id],
        );
      }
      await ledger.pool.query(
        "UPDATE b2b_exercise SET organization_id='atlas',branch_id='atlas-east' WHERE id='target'",
      );
      await reject('unshared-branch');
      await ledger.pool.query(
        "INSERT INTO b2b_branch_catalog(organization_id,branch_id,kind,resource_id,enabled) VALUES('atlas','atlas-principal','exercise','target',true)",
      );
      await ledger.run((ctx) => records.saveSession(ctx, input));
      await ledger.pool.query(
        "UPDATE b2b_branch_catalog SET enabled=false WHERE resource_id='target'; UPDATE b2b_exercise SET status='draft' WHERE id IN ('exercise','target')",
      );
      const retained = await ledger.run((ctx) =>
        records.saveSession(ctx, {
          ...input,
          expectedRevision: 2,
          operationId: 'retained-edit',
          content: { ...input.content, notes: 'Preserve historical target after revocation' },
        }),
      );
      assert.equal(retained.session.content.segments.length, 2);
      assert.equal(
        (await ledger.run((ctx) => records.sessionRevisions(ctx, { id: input.id }))).length,
        3,
      );
      assert.equal((await ledger.pool.query('SELECT * FROM b2b_operation_receipt')).rowCount, 3);
    });
  },
);
test(
  'concurrent catalog disable insertion or source unpublication commits before selection and denies acceptance atomically',
  { skip: !databaseUrl },
  async () => {
    for (const mutation of [
      "INSERT INTO b2b_branch_catalog(organization_id,branch_id,kind,resource_id,enabled) VALUES('atlas','atlas-principal','exercise','target',false)",
      "UPDATE b2b_exercise SET status='draft' WHERE id='exercise'",
    ]) {
      await catalogFixture(async (ledger, input) => {
        const writer = await ledger.pool.connect();
        try {
          await writer.query('BEGIN');
          await writer.query(mutation);
          let signal!: (pid: number) => void;
          const started = new Promise<number>((resolve) => {
            signal = resolve;
          });
          const saving = ledger
            .run(async (ctx) => {
              signal((await ctx.db.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
              return records.saveSession(ctx, input);
            })
            .then(
              () => 'accepted',
              (error) => error.message,
            );
          await waitForLock(ledger, await started);
          await writer.query('COMMIT');
          assert.equal(await saving, 'SOURCE_OR_TARGET_CATALOG_UNAVAILABLE');
          assert.equal((await ledger.pool.query('SELECT * FROM b2b_session_revision')).rowCount, 1);
          assert.equal(
            (await ledger.pool.query('SELECT * FROM b2b_operation_receipt')).rowCount,
            1,
          );
        } finally {
          await writer.query('ROLLBACK');
          writer.release();
        }
      });
    }
  },
);
test(
  'accepted target selection serializes before a concurrent disable and remains a retained historical segment',
  { skip: !databaseUrl },
  async () => {
    await catalogFixture(async (ledger, input) => {
      let selected!: () => void, release!: () => void;
      const ready = new Promise<void>((resolve) => {
        selected = resolve;
      });
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const saving = ledger.run(async (ctx) => {
        const result = await records.saveSession(ctx, input);
        selected();
        await barrier;
        return result;
      });
      await ready;
      const writer = await ledger.pool.connect();
      try {
        await writer.query('BEGIN');
        const pid = (await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const disabling = writer.query(
          "INSERT INTO b2b_branch_catalog(organization_id,branch_id,kind,resource_id,enabled) VALUES('atlas','atlas-principal','exercise','target',false)",
        );
        await waitForLock(ledger, pid);
        release();
        await saving;
        await disabling;
        await writer.query('COMMIT');
        const result = await ledger.run((ctx) =>
          records.saveSession(ctx, {
            ...input,
            expectedRevision: 2,
            operationId: 'after-disable',
            content: { ...input.content, notes: 'Retained' },
          }),
        );
        assert.equal(result.session.revision, 3);
      } finally {
        release();
        await writer.query('ROLLBACK');
        writer.release();
      }
    });
  },
);
